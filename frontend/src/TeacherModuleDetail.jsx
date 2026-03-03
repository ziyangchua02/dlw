import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Navbar from './Navbar'
import supabase from './supabase'
import './TeacherDashboard.css'

const API = import.meta.env.VITE_API_URL

const TYPE_ICON = { test: '📝', quiz: '✏️', assignment: '📋', deadline: '⏰' }

function daysUntil(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'Overdue'
  if (diff === 0) return 'Today'
  return `In ${diff}d`
}

// ── Per-item sample answer upload component ────────────────────────────────
function SampleUpload({ item, moduleCode }) {
  const fileRef = useRef(null)
  const [sample, setSample]       = useState(null)   // { url, file_name } or null
  const [status, setStatus]       = useState('idle') // idle | loading | uploading | done | error
  const [errMsg, setErrMsg]       = useState('')
  const [showText, setShowText]   = useState(false)
  const [extracted, setExtracted] = useState(null)   // null | '' | 'loading' | text string
  const [textErr, setTextErr]     = useState('')

  // Load existing sample on mount
  useEffect(() => {
    setStatus('loading')
    fetch(`${API}/api/submissions/sample?item_id=${item.id}`)
      .then(r => r.json())
      .then(data => { setSample(data); setStatus('idle') })
      .catch(() => setStatus('idle'))
  }, [item.id])

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.type !== 'application/pdf') { setErrMsg('PDF only'); return }
    setStatus('uploading')
    setErrMsg('')
    setExtracted(null)
    setShowText(false)

    try {
      const filePath = `sample-answers/${moduleCode}/${item.id}/${Date.now()}_${file.name}`
      const { error: uploadErr } = await supabase.storage
        .from('submissions')
        .upload(filePath, file, { contentType: 'application/pdf', upsert: true })
      if (uploadErr) throw new Error(uploadErr.message)

      const res = await fetch(`${API}/api/submissions/sample`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, module_code: moduleCode, file_path: filePath, file_name: file.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      // Get signed URL to show link immediately
      const urlRes = await fetch(`${API}/api/submissions/sample?item_id=${item.id}`)
      const urlData = await urlRes.json()
      setSample(urlData)
      setStatus('idle')
    } catch (err) {
      setErrMsg(err.message)
      setStatus('idle')
    } finally {
      e.target.value = ''
    }
  }

  const handleRemove = async () => {
    if (!confirm('Remove this sample answer?')) return
    await fetch(`${API}/api/submissions/sample?item_id=${item.id}`, { method: 'DELETE' })
    setSample(null)
    setExtracted(null)
    setShowText(false)
  }

  const handleToggleText = async () => {
    if (showText) { setShowText(false); return }
    setShowText(true)
    if (extracted !== null) return  // already fetched
    setExtracted('loading')
    setTextErr('')
    try {
      const r = await fetch(`${API}/api/submissions/sample/text?item_id=${item.id}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to extract text')
      setExtracted(d.text || '(No text found in PDF)')
    } catch (err) {
      setTextErr(err.message)
      setExtracted(null)
    }
  }

  if (status === 'loading') return <span className="td-sample-status">…</span>

  return (
    <div className="td-sample-wrap">
      {sample ? (
        <>
          <a href={sample.url} target="_blank" rel="noopener noreferrer" className="td-sample-link">
            📄 {sample.file_name}
          </a>
          <button className="td-sample-remove" onClick={handleRemove} title="Remove sample">✕</button>
          <button className="td-extract-btn" onClick={handleToggleText}>
            {showText ? '▲ Hide text' : '🔍 View text'}
          </button>
        </>
      ) : (
        <button
          className="td-sample-upload-btn"
          disabled={status === 'uploading'}
          onClick={() => fileRef.current.click()}
        >
          {status === 'uploading' ? 'Uploading…' : '📎 Upload Sample'}
        </button>
      )}
      <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFile} />
      {errMsg && <span className="td-sample-err">{errMsg}</span>}
      {showText && (
        <div className="td-extracted-text">
          {extracted === 'loading'
            ? <span className="td-sample-status">Extracting text…</span>
            : textErr
              ? <span className="td-sample-err">{textErr}</span>
              : <pre className="td-extracted-pre">{extracted}</pre>
          }
        </div>
      )}
    </div>
  )
}

// ── Per-item question paper upload component ───────────────────────────────
function QuestionUpload({ item, moduleCode }) {
  const fileRef = useRef(null)
  const [question, setQuestion] = useState(null)   // { url, file_name } or null
  const [status, setStatus]     = useState('idle') // idle | loading | uploading | error
  const [errMsg, setErrMsg]     = useState('')

  // Load existing question on mount
  useEffect(() => {
    setStatus('loading')
    fetch(`${API}/api/submissions/question?item_id=${item.id}`)
      .then(r => r.json())
      .then(data => { setQuestion(data); setStatus('idle') })
      .catch(() => setStatus('idle'))
  }, [item.id])

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.type !== 'application/pdf') { setErrMsg('PDF only'); return }
    setStatus('uploading')
    setErrMsg('')

    try {
      const filePath = `questions/${moduleCode}/${item.id}/${Date.now()}_${file.name}`
      const { error: uploadErr } = await supabase.storage
        .from('submissions')
        .upload(filePath, file, { contentType: 'application/pdf', upsert: true })
      if (uploadErr) throw new Error(uploadErr.message)

      const res = await fetch(`${API}/api/submissions/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, question_path: filePath, question_file_name: file.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      // Refresh signed URL to show link immediately
      const urlRes = await fetch(`${API}/api/submissions/question?item_id=${item.id}`)
      const urlData = await urlRes.json()
      setQuestion(urlData)
      setStatus('idle')
    } catch (err) {
      setErrMsg(err.message)
      setStatus('idle')
    } finally {
      e.target.value = ''
    }
  }

  const handleRemove = async () => {
    if (!confirm('Remove this question paper?')) return
    await fetch(`${API}/api/submissions/question?item_id=${item.id}`, { method: 'DELETE' })
    setQuestion(null)
  }

  if (status === 'loading') return <span className="td-sample-status">…</span>

  return (
    <div className="td-question-wrap">
      {question ? (
        <>
          <a href={question.url} target="_blank" rel="noopener noreferrer" className="td-question-link">
            📋 {question.file_name}
          </a>
          <button className="td-sample-remove" onClick={handleRemove} title="Remove question paper">✕</button>
        </>
      ) : (
        <button
          className="td-question-upload-btn"
          disabled={status === 'uploading'}
          onClick={() => fileRef.current.click()}
        >
          {status === 'uploading' ? 'Uploading…' : '📤 Upload Questions'}
        </button>
      )}
      <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFile} />
      {errMsg && <span className="td-sample-err">{errMsg}</span>}
    </div>
  )
}

