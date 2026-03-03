import { Router } from 'express'
import { supabaseAdmin } from '../supabase.js'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const router = Router()

// Spaced repetition intervals in days
const SR_INTERVALS = [1, 3, 7, 14, 30, 60]

// ── POST /api/quiz/generate ───────────────────────────────────────────────────
// Body: { item_id, module_code, student_id, percentage, feedback, model_text, student_text }
// Generates MCQs targeting weak areas, stores quiz bank + first review session
router.post('/generate', async (req, res) => {
  const { item_id, module_code, student_id, percentage, feedback, model_text, student_text } = req.body
  if (!item_id || !module_code || !student_id) {
    return res.status(400).json({ error: 'item_id, module_code and student_id are required.' })
  }

  // Check if a quiz bank already exists for this student + item
  const { data: existing } = await supabaseAdmin
    .from('quiz_banks')
    .select('id')
    .eq('item_id', Number(item_id))
    .eq('student_id', student_id)
    .maybeSingle()

  if (existing) {
    return res.json({ quiz_bank_id: existing.id, already_exists: true })
  }

  // Generate MCQs with GPT-4o
  const systemPrompt = `You are an expert educational quiz designer.
Based on the model answer and the student's answer (with their score and feedback), 
generate 6 multiple-choice questions that target the specific concepts the student got wrong or partially understood.
Each question should test a key concept from the model answer.

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "topic": "<short topic name, e.g. 'Machine Learning Fundamentals'>",
  "questions": [
    {
      "q": "<question text>",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "answer": "A",
      "explanation": "<1-2 sentence explanation of why this is correct>"
    }
  ]
}`

  const userPrompt = `Student Score: ${percentage ?? '?'}%
Feedback on student's answer: ${feedback ?? 'No feedback provided.'}

MODEL ANSWER (source of truth):
${(model_text || '').slice(0, 2500)}

STUDENT'S ANSWER (what they wrote):
${(student_text || '').slice(0, 2500)}`

  let questions
  let topic = 'Revision Quiz'
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 1800,
    })
    const raw = completion.choices[0].message.content.trim()
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(jsonStr)
    questions = parsed.questions
    topic = parsed.topic || topic
  } catch (e) {
    return res.status(500).json({ error: 'Failed to generate quiz: ' + e.message })
  }

  // Store quiz bank
  const { data: bank, error: bankErr } = await supabaseAdmin
    .from('quiz_banks')
    .insert([{
      item_id: Number(item_id),
      module_code,
      student_id,
      topic,
      questions,
      score_at_generation: percentage ?? null,
    }])
    .select()
    .single()

  if (bankErr) return res.status(500).json({ error: bankErr.message })

  // Create first review session (due tomorrow)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { error: sessionErr } = await supabaseAdmin
    .from('review_sessions')
    .insert([{
      quiz_bank_id: bank.id,
      student_id,
      item_id: Number(item_id),
      module_code,
      topic,
      next_due: tomorrow.toISOString().split('T')[0],
      interval_index: 0,  // index into SR_INTERVALS
    }])

  if (sessionErr) return res.status(500).json({ error: sessionErr.message })

  return res.status(201).json({ quiz_bank_id: bank.id, topic, question_count: questions.length })
})

// ── GET /api/quiz/due?student_id=xxx ────────────────────────────────────────
// Returns all review sessions due today or overdue, with their quiz bank questions
router.get('/due', async (req, res) => {
  const { student_id } = req.query
  if (!student_id) return res.status(400).json({ error: 'student_id is required.' })

  const today = new Date().toISOString().split('T')[0]

  const { data: sessions, error } = await supabaseAdmin
    .from('review_sessions')
    .select(`
      id,
      quiz_bank_id,
      item_id,
      module_code,
      topic,
      next_due,
      interval_index,
      quiz_banks ( questions, topic, score_at_generation )
    `)
    .eq('student_id', student_id)
    .lte('next_due', today)
    .is('completed_at', null)
    .order('next_due', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  return res.json(sessions || [])
})

// ── GET /api/quiz/bank?item_id=xxx&student_id=xxx ───────────────────────────
// Returns quiz bank questions for a specific item + student
router.get('/bank', async (req, res) => {
  const { item_id, student_id } = req.query
  if (!item_id || !student_id) return res.status(400).json({ error: 'item_id and student_id are required.' })

  const { data, error } = await supabaseAdmin
    .from('quiz_banks')
    .select('id, topic, questions, score_at_generation')
    .eq('item_id', Number(item_id))
    .eq('student_id', student_id)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
})

// ── POST /api/quiz/complete ──────────────────────────────────────────────────
// Body: { session_id, score_pct }  — marks session done + schedules next SR session
router.post('/complete', async (req, res) => {
  const { session_id, score_pct } = req.body
  if (!session_id) return res.status(400).json({ error: 'session_id is required.' })

  // Fetch session
  const { data: session, error: sErr } = await supabaseAdmin
    .from('review_sessions')
    .select('*')
    .eq('id', session_id)
    .single()

  if (sErr || !session) return res.status(404).json({ error: 'Session not found.' })

  // Mark current session complete
  await supabaseAdmin
    .from('review_sessions')
    .update({ completed_at: new Date().toISOString(), score_pct: score_pct ?? null })
    .eq('id', session_id)

  // Schedule next SR session (unless we've exhausted all intervals)
  const nextIntervalIndex = (session.interval_index ?? 0) + 1
  if (nextIntervalIndex < SR_INTERVALS.length) {
    const daysUntilNext = SR_INTERVALS[nextIntervalIndex]
    const nextDue = new Date()
    nextDue.setDate(nextDue.getDate() + daysUntilNext)

    await supabaseAdmin
      .from('review_sessions')
      .insert([{
        quiz_bank_id: session.quiz_bank_id,
        student_id: session.student_id,
        item_id: session.item_id,
        module_code: session.module_code,
        topic: session.topic,
        next_due: nextDue.toISOString().split('T')[0],
        interval_index: nextIntervalIndex,
      }])
  }

  return res.json({
    done: true,
    next_interval_days: nextIntervalIndex < SR_INTERVALS.length ? SR_INTERVALS[nextIntervalIndex] : null,
  })
})

export default router
