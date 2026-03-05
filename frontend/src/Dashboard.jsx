import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import Navbar from './Navbar'
import SpiderChart from './SpiderChart'
import QuizRevision from './QuizRevision'
import './Dashboard.css'

// Static metadata — codes, names, colours (stats come from Supabase)
const MODULE_META = [
  { code: 'CS101', name: 'Intro to Computer Science' },
  { code: 'MA201', name: 'Calculus & Linear Algebra' },
  { code: 'PH301', name: 'Quantum Mechanics' },
  { code: 'CS310', name: 'Data Structures & Algorithms' },
  { code: 'AI401', name: 'Machine Learning Fundamentals' },
  { code: 'DB220', name: 'Database Systems' },
]

// Fallback stats used while loading or if DB has no row yet
const FALLBACK_STATS = {
  CS101: { stats: [80, 65, 90, 70, 55, 75], mastery: 73 },
  MA201: { stats: [60, 85, 50, 90, 70, 65], mastery: 68 },
  PH301: { stats: [75, 55, 80, 60, 95, 70], mastery: 72 },
  CS310: { stats: [90, 70, 85, 75, 60, 80], mastery: 77 },
  AI401: { stats: [70, 80, 65, 85, 75, 90], mastery: 78 },
  DB220: { stats: [65, 75, 70, 55, 85, 60], mastery: 68 },
}

const CHART_COLORS = ['#6366f1', '#a78bfa', '#34d399', '#f59e0b', '#f87171', '#38bdf8']

