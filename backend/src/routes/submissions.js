import { Router } from 'express'
import supabase from '../supabase.js'
import { supabaseAdmin } from '../supabase.js'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const router = Router()

// ── Shared helper: download a file from Storage and extract its text ──────────
async function extractTextFromPath(filePath) {
  const { data: fileData, error: dlErr } = await supabaseAdmin.storage
    .from('submissions')
    .download(filePath)
  if (dlErr) throw new Error(dlErr.message)

  const arrayBuffer = await fileData.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)

  const pdf = await getDocument({ data: uint8 }).promise
  const pageTexts = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    pageTexts.push(content.items.map(item => item.str).join(' '))
  }
  return pageTexts.join('\n\n').trim() || '(No text found in PDF)'
}

// POST /api/submissions  — record a submission after the PDF has been uploaded to Storage
router.post('/', async (req, res) => {
  const { item_id, module_code, file_path, file_name } = req.body

  if (!item_id || !module_code || !file_path || !file_name) {
    return res.status(400).json({ error: 'item_id, module_code, file_path and file_name are required.' })
  }

  const { data, error } = await supabase
    .from('submissions')
    .insert([{ item_id: Number(item_id), module_code, file_path, file_name }])
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json(data)
})

// GET /api/submissions?item_id=xxx  — check if an item already has a submission
router.get('/', async (req, res) => {
  const { item_id } = req.query
  if (!item_id) return res.status(400).json({ error: 'item_id is required.' })

  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('item_id', item_id)
    .eq('is_sample', false)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)  // null if not submitted yet
})

// ── Sample answers (teacher uploads) ────────────────────────────────────────

// GET /api/submissions/sample?item_id=xxx  — get signed URL for teacher's sample answer
router.get('/sample', async (req, res) => {
  const { item_id } = req.query
  if (!item_id) return res.status(400).json({ error: 'item_id is required.' })

  const { data, error } = await supabaseAdmin
    .from('submissions')
    .select('file_path, file_name')
    .eq('item_id', item_id)
    .eq('is_sample', true)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.json(null)

  // Generate a 1-hour signed URL
  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from('submissions')
    .createSignedUrl(data.file_path, 3600)

  if (signErr) return res.status(500).json({ error: signErr.message })
  return res.json({ url: signed.signedUrl, file_name: data.file_name })
})

// GET /api/submissions/sample/text?item_id=xxx  — extract text from sample answer PDF
router.get('/sample/text', async (req, res) => {
  const { item_id } = req.query
  if (!item_id) return res.status(400).json({ error: 'item_id is required.' })

  // Get file_path from DB
  const { data: row, error: dbErr } = await supabaseAdmin
    .from('submissions')
    .select('file_path, file_name')
    .eq('item_id', item_id)
    .eq('is_sample', true)
    .maybeSingle()

  if (dbErr) return res.status(500).json({ error: dbErr.message })
  if (!row) return res.json({ text: null })

  // Download the PDF bytes directly from Storage
  const { data: fileData, error: dlErr } = await supabaseAdmin.storage
    .from('submissions')
    .download(row.file_path)

  if (dlErr) return res.status(500).json({ error: dlErr.message })

  // Convert Blob → Uint8Array (pdfjs-dist requires Uint8Array, not Buffer)
  const arrayBuffer = await fileData.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)

  // Parse PDF text with pdfjs-dist
  try {
    const pdf = await getDocument({ data: uint8 }).promise
    const pageTexts = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map(item => item.str).join(' ')
      pageTexts.push(pageText)
    }
    const text = pageTexts.join('\n\n').trim()
    return res.json({ text: text || '(No text found in PDF)', file_name: row.file_name })
  } catch (parseErr) {
    return res.status(500).json({ error: 'Failed to parse PDF: ' + parseErr.message })
  }
})

// POST /api/submissions/sample  — record sample answer after teacher uploads PDF to Storage
router.post('/sample', async (req, res) => {
  const { item_id, module_code, file_path, file_name } = req.body
  if (!item_id || !module_code || !file_path || !file_name) {
    return res.status(400).json({ error: 'item_id, module_code, file_path and file_name are required.' })
  }

  // Delete any existing sample for this item first, then insert fresh
  const { data: existing } = await supabaseAdmin
    .from('submissions')
    .select('file_path')
    .eq('item_id', Number(item_id))
    .eq('is_sample', true)
    .maybeSingle()

  if (existing?.file_path) {
    await supabaseAdmin.storage.from('submissions').remove([existing.file_path])
  }

  await supabaseAdmin
    .from('submissions')
    .delete()
    .eq('item_id', Number(item_id))
    .eq('is_sample', true)

  const { data, error } = await supabaseAdmin
    .from('submissions')
    .insert([{ item_id: Number(item_id), module_code, file_path, file_name, is_sample: true }])
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // Extract text from the PDF and cache it in the DB (best-effort, don't fail upload)
  try {
    const extracted = await extractTextFromPath(file_path)
    await supabaseAdmin
      .from('submissions')
      .update({ extracted_text: extracted })
      .eq('id', data.id)
  } catch (_) { /* extraction failure is non-fatal */ }

  return res.status(201).json(data)
})

