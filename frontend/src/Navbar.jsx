import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Navbar.css'

function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state
  const isTeacher = state?.role === 'teacher'

  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatted = time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const dateFormatted = time.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <nav className="navbar">
      <div className="navbar-left navbar-clock" onClick={() => navigate('/calendar', { state })}>
        <span className="navbar-time">{formatted}</span>
        <span className="navbar-date">{dateFormatted}</span>
      </div>
      <div className="navbar-right">
        <button className="nav-btn" onClick={() => navigate(isTeacher ? '/teacher/dashboard' : '/dashboard', { state })}>
          Home
        </button>
        <button className="nav-btn" onClick={() => alert('Settings coming soon')}>
          Settings
        </button>
        <button className="nav-btn nav-btn-danger" onClick={() => navigate('/')}>
          Sign out
        </button>
      </div>
    </nav>
  )
}

export default Navbar
