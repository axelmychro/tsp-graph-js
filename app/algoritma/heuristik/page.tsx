'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface City {
  id: number
  x: number
  y: number
  name: string
}

interface StepFrame {
  route: number[]
  swappedEdge: [number, number] | null
  phase: 'nearest-neighbor' | '2-opt' | 'done'
  distance: number
}

// ── Algorithm ────────────────────────────────────────────────────────────────

function dist(a: City, b: City) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function totalDistance(cities: City[], route: number[]) {
  let d = 0
  for (let i = 0; i < route.length; i++)
    d += dist(cities[route[i]], cities[route[(i + 1) % route.length]])
  return d
}

function nearestNeighbor(cities: City[]): number[] {
  const n = cities.length
  const visited = new Array(n).fill(false)
  const route = [0]
  visited[0] = true
  for (let s = 1; s < n; s++) {
    const last = route[route.length - 1]
    let best = -1, bestDist = Infinity
    for (let j = 0; j < n; j++) {
      if (!visited[j]) {
        const d = dist(cities[last], cities[j])
        if (d < bestDist) { bestDist = d; best = j }
      }
    }
    route.push(best)
    visited[best] = true
  }
  return route
}

function buildFrames(cities: City[]): StepFrame[] {
  const nnRoute = nearestNeighbor(cities)
  const frames: StepFrame[] = [{
    route: [...nnRoute],
    swappedEdge: null,
    phase: 'nearest-neighbor',
    distance: totalDistance(cities, nnRoute),
  }]

  let route = [...nnRoute]
  const n = route.length
  let improved = true

  while (improved) {
    improved = false
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue
        const a = route[i], b = route[i + 1], c = route[j], d = route[(j + 1) % n]
        const before = dist(cities[a], cities[b]) + dist(cities[c], cities[d])
        const after  = dist(cities[a], cities[c]) + dist(cities[b], cities[d])
        if (after < before - 0.001) {
          const newRoute = [...route]
          let lo = i + 1, hi = j
          while (lo < hi) {
            ;[newRoute[lo], newRoute[hi]] = [newRoute[hi], newRoute[lo]]
            lo++; hi--
          }
          route = newRoute
          improved = true
          frames.push({
            route: [...route],
            swappedEdge: [a, c],
            phase: '2-opt',
            distance: totalDistance(cities, route),
          })
        }
      }
    }
  }

  frames.push({ route: [...route], swappedEdge: null, phase: 'done', distance: totalDistance(cities, route) })
  return frames
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CITY_NAMES = [
  'Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta',
  'Iota','Kappa','Lambda','Mu','Nu','Xi','Omicron','Pi','Rho','Sigma',
]

const PAD = 40

// ── Component ─────────────────────────────────────────────────────────────────

