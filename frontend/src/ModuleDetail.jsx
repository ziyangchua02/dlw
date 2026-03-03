import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import Navbar from './Navbar'
import SpiderChart from './SpiderChart'
import supabase from './supabase'
import './ModuleDetail.css'

const API = import.meta.env.VITE_API_URL

// Static module meta (chart data, colors) — only items come from DB
const MODULE_META = {
  CS101: { name: 'Intro to Computer Science',         color: '#6366f1', stats: [80, 65, 90, 70, 55, 75], mastery: 73 },
  MA201: { name: 'Calculus & Linear Algebra',         color: '#a78bfa', stats: [60, 85, 50, 90, 70, 65], mastery: 68 },
  PH301: { name: 'Quantum Mechanics',                 color: '#34d399', stats: [75, 55, 80, 60, 95, 70], mastery: 72 },
  CS310: { name: 'Data Structures & Algorithms',      color: '#f59e0b', stats: [90, 70, 85, 75, 60, 80], mastery: 77 },
  AI401: { name: 'Machine Learning Fundamentals',     color: '#f87171', stats: [70, 80, 65, 85, 75, 90], mastery: 78 },
  DB220: { name: 'Database Systems',                  color: '#38bdf8', stats: [65, 75, 70, 55, 85, 60], mastery: 68 },
  SE302: { name: 'Software Engineering',              color: '#fb923c', stats: [75, 70, 80, 65, 70, 75], mastery: 73 },
  NW410: { name: 'Computer Networks',                 color: '#818cf8', stats: [70, 65, 75, 80, 60, 70], mastery: 70 },
  CY501: { name: 'Cybersecurity Fundamentals',        color: '#4ade80', stats: [80, 75, 70, 85, 65, 80], mastery: 76 },
  HCI210: { name: 'Human-Computer Interaction',       color: '#e879f9', stats: [85, 70, 75, 65, 80, 70], mastery: 74 },
}

const TYPE_ICON = { test: '📝', quiz: '✏️', assignment: '📋', deadline: '⏰' }

const STATUS_CLASS = { pending: 'status-pending', upcoming: 'status-upcoming', info: 'status-info' }

function daysUntil(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'Overdue'
  if (diff === 0) return 'Today'
  return `In ${diff}d`
}

// Shows a download link if teacher has uploaded a question paper for this item
function QuestionDownload({ itemId }) {
  const [question, setQuestion] = useState(null)

  useEffect(() => {
    fetch(`${API}/api/submissions/question?item_id=${itemId}`)
      .then(r => r.json())
      .then(data => { if (data?.url) setQuestion(data) })
      .catch(() => {})
  }, [itemId])

  if (!question) return null
  return (
    <a href={question.url} target="_blank" rel="noopener noreferrer" className="md-question-link">
      📋 Download Questions
    </a>
  )
}

