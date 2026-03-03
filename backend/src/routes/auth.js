import { Router } from 'express'
import supabase from '../supabase.js'

const router = Router()

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  })

  if (error) return res.status(400).json({ error: error.message })
  return res.status(201).json({ message: 'Account created successfully.', user: data.user })
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return res.status(401).json({ error: error.message })
  return res.status(200).json({ message: 'Login successful.', session: data.session, user: data.user })
})

// POST /api/auth/logout
router.post('/logout', async (_req, res) => {
  const { error } = await supabase.auth.signOut()
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Logged out successfully.' })
})

export default router