function Dashboard() {
  const { state: routeState } = useLocation()
  const navigate = useNavigate()

  // Persist session across page refreshes via sessionStorage
  const [state] = useState(() => {
    if (routeState?.id) return routeState
    try { return JSON.parse(sessionStorage.getItem('dlw_user') || 'null') } catch { return null }
  })

  const rawName = state?.name || state?.email || 'there'
  const name = rawName.includes('@') ? rawName.split('@')[0] : rawName

  const [modules, setModules] = useState(() =>
    MODULE_META.map(m => ({ ...m, ...(FALLBACK_STATS[m.code] || { stats: [0,0,0,0,0,0], mastery: 0 }) }))
  )
  const [progress, setProgress] = useState({}) // { CS101: { total: 5, completed: 3 }, … }
  const [teacherModules, setTeacherModules] = useState([])
  const [teacherModulesLoaded, setTeacherModulesLoaded] = useState(false)
  const [dueSessions, setDueSessions] = useState([])       // spaced repetition due today
  const [activeQuiz, setActiveQuiz]   = useState(null)     // session being done in modal
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  const API = import.meta.env.VITE_API_URL

  // Fetch live stats from Supabase via backend
  useEffect(() => {
    const userId = state?.id
    if (!userId) return
    fetch(`${API}/api/modules/stats?user_id=${userId}`)
      .then(r => r.json())
      .then(rows => {
        if (!Array.isArray(rows) || rows.length === 0) return
        setModules(MODULE_META.map(m => {
          const row = rows.find(r => r.module_code === m.code)
          if (!row) return { ...m, ...(FALLBACK_STATS[m.code] || { stats: [0,0,0,0,0,0], mastery: 0 }) }
          return {
            ...m,
            stats: [row.attendance, row.performance, row.assignments, row.quizzes, row.lab, row.exam],
            mastery: row.mastery,
          }
        }))
      })
      .catch(() => {/* keep fallback stats on network error */})
  }, [state?.id])

  // Fetch task completion progress for all modules
  useEffect(() => {
    const userId = state?.id
    if (!userId) return
    fetch(`${API}/api/modules/progress?user_id=${userId}`)
      .then(r => r.json())
      .then(map => { if (map && typeof map === 'object') setProgress(map) })
      .catch(() => {})
  }, [state?.id])

  // Fetch modules assigned by teachers
  useEffect(() => {
    const userId = state?.id
    if (!userId) return
    fetch(`${API}/api/teacher/student-modules?student_id=${userId}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTeacherModules(data) })
      .catch(() => {})
      .finally(() => setTeacherModulesLoaded(true))
  }, [state?.id])

  // Fetch spaced repetition sessions due today
  useEffect(() => {
    const userId = state?.id
    if (!userId) return
    fetch(`${API}/api/quiz/due?student_id=${userId}`)
      .then(r => r.json())
      .then(data => {
        console.log('[quiz/due] sessions:', data)
        if (Array.isArray(data)) setDueSessions(data)
      })
      .catch(err => console.error('[quiz/due] error:', err))
  }, [state?.id])

  useEffect(() => {
    if (messages.length === 0) return
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text) return

    const userMsg = { from: 'user', text }
    const updatedMessages = [...messages, userMsg]
    setMessages([...updatedMessages, { from: 'bot', text: '…', typing: true }])
    setInput('')

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, modules }),
      })
      const data = await res.json()
      setMessages([
        ...updatedMessages,
        { from: 'bot', text: data.reply || data.error || 'No response.' },
      ])
    } catch {
      setMessages([
        ...updatedMessages,
        { from: 'bot', text: 'Could not reach the AI — is the backend running?' },
      ])
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      <Navbar />
      <div className="dashboard-container">
        <div className="dashboard-hero">
          <h1 className="dashboard-title">
            Welcome back, <span className="dashboard-name">{name}</span>
          </h1>
          <p className="dashboard-subtitle">Here's an overview of your modules.</p>
        </div>

        {/* Quiz modal */}
        {activeQuiz && (
          <QuizRevision
            session={activeQuiz}
            onClose={() => setActiveQuiz(null)}
            onDone={() => {
              setActiveQuiz(null)
              // Remove completed session from list
              setDueSessions(prev => prev.filter(s => s.id !== activeQuiz.id))
            }}
          />
        )}

        <div className="dashboard-content">

        {/* ── Spaced Repetition revision widget ── */}
        {dueSessions.length > 0 && (
          <div className="revision-section">
            <h2 className="revision-heading">📅 Due for Revision Today</h2>
            <div className="revision-cards">
              {dueSessions.map(session => {
                const overdueDays = Math.floor(
                  (new Date() - new Date(session.next_due)) / (1000 * 60 * 60 * 24)
                )
                return (
                  <button
                    key={session.id}
                    className="revision-card"
                    onClick={() => setActiveQuiz(session)}
                  >
                    <div className="revision-card-icon">🧠</div>
                    <div className="revision-card-info">
                      <span className="revision-card-topic">{session.topic}</span>
                      <span className="revision-card-module">{session.module_code}</span>
                    </div>
                    <span className={`revision-card-badge ${overdueDays > 0 ? 'overdue' : 'due-today'}`}>
                      {overdueDays > 0 ? `${overdueDays}d overdue` : 'Due today'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="modules-grid">
          {modules
            .filter(mod => !teacherModulesLoaded || !teacherModules.some(e => e.teacher_modules?.code === mod.code))
            .map((mod) => {
              const i = MODULE_META.findIndex(m => m.code === mod.code)
              return (
            <div key={mod.code} className="module-card" onClick={() => navigate(`/module/${mod.code}`, { state })}>
              <div className="module-left">
                <SpiderChart stats={mod.stats} color={CHART_COLORS[i]} />
              </div>
              <div className="module-right">
                <span className="module-code">{mod.code}</span>
                <span className="module-name">{mod.name}</span>
                <div className="module-stats-row">
                  {['Att', 'Perf', 'Asgn', 'Quiz', 'Lab', 'Exam'].map((label, j) => (
                    <div key={label} className="module-stat">
                      <span className="stat-val" style={{ color: CHART_COLORS[i] }}>{mod.stats[j]}</span>
                      <span className="stat-label">{label}</span>
                    </div>
                  ))}
                </div>
                <div className="mastery-bar-wrap">
                  <div className="mastery-bar-header">
                    <span className="mastery-label">Progress</span>
                    <span className="mastery-pct" style={{ color: CHART_COLORS[i] }}>
                      {progress[mod.code]?.total > 0
                        ? `${Math.round((progress[mod.code].completed / progress[mod.code].total) * 100)}%`
                        : '—'}
                    </span>
                  </div>
                  <div className="mastery-track">
                    <div
                      className="mastery-fill"
                      style={{
                        width: progress[mod.code]?.total > 0
                          ? `${Math.round((progress[mod.code].completed / progress[mod.code].total) * 100)}%`
                          : '0%',
                        background: CHART_COLORS[i],
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        </div>

        {/* Teacher-assigned modules */}
        {teacherModules.length > 0 && (
          <div className="teacher-modules-section">
            <h2 className="teacher-modules-heading">Assigned by Your Teachers</h2>
            <div className="modules-grid">
              {teacherModules.map((enrolment) => {
                const tm = enrolment.teacher_modules
                if (!tm) return null
                return (
                  <div
                    key={tm.id}
                    className="module-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/module/${tm.code}`, { state: { ...state, moduleName: tm.name, moduleColor: tm.color } })}
                  >
                    <div className="module-left" style={{ background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                      <span style={{ fontSize: '2rem' }}>📚</span>
                    </div>
                    <div className="module-right">
                      <span className="module-code" style={{ color: tm.color || '#6366f1' }}>{tm.code}</span>
                      <span className="module-name">{tm.name}</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 6 }}>Assigned by teacher</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Chat box */}
        <div className="chat-box">
          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg chat-msg-${msg.from}${msg.typing ? ' typing' : ''}`}>
                {msg.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="chat-input-row">
            <textarea
              className="chat-input"
              rows={1}
              placeholder="Ask something…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
            />
            <button className="chat-send" onClick={send} disabled={!input.trim() || messages.some(m => m.typing)}>
              Send
            </button>
          </div>
        </div>
        </div>

      </div>
    </>
  )
}

export default Dashboard