// Shows a download link + collapsible extracted text for teacher's sample answer
function SampleAnswerLink({ itemId }) {
  const [sample, setSample]       = useState(null)
  const [showText, setShowText]   = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [textErr, setTextErr]     = useState('')

  useEffect(() => {
    fetch(`${API}/api/submissions/sample?item_id=${itemId}`)
      .then(r => r.json())
      .then(data => { if (data?.url) setSample(data) })
      .catch(() => {})
  }, [itemId])

  const handleToggleText = async () => {
    if (showText) { setShowText(false); return }
    setShowText(true)
    if (extracted !== null) return
    setExtracted('loading')
    setTextErr('')
    try {
      const r = await fetch(`${API}/api/submissions/sample/text?item_id=${itemId}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to extract text')
      setExtracted(d.text || '(No text found in PDF)')
    } catch (err) {
      setTextErr(err.message)
      setExtracted(null)
    }
  }

  if (!sample) return null
  return (
    <div className="md-sample-wrap">
      <a href={sample.url} target="_blank" rel="noopener noreferrer" className="md-sample-link">
        📄 Sample Answer
      </a>
      <button className="md-extract-btn" onClick={handleToggleText}>
        {showText ? '▲ Hide' : '🔍 View text'}
      </button>
      {showText && (
        <div className="md-extracted-text">
          {extracted === 'loading'
            ? <span className="md-extract-loading">Extracting text…</span>
            : textErr
              ? <span className="md-extract-err">{textErr}</span>
              : <pre className="md-extracted-pre">{extracted}</pre>
          }
        </div>
      )}
    </div>
  )
}

function AssignmentUpload({ itemId, moduleCode, userId, onSubmitted }) {
  const fileRef = useRef(null)
  const [file, setFile]             = useState(null)
  const [status, setStatus]         = useState('idle') // idle | uploading | grading | generating | done
  const [errMsg, setErrMsg]         = useState('')

  // Grade + quiz state
  const [gradeResult, setGradeResult] = useState(null)  // { percentage, feedback } | null
  const [quizReady, setQuizReady]     = useState(false)
  const [quizBankId, setQuizBankId]   = useState(null)

  // Helper: auto-grade then auto-generate quiz
  const autoGrade = async (filePath) => {
    setStatus('grading')
    try {
      const r = await fetch(`${API}/api/submissions/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, file_path: filePath }),
      })
      const d = await r.json()
      if (!r.ok || d.skipped) { setStatus('done'); return }
      setGradeResult(d)

      // Auto-generate personalised quiz bank
      if (userId) {
        setStatus('generating')
        try {
          const qr = await fetch(`${API}/api/quiz/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              item_id: itemId,
              module_code: moduleCode,
              student_id: userId,
              percentage: d.percentage,
              feedback: d.feedback,
              model_text: d.model_text,
              student_text: d.student_text,
            }),
          })
          const qd = await qr.json()
          if (qr.ok && qd.quiz_bank_id) {
            setQuizBankId(qd.quiz_bank_id)
            setQuizReady(true)
          }
        } catch (_) { /* quiz generation failure is non-fatal */ }
      }
    } catch (_) { /* grade failure is non-fatal */ }
    setStatus('done')
  }

  // Check on mount whether this item already has a submission + quiz
  useEffect(() => {
    fetch(`${API}/api/submissions?item_id=${itemId}`)
      .then(r => r.json())
      .then(data => {
        if (data) {
          setStatus('done')
          // Check if a quiz bank already exists
          if (userId) {
            fetch(`${API}/api/quiz/bank?item_id=${itemId}&student_id=${userId}`)
              .then(r => r.json())
              .then(qd => {
                if (qd?.id) { setQuizBankId(qd.id); setQuizReady(true) }
              })
              .catch(() => {})
          }
        }
      })
      .catch(() => {})
  }, [itemId, userId])

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (f && f.type === 'application/pdf') {
      setFile(f)
      setErrMsg('')
    } else {
      setErrMsg('Please select a PDF file.')
    }
  }

  const handleSubmit = async () => {
    if (!file || status === 'uploading') return
    setStatus('uploading')
    setErrMsg('')

    try {
      // 1. Upload PDF to Supabase Storage bucket "submissions"
      const filePath = `${moduleCode}/${itemId}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, file, { contentType: 'application/pdf', upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      // 2. Record metadata in the submissions table via backend
      const res = await fetch(`${API}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          module_code: moduleCode,
          file_path: filePath,
          file_name: file.name,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record submission.')

      // 3. Mark the item as done so the dashboard progress bar updates
      await fetch(`${API}/api/modules/${moduleCode}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      })

      onSubmitted?.(itemId)  // notify parent to update local items state
      await autoGrade(filePath)
    } catch (err) {
      setErrMsg(err.message)
      setStatus('idle')
    }
  }

  if (status === 'uploading' || status === 'grading' || status === 'generating') return (
    <div className="md-done-wrap">
      <div className="md-upload-done" style={{ color: '#a78bfa' }}>
        {status === 'uploading' ? '⬆️ Uploading…' : status === 'grading' ? '⏳ Grading…' : '🧠 Building your revision quiz…'}
      </div>
    </div>
  )

  if (status === 'done') return (
    <div className="md-done-wrap">
      <div className="md-upload-done">✓ Submitted</div>
      {gradeResult && (
        <div className="md-grade-result">
          <div className="md-grade-score-row">
            <span className="md-grade-label">Score</span>
            <span
              className="md-grade-score"
              style={{ color: gradeResult.percentage >= 70 ? '#34d399' : gradeResult.percentage >= 40 ? '#f59e0b' : '#f87171' }}
            >
              {gradeResult.percentage}%
            </span>
          </div>
          <div className="md-grade-bar-track">
            <div
              className="md-grade-bar-fill"
              style={{
                width: `${gradeResult.percentage}%`,
                background: gradeResult.percentage >= 70 ? '#34d399' : gradeResult.percentage >= 40 ? '#f59e0b' : '#f87171',
              }}
            />
          </div>
          <p className="md-grade-feedback">{gradeResult.feedback}</p>
        </div>
      )}
      {quizReady && (
        <div className="md-quiz-prompt">
          🎯 A personalised revision quiz has been added to your dashboard — review it tomorrow!
        </div>
      )}
    </div>
  )

  return (
    <div className="md-upload-row">
      <label className="md-upload-label" onClick={() => fileRef.current.click()}>
        {file ? file.name : '📎 Attach PDF'}
      </label>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <button
        className="md-submit-btn"
        disabled={!file || status === 'uploading'}
        onClick={handleSubmit}
      >
        {status === 'uploading' ? 'Uploading…' : 'Submit'}
      </button>
      {errMsg && <span className="md-upload-err">{errMsg}</span>}
    </div>
  )
}

