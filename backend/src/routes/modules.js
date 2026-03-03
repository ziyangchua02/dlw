import { Router } from 'express'
import supabase from '../supabase.js'
import { supabaseAdmin } from '../supabase.js'

const router = Router()

// GET /api/modules/stats?user_id=<uuid>  — fetch all module stats for a user
router.get('/stats', async (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id is required' })

  const { data, error } = await supabase
    .from('module_stats')
    .select('module_code, attendance, performance, assignments, quizzes, lab, exam, mastery')
    .eq('user_id', user_id)

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
})

// GET /api/modules/progress?user_id=<uuid>  — completed vs total tasks per module for a user
router.get('/progress', async (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id is required' })

  const { data, error } = await supabase
    .from('module_items')
    .select('module_code, status')
    .eq('user_id', user_id)

  if (error) return res.status(500).json({ error: error.message })

  // Aggregate per module_code
  const map = {}
  for (const row of data) {
    const code = row.module_code
    if (!map[code]) map[code] = { total: 0, completed: 0 }
    map[code].total += 1
    if (row.status === 'done') map[code].completed += 1
  }

  return res.json(map)
})

// GET /api/modules/:code/items?user_id=<uuid>  — fetch all items for a module for a user
// Includes teacher-added items for enrolled students
router.get('/:code/items', async (req, res) => {
  const { code } = req.params
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id is required' })

  const moduleCode = code.toUpperCase()

  // 1. Fetch student's own items
  const { data: ownItems, error: ownErr } = await supabase
    .from('module_items')
    .select('*')
    .eq('module_code', moduleCode)
    .eq('user_id', user_id)
    .order('due_date', { ascending: true })
  if (ownErr) return res.status(500).json({ error: ownErr.message })

  // 2. Check if student is enrolled via a teacher module for this code
  //    and if so, fetch teacher's items for that module
  const { data: enrolments } = await supabaseAdmin
    .from('teacher_module_students')
    .select('teacher_module_id, teacher_modules(code, teacher_id)')
    .eq('student_id', user_id)
  
  let teacherItems = []
  if (enrolments) {
    for (const enrolment of enrolments) {
      const tm = enrolment.teacher_modules
      if (!tm || tm.code !== moduleCode) continue
      const { data: tItems } = await supabaseAdmin
        .from('module_items')
        .select('*')
        .eq('module_code', moduleCode)
        .eq('user_id', tm.teacher_id)
        .order('due_date', { ascending: true })
      if (tItems) teacherItems.push(...tItems)
    }
  }

  // 3. Merge: teacher items first (if not already in student's own list by title)
  const ownTitles = new Set(ownItems.map(i => i.title))
  const newTeacherItems = teacherItems.filter(ti => !ownTitles.has(ti.title))

  const merged = [...ownItems, ...newTeacherItems].sort(
    (a, b) => new Date(a.due_date) - new Date(b.due_date)
  )

  return res.json(merged)
})

// POST /api/modules/:code/items  — add a new item for a user
router.post('/:code/items', async (req, res) => {
  const { code } = req.params
  const { title, type, due_date, status, user_id } = req.body

  if (!title || !type || !due_date || !user_id) {
    return res.status(400).json({ error: 'title, type, due_date, and user_id are required.' })
  }

  const { data, error } = await supabase
    .from('module_items')
    .insert([{ module_code: code.toUpperCase(), title, type, due_date, status: status || 'upcoming', user_id }])
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json(data)
})

// DELETE /api/modules/:code/items/:id  — remove an item
router.delete('/:code/items/:id', async (req, res) => {
  const { id } = req.params

  const { error } = await supabase
    .from('module_items')
    .delete()
    .eq('id', id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(204).send()
})

// PATCH /api/modules/:code/items/:id  — update status of an item
router.patch('/:code/items/:id', async (req, res) => {
  const { id } = req.params
  const { status } = req.body

  if (!status) return res.status(400).json({ error: 'status is required' })

  const { data, error } = await supabase
    .from('module_items')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
})

export default router
