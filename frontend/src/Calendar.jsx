import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import './Calendar.css'

const API = import.meta.env.VITE_API_URL
const MODULE_CODES = ['CS101', 'MA201', 'PH301', 'CS310', 'AI401', 'DB220']
const TYPE_COLOR = {
  test:       '#f87171',
  quiz:       '#fbbf24',
  assignment: '#818cf8',
  deadline:   '#9ca3af',
}

function toKey(dateStr) {
  const d = new Date(dateStr)
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`
}

function Calendar() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state
  const isTeacher = state?.role === 'teacher'
  const today = new Date()
  const [current, setCurrent]   = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [allItems, setAllItems] = useState([])

  useEffect(() => {
    const userId = state?.id
    if (!userId) return
    Promise.all(
      MODULE_CODES.map(code =>
        fetch(`${API}/api/modules/${code}/items?user_id=${userId}`)
          .then(r => r.json())
          .then(data => Array.isArray(data) ? data : [])
      )
    ).then(results => setAllItems(results.flat()))
      .catch(console.error)
  }, [state?.id])

  const year        = current.getFullYear()
  const month       = current.getMonth()
  const monthName   = current.toLocaleString('default', { month: 'long' })
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prev = () => setCurrent(new Date(year, month - 1, 1))
  const next = () => setCurrent(new Date(year, month + 1, 1))

  const isToday = (d) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  const itemsByDay = {}
  allItems.forEach(item => {
    const key = toKey(item.due_date)
    if (!itemsByDay[key]) itemsByDay[key] = []
    itemsByDay[key].push(item)
  })

  const dayKey   = (d) => `${year}-${month + 1}-${d}`
  const dayItems = (d) => itemsByDay[dayKey(d)] || []

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <>
      <Navbar />
      <div className="cal-container">
        <div className="cal-card">
          <div className="cal-header">
            <button className="cal-nav" onClick={prev}>&#8592;</button>
            <span className="cal-title">{monthName} {year}</span>
            <button className="cal-nav" onClick={next}>&#8594;</button>
          </div>

          <div className="cal-grid">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="cal-day-label">{d}</div>
            ))}
            {cells.map((d, i) => {
              const items = d ? dayItems(d) : []
              return (
                <div
                  key={i}
                  className={[
                    'cal-cell',
                    d ? 'cal-cell-active' : 'cal-cell-empty',
                    isToday(d) ? 'cal-today' : '',
                  ].join(' ')}
                >
                  {d && <span className="cal-day-num">{d}</span>}
                  {items.map((item, j) => (
                    <div
                      key={j}
                      className="cal-item-chip"
                      style={{ borderLeftColor: TYPE_COLOR[item.type] || '#6b7280' }}
                      onClick={() => navigate(`/module/${item.module_code}`, { state })}
                      title={item.title}
                    >
                      <span className="cal-chip-code">{item.module_code}</span>
                      <span className="cal-chip-title">{item.title}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          <button className="cal-back" onClick={() => navigate(isTeacher ? '/teacher/dashboard' : '/dashboard', { state })}>
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </>
  )
}

export default Calendar