function ModuleDetail() {
  const { code } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = location.state?.id
  // Use static meta if available, otherwise fall back to catalogue data passed via nav state
  const mod = MODULE_META[code] || (location.state?.moduleName
    ? { name: location.state.moduleName, color: location.state.moduleColor || '#6366f1', stats: [0,0,0,0,0,0], mastery: 0 }
    : null)

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Compute progress live from items state
  const totalItems     = items.length
  const completedItems = items.filter(it => it.status === 'done').length
  const progressPct    = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  // Called by AssignmentUpload after a successful submission
  const handleSubmitted = (itemId) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: 'done' } : it))
  }

  useEffect(() => {
    if (!userId) return
    fetch(`${API}/api/modules/${code}/items?user_id=${userId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setItems(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [code, userId])

  if (!mod) return (
    <>
      <Navbar />
      <div className="md-container"><p style={{ color: '#6b7280' }}>Module not found.</p></div>
    </>
  )

  return (
    <>
      <Navbar />
      <div className="md-container">
        <div className="md-inner">

          {/* Header */}
          <div className="md-header">
            <button className="md-back" onClick={() => navigate('/dashboard', { state: location.state })}>← Dashboard</button>
            <div className="md-title-block">
              <span className="md-code" style={{ color: mod.color }}>{code}</span>
              <h1 className="md-title">{mod.name}</h1>
            </div>
          </div>

          {/* Stats card */}
          <div className="md-stats-card">
            <div className="md-chart-wrap">
              <SpiderChart stats={mod.stats} color={mod.color} />
            </div>
            <div className="md-stats-right">
              <div className="md-stat-labels">
                {['Attendance','Performance','Assignments','Quizzes','Lab','Exam'].map((label, j) => (
                  <div key={label} className="md-stat-item">
                    <span className="md-stat-val" style={{ color: mod.color }}>{mod.stats[j]}</span>
                    <span className="md-stat-label">{label}</span>
                  </div>
                ))}
              </div>
              <div className="md-mastery">
                <div className="md-mastery-header">
                  <span className="md-mastery-label">Progress</span>
                  <span className="md-mastery-pct" style={{ color: mod.color }}>
                    {totalItems > 0 ? `${progressPct}%` : '—'}
                  </span>
                </div>
                <div className="md-mastery-track">
                  <div className="md-mastery-fill" style={{ width: `${progressPct}%`, background: mod.color }} />
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming items */}
          <h2 className="md-section-title">Upcoming</h2>

          {loading && <p className="md-status-msg">Loading…</p>}
          {error   && <p className="md-status-msg md-error">Failed to load: {error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="md-status-msg">No upcoming items for this module.</p>
          )}

          <div className="md-items">
            {items.map((item) => (
              <div key={item.id} className="md-item">
                <div className="md-item-icon">{TYPE_ICON[item.type] || '📌'}</div>
                <div className="md-item-info">
                  <span className="md-item-title">{item.title}</span>
                  <span className="md-item-meta">
                    <span className={`md-item-type ${item.type}`}>{item.type}</span>
                    <span className="md-item-due">Due {new Date(item.due_date).toLocaleDateString('default', { month: 'short', day: 'numeric' })}</span>
                  </span>
                  <QuestionDownload itemId={item.id} />
                  <AssignmentUpload itemId={item.id} moduleCode={code} userId={userId} onSubmitted={handleSubmitted} />
                </div>
                <span className={`md-item-countdown ${STATUS_CLASS[item.status] || 'status-info'}`}>
                  {daysUntil(item.due_date)}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  )
}

export default ModuleDetail
