import { useState } from 'react'
import './QuizRevision.css'

const API = import.meta.env.VITE_API_URL

/**
 * QuizRevision
 * Props:
 *   session  — { id, topic, quiz_banks: { questions } }
 *   onClose  — called when modal is dismissed
 *   onDone   — called after session is completed (refreshes due list)
 */
function QuizRevision({ session, onClose, onDone }) {
  const questions = session?.quiz_banks?.questions || []
  const topic     = session?.topic || session?.quiz_banks?.topic || 'Revision Quiz'

  const [current, setCurrent]     = useState(0)
  const [selected, setSelected]   = useState(null)   // chosen option letter e.g. "A"
  const [revealed, setRevealed]   = useState(false)
  const [results, setResults]     = useState([])     // { correct: bool }[]
  const [finished, setFinished]   = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!questions.length) {
    return (
      <div className="qr-backdrop" onClick={onClose}>
        <div className="qr-modal" onClick={e => e.stopPropagation()}>
          <p style={{ color: '#9ca3af', padding: 32 }}>No questions found.</p>
          <button className="qr-close" onClick={onClose}>Close</button>
        </div>
      </div>
    )
  }

  const q = questions[current]
  const total = questions.length
  const correctCount = results.filter(r => r.correct).length

  const handleSelect = (letter) => {
    if (revealed) return
    setSelected(letter)
  }

  const handleReveal = () => {
    if (!selected) return
    setRevealed(true)
    setResults(prev => [...prev, { correct: selected === q.answer }])
  }

  const handleNext = () => {
    if (current + 1 < total) {
      setCurrent(c => c + 1)
      setSelected(null)
      setRevealed(false)
    } else {
      setFinished(true)
    }
  }

  const handleComplete = async () => {
    setSubmitting(true)
    const scorePct = Math.round((correctCount / total) * 100)
    try {
      await fetch(`${API}/api/quiz/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id, score_pct: scorePct }),
      })
    } catch (_) {}
    setSubmitting(false)
    onDone?.()
  }

  // ── Finished screen ──────────────────────────────────────────────────
  if (finished) {
    const pct = Math.round((correctCount / total) * 100)
    const color = pct >= 70 ? '#34d399' : pct >= 40 ? '#f59e0b' : '#f87171'
    return (
      <div className="qr-backdrop" onClick={onClose}>
        <div className="qr-modal" onClick={e => e.stopPropagation()}>
          <div className="qr-header">
            <span className="qr-topic">{topic}</span>
            <button className="qr-x" onClick={onClose}>✕</button>
          </div>
          <div className="qr-finish">
            <div className="qr-finish-score" style={{ color }}>{pct}%</div>
            <p className="qr-finish-label">{correctCount} / {total} correct</p>
            <p className="qr-finish-msg">
              {pct >= 70
                ? '🎉 Great job! Keep it up.'
                : pct >= 40
                  ? '👍 Good effort — keep reviewing!'
                  : '📚 Keep practising — you\'ll get there!'}
            </p>
            <div className="qr-finish-bar-track">
              <div className="qr-finish-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <p className="qr-sr-note">
              ✅ Session logged. Your next revision is scheduled using spaced repetition.
            </p>
            <button
              className="qr-complete-btn"
              onClick={handleComplete}
              disabled={submitting}
            >
              {submitting ? 'Saving…' : 'Done — back to dashboard'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Question screen ──────────────────────────────────────────────────
  const optionLetters = ['A', 'B', 'C', 'D']

  return (
    <div className="qr-backdrop" onClick={onClose}>
      <div className="qr-modal" onClick={e => e.stopPropagation()}>
        <div className="qr-header">
          <span className="qr-topic">{topic}</span>
          <button className="qr-x" onClick={onClose}>✕</button>
        </div>

        <div className="qr-progress-track">
          <div
            className="qr-progress-fill"
            style={{ width: `${((current) / total) * 100}%` }}
          />
        </div>
        <p className="qr-counter">Question {current + 1} of {total}</p>

        <p className="qr-question">{q.q}</p>

        <div className="qr-options">
          {(q.options || []).map((opt, i) => {
            const letter = optionLetters[i]
            let cls = 'qr-option'
            if (revealed) {
              if (letter === q.answer)         cls += ' correct'
              else if (letter === selected)    cls += ' wrong'
              else                             cls += ' dim'
            } else if (letter === selected) {
              cls += ' chosen'
            }
            return (
              <button key={letter} className={cls} onClick={() => handleSelect(letter)} disabled={revealed}>
                <span className="qr-opt-letter">{letter}</span>
                <span className="qr-opt-text">{opt.replace(/^[A-D]\)\s*/, '')}</span>
                {revealed && letter === q.answer && <span className="qr-tick">✓</span>}
                {revealed && letter === selected && letter !== q.answer && <span className="qr-cross">✗</span>}
              </button>
            )
          })}
        </div>

        {revealed && (
          <div className="qr-explanation">
            <strong>Explanation:</strong> {q.explanation}
          </div>
        )}

        <div className="qr-actions">
          {!revealed ? (
            <button className="qr-check-btn" onClick={handleReveal} disabled={!selected}>
              Check answer
            </button>
          ) : (
            <button className="qr-next-btn" onClick={handleNext}>
              {current + 1 < total ? 'Next question →' : 'See results'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default QuizRevision
