import { Router } from 'express'
import supabase, { supabaseAdmin } from '../supabase.js'

const router = Router()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY

// Helper: raw REST call that bypasses Supabase JS client RLS quirks
async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || '',
      ...(options.headers || {}),
    },
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : null }
}

// ── Module catalogue ──────────────────────────────────────────────────────────

// GET /api/teacher/catalogue  — full list of available modules to add
router.get('/catalogue', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('module_catalogue')
    .select('*')
    .order('code')
  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
})

// ── Teacher's modules ─────────────────────────────────────────────────────────

// GET /api/teacher/modules?teacher_id=
router.get('/modules', async (req, res) => {
  const { teacher_id } = req.query
  if (!teacher_id) return res.status(400).json({ error: 'teacher_id required' })

  const { data, error } = await supabaseAdmin
    .from('teacher_modules')
    .select('*')
    .eq('teacher_id', teacher_id)
    .order('created_at')
  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
})

// POST /api/teacher/modules  — add a module to teacher's dashboard
router.post('/modules', async (req, res) => {
  const { teacher_id, code, name, color } = req.body
  if (!teacher_id || !code || !name) return res.status(400).json({ error: 'teacher_id, code, name required' })

  const { body, ok } = await sbFetch('/teacher_modules', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify({ teacher_id, code, name, color: color || '#6366f1' }),
  })
  if (!ok) return res.status(500).json({ error: body?.message || JSON.stringify(body) })
  const row = Array.isArray(body) ? body[0] : body
  return res.status(201).json(row)
})

// DELETE /api/teacher/modules/:id
router.delete('/modules/:id', async (req, res) => {
  const { ok, body } = await sbFetch(`/teacher_modules?id=eq.${req.params.id}`, { method: 'DELETE' })
  if (!ok) return res.status(500).json({ error: body })
  return res.status(204).send()
})

// ── Students in a module ──────────────────────────────────────────────────────

// GET /api/teacher/modules/:id/students
router.get('/modules/:id/students', async (req, res) => {
  const { body, ok } = await sbFetch(
    `/teacher_module_students?teacher_module_id=eq.${req.params.id}&select=student_id,profiles(name,user_id)`
  )
  if (!ok) return res.status(500).json({ error: body })
  return res.json(body)
})

// POST /api/teacher/modules/:id/students  — enrol a student
router.post('/modules/:id/students', async (req, res) => {
  const { student_id } = req.body
  if (!student_id) return res.status(400).json({ error: 'student_id required' })

  const { body, ok } = await sbFetch('/teacher_module_students', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify({ teacher_module_id: Number(req.params.id), student_id }),
  })
  if (!ok) return res.status(500).json({ error: body?.message || JSON.stringify(body) })
  const row = Array.isArray(body) ? body[0] : body
  return res.status(201).json(row)
})

// DELETE /api/teacher/modules/:id/students/:student_id
router.delete('/modules/:id/students/:student_id', async (req, res) => {
  const { ok, body } = await sbFetch(
    `/teacher_module_students?teacher_module_id=eq.${req.params.id}&student_id=eq.${req.params.student_id}`,
    { method: 'DELETE' }
  )
  if (!ok) return res.status(500).json({ error: body })
  return res.status(204).send()
})

// ── Student search ────────────────────────────────────────────────────────────

// GET /api/teacher/students/search  — return all students for dropdown (frontend filters)
router.get('/students/search', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('user_id, name')
    .eq('role', 'student')
    .order('name')
  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
})

// ── Profile ───────────────────────────────────────────────────────────────────

// POST /api/teacher/profile  — upsert role after signup/login
router.post('/profile', async (req, res) => {
  const { user_id, role, name } = req.body
  if (!user_id || !role) return res.status(400).json({ error: 'user_id and role required' })

  const { body, ok } = await sbFetch('/profiles', {
    method: 'POST',
    prefer: 'return=representation,resolution=merge-duplicates',
    body: JSON.stringify({ user_id, role, name }),
  })
  if (!ok) return res.status(500).json({ error: body?.message || JSON.stringify(body) })
  const row = Array.isArray(body) ? body[0] : body
  return res.json(row)
})

// GET /api/teacher/profile/:user_id
router.get('/profile/:user_id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role, name')
    .eq('user_id', req.params.user_id)
    .single()
  if (error) return res.status(404).json({ error: 'Profile not found' })
  return res.json(data)
})

// GET /api/teacher/student-modules?student_id=  — modules a student is enrolled in (via teachers)
router.get('/student-modules', async (req, res) => {
  const { student_id } = req.query
  if (!student_id) return res.status(400).json({ error: 'student_id required' })

  const { data, error } = await supabaseAdmin
    .from('teacher_module_students')
    .select('teacher_module_id, teacher_modules(id, code, name, color, teacher_id)')
    .eq('student_id', student_id)
  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
})

// ── Module items (teacher manages — stored under teacher's user_id) ──────────

// GET /api/teacher/modules/:id/items  — list items the teacher added for this module
router.get('/modules/:id/items', async (req, res) => {
  const { data: mod, error: modErr } = await supabaseAdmin
    .from('teacher_modules')
    .select('code, teacher_id')
    .eq('id', req.params.id)
    .single()
  if (modErr) return res.status(404).json({ error: 'Module not found' })

  const { data: items, error } = await supabaseAdmin
    .from('module_items')
    .select('id, title, type, due_date, status')
    .eq('module_code', mod.code)
    .eq('user_id', mod.teacher_id)
    .order('due_date', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  return res.json(items)
})

// POST /api/teacher/modules/:id/items  — add item (stored under teacher's user_id)
router.post('/modules/:id/items', async (req, res) => {
  const { title, type, due_date } = req.body
  if (!title || !type || !due_date) {
    return res.status(400).json({ error: 'title, type, due_date required' })
  }

  const { data: mod, error: modErr } = await supabaseAdmin
    .from('teacher_modules')
    .select('code, teacher_id')
    .eq('id', req.params.id)
    .single()
  if (modErr) return res.status(404).json({ error: 'Module not found' })

  const { data: inserted, error } = await supabaseAdmin
    .from('module_items')
    .insert([{ module_code: mod.code, title, type, due_date, status: 'upcoming', user_id: mod.teacher_id }])
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json(inserted)
})

// DELETE /api/teacher/modules/:id/items/:itemId  — delete item by id
router.delete('/modules/:id/items/:itemId', async (req, res) => {
  const { error } = await supabaseAdmin
    .from('module_items')
    .delete()
    .eq('id', req.params.itemId)
  if (error) return res.status(500).json({ error: error.message })
  return res.status(204).send()
})

export default router