export default function HeuristicPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [cities,    setCities]    = useState<City[]>([])
  const [frames,    setFrames]    = useState<StepFrame[]>([])
  const [frameIdx,  setFrameIdx]  = useState(0)
  const [playing,   setPlaying]   = useState(false)
  const [speed,     setSpeed]     = useState(300)   // ms per frame
  const [phase,     setPhase]     = useState<'idle' | 'ready' | 'done'>('idle')

  // ── Sync canvas internal resolution to its CSS size once on mount ────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width  = Math.round(width)
    canvas.height = Math.round(height)
    // trigger idle placeholder text
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    ctx.font = '14px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('click to place cities', canvas.width / 2, canvas.height / 2)
  }, [])

  // ── Canvas draw ──────────────────────────────────────────────────────────

  const draw = useCallback((frame: StepFrame | null, citiesSnap: City[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height

    ctx.clearRect(0, 0, W, H)

    if (citiesSnap.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.font = '14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('click to place cities', W / 2, H / 2)
      return
    }

    // always draw city dots + labels (idle state too)
    citiesSnap.forEach((c) => {
      ctx.beginPath()
      ctx.arc(c.x, c.y, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#0b0f1a'
      ctx.fill()
      ctx.strokeStyle = '#60a5fa'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(c.name, c.x, c.y - 10)
    })

    if (!frame) return

    const { route, swappedEdge } = frame

    // draw edges
    for (let i = 0; i < route.length; i++) {
      const a = citiesSnap[route[i]]
      const b = citiesSnap[route[(i + 1) % route.length]]

      const isSwapped = swappedEdge && (
        (route[i] === swappedEdge[0] || route[i] === swappedEdge[1]) &&
        (route[(i + 1) % route.length] === swappedEdge[0] || route[(i + 1) % route.length] === swappedEdge[1])
      )

      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = isSwapped ? '#f59e0b' : frame.phase === 'done' ? '#34d399' : '#60a5fa'
      ctx.lineWidth   = isSwapped ? 2.5 : 1.5
      ctx.globalAlpha = isSwapped ? 1 : 0.6
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // draw cities on top of edges
    citiesSnap.forEach((c) => {
      ctx.beginPath()
      ctx.arc(c.x, c.y, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#0b0f1a'
      ctx.fill()
      ctx.strokeStyle = '#60a5fa'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(c.name, c.x, c.y - 10)
    })
  }, [])

  // ── Redraw on frame change ───────────────────────────────────────────────

  useEffect(() => {
    if (frames.length === 0) {
      draw(null, cities)
    } else {
      draw(frames[frameIdx], cities)
    }
  }, [frameIdx, frames, cities, draw])

  // ── Idle state: draw just cities ─────────────────────────────────────────

  useEffect(() => {
    if (frames.length === 0) draw(null, cities)
  }, [cities, frames, draw])

  // ── Animation loop ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!playing) return
    animRef.current = setTimeout(() => {
      setFrameIdx((i) => {
        if (i >= frames.length - 1) {
          setPlaying(false)
          setPhase('done')
          return i
        }
        return i + 1
      })
    }, speed)
    return () => { if (animRef.current) clearTimeout(animRef.current) }
  }, [playing, frameIdx, frames, speed])

  // ── Canvas click → add city ──────────────────────────────────────────────

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (phase !== 'idle') return
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top)  * scaleY
    setCities((prev) => {
      if (prev.length >= CITY_NAMES.length) return prev
      return [...prev, { id: prev.length, x, y, name: CITY_NAMES[prev.length] }]
    })
  }

  // ── Controls ─────────────────────────────────────────────────────────────

  const handleRun = () => {
    if (cities.length < 3) return
    const f = buildFrames(cities)
    setFrames(f)
    setFrameIdx(0)
    setPhase('ready')
    setPlaying(true)
  }

  const handleStepBack = () => {
    setPlaying(false)
    setFrameIdx((i) => Math.max(0, i - 1))
  }

  const handleStepFwd = () => {
    setPlaying(false)
    setFrameIdx((i) => {
      const next = Math.min(frames.length - 1, i + 1)
      if (next === frames.length - 1) setPhase('done')
      return next
    })
  }

  const handleReset = () => {
    setPlaying(false)
    setCities([])
    setFrames([])
    setFrameIdx(0)
    setPhase('idle')
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  const currentFrame = frames[frameIdx]
  const progress = frames.length > 1 ? (frameIdx / (frames.length - 1)) * 100 : 0

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <div style={s.header}>
        <div>
          <div style={s.tag}>TSP · Heuristic</div>
          <h1 style={s.title}>Nearest Neighbour + 2-opt</h1>
        </div>
        <a href="/" style={s.back}>← back</a>
      </div>

      {/* ── Main ── */}
      <div style={s.main}>

        {/* Canvas */}
        <div style={s.canvasWrap}>
          <canvas
            ref={canvasRef}
            width={700}
            height={480}
            style={{ ...s.canvas, cursor: phase === 'idle' ? 'crosshair' : 'default' }}
            onClick={handleCanvasClick}
          />

          {/* Phase badge */}
          {currentFrame && (
            <div style={{
              ...s.badge,
              background: currentFrame.phase === 'done' ? '#065f46' :
                          currentFrame.phase === '2-opt' ? '#78350f' : '#1e3a5f',
            }}>
              {currentFrame.phase === 'nearest-neighbor' ? 'Nearest Neighbour'
                : currentFrame.phase === '2-opt' ? '2-opt swap'
                : '✓ Optimised'}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={s.sidebar}>

          {/* Stats */}
          <div style={s.card}>
            <div style={s.cardLabel}>Cities</div>
            <div style={s.stat}>{cities.length}</div>

            <div style={s.cardLabel} >Distance</div>
            <div style={s.stat}>
              {currentFrame ? currentFrame.distance.toFixed(1) : '—'}
              <span style={s.unit}> px</span>
            </div>

            <div style={s.cardLabel}>Frame</div>
            <div style={s.stat}>
              {frames.length > 0 ? `${frameIdx + 1} / ${frames.length}` : '—'}
            </div>

            <div style={s.cardLabel}>2-opt swaps</div>
            <div style={s.stat}>
              {frames.filter(f => f.phase === '2-opt').length || '—'}
            </div>
          </div>

          {/* Progress bar */}
          {frames.length > 0 && (
            <div style={s.progressWrap}>
              <div style={{ ...s.progressBar, width: `${progress}%` }} />
            </div>
          )}

          {/* Controls */}
          <div style={s.controls}>
            {phase === 'idle' && (
              <button style={s.btnPrimary} onClick={handleRun} disabled={cities.length < 3}>
                ▶ Run
              </button>
            )}

            {phase !== 'idle' && (
              <>
                <div style={s.btnRow}>
                  <button style={s.btnSm} onClick={handleStepBack} disabled={frameIdx === 0}>‹ Prev</button>
                  <button style={s.btnSm} onClick={() => setPlaying(p => !p)}>
                    {playing ? '⏸' : '▶'}
                  </button>
                  <button style={s.btnSm} onClick={handleStepFwd} disabled={frameIdx === frames.length - 1}>Next ›</button>
                </div>

                <div style={s.speedRow}>
                  <span style={s.speedLabel}>Speed</span>
                  <input
                    type="range" min={50} max={800} step={50}
                    value={800 - speed + 50}
                    onChange={e => setSpeed(800 - Number(e.target.value) + 50)}
                    style={{ flex: 1, accentColor: '#60a5fa' }}
                  />
                </div>
              </>
            )}

            <button style={s.btnGhost} onClick={handleReset}>↺ Reset</button>
          </div>

          {/* Legend */}
          <div style={s.legend}>
            <div style={s.legendItem}><span style={{ ...s.dot, background: '#60a5fa' }} /> NN route</div>
            <div style={s.legendItem}><span style={{ ...s.dot, background: '#f59e0b' }} /> 2-opt swap</div>
            <div style={s.legendItem}><span style={{ ...s.dot, background: '#34d399' }} /> Final route</div>
          </div>

          {/* How it works */}
          <div style={s.explainer}>
            <b style={{ color: '#94a3b8' }}>How it works</b>
            <p>
              <b>Step 1 — Nearest Neighbour:</b> start at city 0, greedily visit the closest unvisited city.
            </p>
            <p>
              <b>Step 2 — 2-opt:</b> repeatedly try reversing segments of the route. If a swap shortens the total distance, keep it. Repeat until no improvement is found.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0b0f1a',
    color: 'white',
    fontFamily: 'monospace',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 24px',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  tag: {
    fontSize: 11,
    letterSpacing: 2,
    color: '#60a5fa',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 1,
  },
  back: {
    color: '#60a5fa',
    textDecoration: 'none',
    fontSize: 13,
    opacity: 0.7,
  },
  main: {
    display: 'flex',
    gap: 20,
    flex: 1,
    flexWrap: 'wrap',
  },
  canvasWrap: {
    position: 'relative',
    flex: '1 1 500px',
  },
  canvas: {
    background: '#111827',
    borderRadius: 12,
    border: '1px solid #1f2937',
    display: 'block',
    width: '100%',
    height: '480px',
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  sidebar: {
    flex: '0 0 220px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  card: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 10,
    padding: '14px 16px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    rowGap: 8,
  },
  cardLabel: {
    fontSize: 10,
    color: '#6b7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
    alignSelf: 'end',
  },
  stat: {
    fontSize: 20,
    fontWeight: 700,
    color: '#f9fafb',
    textAlign: 'right',
  },
  unit: {
    fontSize: 11,
    color: '#6b7280',
  },
  progressWrap: {
    height: 4,
    background: '#1f2937',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: '#3b82f6',
    borderRadius: 4,
    transition: 'width 0.15s',
  },
  controls: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  btnPrimary: {
    background: '#3b82f6',
    border: 'none',
    borderRadius: 8,
    color: 'white',
    fontWeight: 700,
    fontFamily: 'monospace',
    padding: '10px 0',
    cursor: 'pointer',
    fontSize: 14,
    letterSpacing: 1,
  },
  btnRow: {
    display: 'flex',
    gap: 6,
  },
  btnSm: {
    flex: 1,
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: 7,
    color: 'white',
    fontFamily: 'monospace',
    padding: '7px 0',
    cursor: 'pointer',
    fontSize: 12,
  },
  btnGhost: {
    background: 'transparent',
    border: '1px solid #374151',
    borderRadius: 7,
    color: '#9ca3af',
    fontFamily: 'monospace',
    padding: '7px 0',
    cursor: 'pointer',
    fontSize: 12,
  },
  speedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  speedLabel: {
    fontSize: 10,
    color: '#6b7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  legend: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    fontSize: 11,
    color: '#9ca3af',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  explainer: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 1.6,
    borderTop: '1px solid #1f2937',
    paddingTop: 12,
  },
}
