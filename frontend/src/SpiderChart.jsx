function SpiderChart({ stats, color = '#6366f1' }) {
  const size = 120
  const cx = size / 2
  const cy = size / 2
  const r = 44
  const levels = 4
  const axes = stats.length

  function polarToXY(angle, radius) {
    const rad = (angle - 90) * (Math.PI / 180)
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    }
  }

  const angleStep = 360 / axes

  // Grid rings
  const rings = Array.from({ length: levels }, (_, i) => {
    const rr = (r * (i + 1)) / levels
    const pts = stats.map((_, idx) => {
      const p = polarToXY(idx * angleStep, rr)
      return `${p.x},${p.y}`
    })
    return pts.join(' ')
  })

  // Axis lines
  const axisLines = stats.map((_, idx) => {
    const end = polarToXY(idx * angleStep, r)
    return { x1: cx, y1: cy, x2: end.x, y2: end.y }
  })

  // Data polygon
  const dataPoints = stats.map((val, idx) => {
    const p = polarToXY(idx * angleStep, (val / 100) * r)
    return `${p.x},${p.y}`
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {rings.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {/* Axis lines */}
      {axisLines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {/* Data shape */}
      <polygon
        points={dataPoints.join(' ')}
        fill={`${color}33`}
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Data dots */}
      {stats.map((val, idx) => {
        const p = polarToXY(idx * angleStep, (val / 100) * r)
        return <circle key={idx} cx={p.x} cy={p.y} r="2.5" fill={color} />
      })}
    </svg>
  )
}

export default SpiderChart
