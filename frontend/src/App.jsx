import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import RoleSelect from './RoleSelect'
import SignUp from './SignUp'
import Dashboard from './Dashboard'
import Calendar from './Calendar'
import ModuleDetail from './ModuleDetail'
import TeacherDashboard from './TeacherDashboard'
import TeacherModuleDetail from './TeacherModuleDetail'
import './App.css'

const API = import.meta.env.VITE_API_URL

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const role = searchParams.get('role') || 'student'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      const user = data.user
      const name = user?.user_metadata?.full_name || user?.email

      // Save role to profiles table
      await fetch(`${API}/api/teacher/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, role, name }),
      })

      const state = { id: user?.id, name, email: user?.email, role }
      sessionStorage.setItem('dlw_user', JSON.stringify(state))
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
        <div className="login-role-badge">{role === 'teacher' ? '📚 Teacher' : '🎓 Student'}</div>
        <h2>Welcome back</h2>
        <p className="login-subtitle">Sign in to your account</p>
        <form className="form" onSubmit={handleSubmit}>
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
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="login-footer"><a href="#">Forgot password?</a></div>
        <div className="login-footer" style={{ marginTop: '10px' }}>
          Don't have an account? <Link to={`/signup?role=${role}`}>Sign up</Link>
        </div>
        <div className="login-footer" style={{ marginTop: '6px' }}>
          <Link to="/">← Back</Link>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                    element={<RoleSelect />} />
        <Route path="/login"               element={<Login />} />
        <Route path="/signup"              element={<SignUp />} />
        <Route path="/dashboard"           element={<Dashboard />} />
        <Route path="/calendar"            element={<Calendar />} />
        <Route path="/module/:code"        element={<ModuleDetail />} />
        <Route path="/teacher/dashboard"   element={<TeacherDashboard />} />
        <Route path="/teacher/module/:id"  element={<TeacherModuleDetail />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