// DELETE /api/submissions/sample?item_id=xxx  — remove sample answer
router.delete('/sample', async (req, res) => {
  const { item_id } = req.query
  if (!item_id) return res.status(400).json({ error: 'item_id is required.' })

  // Get file_path first so we can delete from Storage too
  const { data: row } = await supabaseAdmin
    .from('submissions')
    .select('file_path')
    .eq('item_id', item_id)
    .eq('is_sample', true)
    .maybeSingle()

  if (row?.file_path) {
    await supabaseAdmin.storage.from('submissions').remove([row.file_path])
  }

  const { error } = await supabaseAdmin
    .from('submissions')
    .delete()
    .eq('item_id', item_id)
    .eq('is_sample', true)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(204).send()
})

// ── Question papers (teacher uploads assignment/quiz PDF for students) ────────

// GET /api/submissions/question?item_id=xxx  — get signed URL for question paper
router.get('/question', async (req, res) => {
  const { item_id } = req.query
  if (!item_id) return res.status(400).json({ error: 'item_id is required.' })

  const { data, error } = await supabaseAdmin
    .from('module_items')
    .select('question_path, question_file_name')
    .eq('id', item_id)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data?.question_path) return res.json(null)

  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from('submissions')
    .createSignedUrl(data.question_path, 3600)

  if (signErr) return res.status(500).json({ error: signErr.message })
  return res.json({ url: signed.signedUrl, file_name: data.question_file_name })
})

// POST /api/submissions/question  — record question paper after teacher uploads to Storage
router.post('/question', async (req, res) => {
  const { item_id, question_path, question_file_name } = req.body
  if (!item_id || !question_path || !question_file_name) {
    return res.status(400).json({ error: 'item_id, question_path and question_file_name are required.' })
  }

  const { data, error } = await supabaseAdmin
    .from('module_items')
    .update({ question_path, question_file_name })
    .eq('id', Number(item_id))
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
})

// DELETE /api/submissions/question?item_id=xxx  — remove question paper
router.delete('/question', async (req, res) => {
  const { item_id } = req.query
  if (!item_id) return res.status(400).json({ error: 'item_id is required.' })

  // Get the path first so we can remove from Storage
  const { data: row } = await supabaseAdmin
    .from('module_items')
    .select('question_path')
    .eq('id', item_id)
    .maybeSingle()

  if (row?.question_path) {
    await supabaseAdmin.storage.from('submissions').remove([row.question_path])
  }

  const { error } = await supabaseAdmin
    .from('module_items')
    .update({ question_path: null, question_file_name: null })
    .eq('id', Number(item_id))

  if (error) return res.status(500).json({ error: error.message })
  return res.status(204).send()
})

// ── AI Grading ────────────────────────────────────────────────────────────────

// POST /api/submissions/grade
// Body: { item_id, file_path }
// Extracts text from student PDF, fetches cached model-answer text, asks OpenAI to grade
router.post('/grade', async (req, res) => {
  const { item_id, file_path } = req.body
  if (!item_id || !file_path) {
    return res.status(400).json({ error: 'item_id and file_path are required.' })
  }

  // 1. Fetch cached model-answer extracted_text from DB
  const { data: sample, error: sErr } = await supabaseAdmin
    .from('submissions')
    .select('extracted_text, file_path')
    .eq('item_id', Number(item_id))
    .eq('is_sample', true)
    .maybeSingle()

  if (sErr) return res.status(500).json({ error: sErr.message })
  if (!sample) return res.json({ skipped: true })

  // Use cached extracted_text, or fall back to live extraction
  let modelText = sample.extracted_text
  if (!modelText) {
    try {
      modelText = await extractTextFromPath(sample.file_path)
    } catch (e) {
      return res.json({ skipped: true })
    }
  }

  // 2. Extract text from the student's submitted PDF
  let studentText
  try {
    studentText = await extractTextFromPath(file_path)
  } catch (e) {
    return res.status(500).json({ error: 'Failed to read your submission: ' + e.message })
  }

  if (studentText === '(No text found in PDF)') {
    return res.status(422).json({ error: 'Your submission appears to be a scanned image. Text-based PDFs are required for grading.' })
  }

  // 3. Ask OpenAI to grade
  const systemPrompt = `You are a strict but fair academic grader. 
You will be given a model answer and a student's answer.
Grade the student answer based on keyword coverage, conceptual accuracy, and completeness compared to the model answer.
Respond ONLY with valid JSON in this exact format:
{"percentage": <integer 0-100>, "feedback": "<2-3 sentence feedback>"}`

  const userPrompt = `MODEL ANSWER:\n${modelText.slice(0, 3000)}\n\nSTUDENT ANSWER:\n${studentText.slice(0, 3000)}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
    })

    const raw = completion.choices[0].message.content.trim()
    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim()
    const result = JSON.parse(jsonStr)
    return res.json({
      percentage: result.percentage,
      feedback: result.feedback,
      model_text: modelText.slice(0, 2500),
      student_text: studentText.slice(0, 2500),
    })
  } catch (e) {
    return res.status(500).json({ error: 'Grading failed: ' + e.message })
  }
})

export default router
