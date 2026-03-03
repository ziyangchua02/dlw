import { Router } from 'express'
import OpenAI from 'openai'

const router = Router()

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// POST /api/chat
// Body: { messages: [{from, text}], modules: [{code, name, stats, mastery}] }
router.post('/', async (req, res) => {
  const { messages = [], modules = [] } = req.body

  // Build a readable summary of each module's stats for the AI
  const STAT_LABELS = ['Attendance', 'Performance', 'Assignments', 'Quizzes', 'Lab', 'Exam']

  const moduleContext = modules.map(m => {
    const statLines = STAT_LABELS.map((label, i) => `  ${label}: ${m.stats[i]}/100`).join('\n')
    const weakAreas = STAT_LABELS.filter((_, i) => m.stats[i] < 70)
    return [
      `${m.code} — ${m.name} (Mastery: ${m.mastery}%)`,
      statLines,
      weakAreas.length ? `  ⚠ Weak areas: ${weakAreas.join(', ')}` : '  ✓ All areas above 70',
    ].join('\n')
  }).join('\n\n')

  const systemPrompt = `You are a smart, encouraging academic assistant for a university student learning platform.

The student's current module performance data is below. Each stat is out of 100.

${moduleContext}

Your role:
- Help the student understand their weaknesses and how to improve
- When asked, suggest a personalised weekly study schedule that prioritises weak modules (below 70)
- Be concise, specific, and supportive — avoid generic advice
- Reference actual module codes and stat names when giving advice
- If the student asks something unrelated to studying, gently steer back to their academics`

  // Convert frontend message format to OpenAI role format
  const chatHistory = messages.map(m => ({
    role: m.from === 'user' ? 'user' : 'assistant',
    content: m.text,
  }))

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...chatHistory,
      ],
      max_tokens: 700,
      temperature: 0.7,
    })

    const reply = response.choices[0].message.content
    return res.json({ reply })
  } catch (err) {
    console.error('OpenAI error:', err?.message || err)
    return res.status(500).json({ error: 'AI request failed.' })
  }
})

export default router
