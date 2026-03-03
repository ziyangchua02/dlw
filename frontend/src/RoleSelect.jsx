import { useNavigate } from 'react-router-dom'
import './RoleSelect.css'

function RoleSelect() {
  const navigate = useNavigate()

  return (
    <div className="role-container">
      <div className="role-inner">
        <div className="role-header">
          <h1 className="role-title">Welcome to <span className="role-brand">DLW</span></h1>
          <p className="role-subtitle">Select how you're using the platform</p>
        </div>

        <div className="role-cards">
          <button className="role-card" onClick={() => navigate('/login?role=student')}>
            <span className="role-icon">🎓</span>
            <span className="role-card-title">Student</span>
            <span className="role-card-desc">View your modules, track progress and get AI-powered study help</span>
          </button>

          <button className="role-card" onClick={() => navigate('/login?role=teacher')}>
            <span className="role-icon">📚</span>
            <span className="role-card-title">Teacher</span>
            <span className="role-card-desc">Manage your modules and enrol students into your classes</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default RoleSelect