function TeacherModuleDetail() {
  const { id } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const mod = state?.module
  const teacherState = state

  // ── Students state ────────────────────────────────────────────────────
  const [students, setStudents]             = useState([])
  const [allStudents, setAllStudents]       = useState([])
  const [studentsLoaded, setStudentsLoaded] = useState(false)
  const [query, setQuery]                   = useState('')
  const [dropdownOpen, setDropdownOpen]     = useState(false)
  const [adding, setAdding]                 = useState(null)
  const [enrollError, setEnrollError]       = useState('')
  const dropdownRef = useRef(null)

  // ── Items state ───────────────────────────────────────────────────────
  const [items, setItems]         = useState([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [showAddForm, setShowAddForm]   = useState(false)
  const [newTitle, setNewTitle]         = useState('')
  const [newType, setNewType]           = useState('assignment')
  const [newDue, setNewDue]             = useState('')
  const [addingItem, setAddingItem]     = useState(false)
  const [itemError, setItemError]       = useState('')

  // ── Fetch enrolled students ───────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/teacher/modules/${id}/students`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setStudents(data) })
      .catch(() => {})
  }, [id])

  // ── Pre-load all students for dropdown ───────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/teacher/students/search`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAllStudents(data)
        setStudentsLoaded(true)
      })
      .catch(() => { setStudentsLoaded(true) })
  }, [])

  // ── Fetch module items ────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/teacher/modules/${id}/items`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setItems(data) })
      .catch(() => {})
      .finally(() => setItemsLoading(false))
  }, [id])

  // ── Close dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Filtered student dropdown ─────────────────────────────────────────
  const enrolledIds = students.map(s => s.student_id)
  const filtered = allStudents
    .filter(s => !enrolledIds.includes(s.user_id))
    .filter(s => s.name?.toLowerCase().includes(query.toLowerCase()))

  // ── Enrol student ─────────────────────────────────────────────────────
  const handleAdd = async (student) => {
    setAdding(student.user_id)
    setEnrollError('')
    try {
      const res = await fetch(`${API}/api/teacher/modules/${id}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: student.user_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to enrol student')
      setStudents(prev => [
        ...prev,
        { student_id: student.user_id, profiles: { name: student.name, user_id: student.user_id } },
      ])
      setQuery('')
      setDropdownOpen(false)
    } catch (err) {
      setEnrollError(err.message)
    } finally {
      setAdding(null)
    }
  }

  // ── Remove student ────────────────────────────────────────────────────
  const handleRemove = async (studentId) => {
    if (!confirm('Remove this student from the module?')) return
    await fetch(`${API}/api/teacher/modules/${id}/students/${studentId}`, { method: 'DELETE' })
    setStudents(prev => prev.filter(s => s.student_id !== studentId))
  }

  // ── Add item ──────────────────────────────────────────────────────────
  const handleAddItem = async (e) => {
    e.preventDefault()
    if (!newTitle.trim() || !newDue) return
    setAddingItem(true)
    setItemError('')
    try {
      const res = await fetch(`${API}/api/teacher/modules/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), type: newType, due_date: newDue }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add item')
      setItems(prev => [...prev, data].sort((a, b) => new Date(a.due_date) - new Date(b.due_date)))
      setNewTitle('')
      setNewType('assignment')
      setNewDue('')
      setShowAddForm(false)
    } catch (err) {
      setItemError(err.message)
    } finally {
      setAddingItem(false)
    }
  }

  // ── Delete item ───────────────────────────────────────────────────────
  const handleDeleteItem = async (item) => {
    if (!confirm(`Delete "${item.title}" from this module?`)) return
    await fetch(`${API}/api/teacher/modules/${id}/items/${item.id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(it => it.id !== item.id))
  }

  return (
    <>
      <Navbar />
      <div className="td-container">
        <div className="td-detail-header">
          <button className="td-back" onClick={() => navigate('/teacher/dashboard', { state: teacherState })}>
            ← Dashboard
          </button>
          <div>
            <span className="td-detail-code" style={{ color: mod?.color || '#6366f1' }}>{mod?.code}</span>
            <h1 className="td-detail-title">{mod?.name}</h1>
          </div>
        </div>

        <div className="td-detail-body">

          {/* ── Module Items ── */}
          <div className="td-items-section">
            <div className="td-section-header">
              <h2 className="td-section-title">
                Module Content
                <span className="td-student-count">{items.length}</span>
              </h2>
              <button className="td-add-item-btn" onClick={() => { setShowAddForm(v => !v); setItemError('') }}>
                {showAddForm ? '✕ Cancel' : '+ Add Item'}
              </button>
            </div>

            {showAddForm && (
              <form className="td-add-form" onSubmit={handleAddItem}>
                <input
                  className="td-form-input"
                  placeholder="Title (e.g. Week 3 Quiz)"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                />
                <select
                  className="td-form-select"
                  value={newType}
                  onChange={e => setNewType(e.target.value)}
                >
                  <option value="assignment">📋 Assignment</option>
                  <option value="quiz">✏️ Quiz</option>
                  <option value="test">📝 Test</option>
                  <option value="deadline">⏰ Deadline</option>
                </select>
                <input
                  className="td-form-input"
                  type="date"
                  value={newDue}
                  onChange={e => setNewDue(e.target.value)}
                  required
                />
                <button className="td-enrol-btn" type="submit" disabled={addingItem}>
                  {addingItem ? 'Adding…' : 'Add to all students'}
                </button>
                {itemError && <p className="form-error">{itemError}</p>}
              </form>
            )}

            {itemsLoading ? (
              <p className="td-no-students">Loading…</p>
            ) : items.length === 0 ? (
              <p className="td-no-students">No items yet. Add assignments, quizzes or deadlines above.</p>
            ) : (
              <div className="td-item-list">
                {items.map(item => (
                  <div key={item.id} className="td-item-row">
                    <span className="td-item-icon">{TYPE_ICON[item.type] || '📌'}</span>
                    <div className="td-item-info">
                      <span className="td-item-title">{item.title}</span>
                      <span className="td-item-meta">
                        <span className={`td-item-type ${item.type}`}>{item.type}</span>
                        <span className="td-item-due">
                          Due {new Date(item.due_date).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </span>
                      <QuestionUpload item={item} moduleCode={mod?.code} />
                      <SampleUpload item={item} moduleCode={mod?.code} />
                    </div>
                    <span className="td-item-countdown">{daysUntil(item.due_date)}</span>
                    <button
                      className="td-remove-btn"
                      onClick={() => handleDeleteItem(item)}
                      title="Delete item"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Add Students ── */}
          <div className="td-search-section">
            <h2 className="td-section-title">Add Students</h2>
            <div className="td-dropdown-wrap" ref={dropdownRef}>
              <input
                className="td-search-input"
                placeholder="Type to search students…"
                value={query}
                onChange={e => { setQuery(e.target.value); setDropdownOpen(true) }}
                onFocus={() => setDropdownOpen(true)}
                autoComplete="off"
              />
              {dropdownOpen && (
                <div className="td-dropdown-list">
                  {filtered.length === 0 ? (
                    <div className="td-dropdown-empty">
                      {!studentsLoaded ? 'Loading students…' : 'No matching students'}
                    </div>
                  ) : (
                    filtered.map(s => (
                      <button
                        key={s.user_id}
                        className="td-dropdown-item"
                        disabled={adding === s.user_id}
                        onMouseDown={(e) => { e.preventDefault(); handleAdd(s) }}
                      >
                        <span className="td-dropdown-avatar">{(s.name || '?')[0].toUpperCase()}</span>
                        <span className="td-dropdown-name">{s.name}</span>
                        <span className="td-dropdown-action">
                          {adding === s.user_id ? 'Adding…' : '+ Enrol'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {enrollError && <p className="form-error" style={{ marginTop: 8 }}>{enrollError}</p>}
          </div>

          {/* ── Enrolled Students ── */}
          <div className="td-students-section">
            <h2 className="td-section-title">
              Enrolled Students
              <span className="td-student-count">{students.length}</span>
            </h2>
            {students.length === 0 ? (
              <p className="td-no-students">No students enrolled yet.</p>
            ) : (
              <div className="td-student-list">
                {students.map(s => (
                  <div key={s.student_id} className="td-student-row">
                    <div className="td-student-avatar">
                      {(s.profiles?.name || '?')[0].toUpperCase()}
                    </div>
                    <span className="td-student-name">{s.profiles?.name || s.student_id}</span>
                    <button
                      className="td-remove-btn"
                      onClick={() => handleRemove(s.student_id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}

export default TeacherModuleDetail
