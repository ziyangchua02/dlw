import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import './App.css'

const API = import.meta.env.VITE_API_URL

function SignUp() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const role = searchParams.get('role') || 'student'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) return setError('Passwords do not match.')
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sign up failed')

      let user = data.user
      if (!user?.id) throw new Error('Account creation failed — no user returned.')

      try {
        const loginRes = await fetch(`${API}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const loginData = await loginRes.json()
        if (loginRes.ok && loginData.user) user = loginData.user
      } catch { /* keep signup user */ }

      // Save role to profiles
      await fetch(`${API}/api/teacher/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, role, name }),
      })

      const displayName = user?.user_metadata?.full_name || name || email
      const state = { id: user?.id, name: displayName, email: user?.email, role }

      if (role === 'teacher') {
        navigate('/teacher/dashboard', { state })
      } else {
        navigate('/dashboard', { state })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Create account</h2>
        <p className="login-subtitle">Start your journey today</p>
        <form className="form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="name">Full Name</label>
            <input type="text" id="name" className="input" placeholder="John Doe"
              value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" className="input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" className="input" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div className="input-group">
            <label htmlFor="confirm">Confirm Password</label>
            <input type="password" id="confirm" className="input" placeholder="••••••••"
              value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <div className="login-footer">
          Already have an account? <Link to={`/login?role=${role}`}>Sign in</Link>
        </div>
      </div>
    </div>
  )
}

export default SignUp
