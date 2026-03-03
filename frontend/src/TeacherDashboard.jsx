import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Navbar from './Navbar'
import './TeacherDashboard.css'

const API = import.meta.env.VITE_API_URL

const MODULE_COLORS = ['#6366f1','#a78bfa','#34d399','#f59e0b','#f87171','#38bdf8','#fb923c','#818cf8','#4ade80','#e879f9']

function TeacherDashboard() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const name = state?.name?.includes('@') ? state.name.split('@')[0] : (state?.name || 'Teacher')
  const teacherId = state?.id

  const [modules, setModules]       = useState([])
  const [catalogue, setCatalogue]   = useState([])
  const [showModal, setShowModal]   = useState(false)
  const [selected, setSelected]     = useState('')
  const [adding, setAdding]         = useState(false)
  const [error, setError]           = useState('')

  // Fetch teacher's current modules
  useEffect(() => {
    if (!teacherId) return
    fetch(`${API}/api/teacher/modules?teacher_id=${teacherId}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setModules(data) })
      .catch(() => {})
  }, [teacherId])

  // Fetch module catalogue
  useEffect(() => {
    fetch(`${API}/api/teacher/catalogue`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCatalogue(data) })
      .catch(() => {})
  }, [])

  const availableCatalogue = catalogue.filter(c => !modules.some(m => m.code === c.code))

  const handleAdd = async () => {
    if (!selected) return
    setAdding(true)
    setError('')
    const mod = catalogue.find(c => c.code === selected)
    try {
      const res = await fetch(`${API}/api/teacher/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: teacherId, code: mod.code, name: mod.name, color: mod.color }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add module')
      setModules(prev => [...prev, data])
      setShowModal(false)
      setSelected('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Remove this module?')) return
    await fetch(`${API}/api/teacher/modules/${id}`, { method: 'DELETE' })
    setModules(prev => prev.filter(m => m.id !== id))
  }

  return (
    <>
      <Navbar />
      <div className="td-container">
        <div className="td-hero">
          <h1 className="td-title">
            Hello, <span className="td-name">{name}</span>
          </h1>
          <p className="td-subtitle">Manage your modules and students</p>
        </div>

        <div className="td-content">
          {modules.length === 0 ? (
            <div className="td-empty">
              <span className="td-empty-icon">📭</span>
              <p>You haven't added any modules yet.</p>
              <button className="td-add-btn" onClick={() => setShowModal(true)}>+ Add your first module</button>
            </div>
          ) : (
            <>
              <div className="td-grid">
                {modules.map((mod, i) => (
                  <div
                    key={mod.id}
                    className="td-card"
                    style={{ '--mod-color': mod.color || MODULE_COLORS[i % MODULE_COLORS.length] }}
                    onClick={() => navigate(`/teacher/module/${mod.id}`, { state: { ...state, module: mod } })}
                  >
                    <div className="td-card-accent" />
                    <div className="td-card-body">
                      <span className="td-card-code">{mod.code}</span>
                      <span className="td-card-name">{mod.name}</span>
                      <span className="td-card-hint">Click to manage students →</span>
                    </div>
                    <button className="td-card-remove" onClick={(e) => handleRemove(e, mod.id)} title="Remove module">✕</button>
                  </div>
                ))}

                <button className="td-card td-card-add" onClick={() => setShowModal(true)}>
                  <span className="td-add-icon">+</span>
                  <span className="td-add-label">Add Module</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Module Modal */}
      {showModal && (
        <div className="td-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="td-modal" onClick={e => e.stopPropagation()}>
            <h3 className="td-modal-title">Add a Module</h3>
            <p className="td-modal-sub">Select from the available modules below</p>

            <div className="td-module-list">
              {availableCatalogue.length === 0 && (
                <p className="td-modal-empty">All modules have been added already.</p>
              )}
              {availableCatalogue.map(mod => (
                <button
                  key={mod.code}
                  className={`td-module-option ${selected === mod.code ? 'td-module-selected' : ''}`}
                  style={{ '--mod-color': mod.color }}
                  onClick={() => setSelected(mod.code)}
                >
                  <span className="td-opt-dot" style={{ background: mod.color }} />
                  <span className="td-opt-code">{mod.code}</span>
                  <span className="td-opt-name">{mod.name}</span>
                </button>
              ))}
            </div>

            {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}

            <div className="td-modal-actions">
              <button className="td-modal-cancel" onClick={() => { setShowModal(false); setSelected(''); setError('') }}>
                Cancel
              </button>
              <button className="td-modal-confirm" disabled={!selected || adding} onClick={handleAdd}>
                {adding ? 'Adding…' : 'Add Module'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default TeacherDashboard
