'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface City { id: number; lng: number; lat: number; label: string }

type NodeStatus = 'active' | 'pruned' | 'best' | 'explored'

interface TreeNode {
  id: number
  parent: number | null
  city: number
  depth: number
  status: NodeStatus
  children: number[]
}

interface BnBFrame {
  partialPath: number[]
  activeNodeId: number
  bound: number
  bestCost: number
  bestPath: number[]
  nodes: TreeNode[]
  action: 'explore' | 'prune' | 'update-best' | 'done'
  nodesExplored: number
  nodesPruned: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Haversine distance (km)
// ─────────────────────────────────────────────────────────────────────────────

function haversine(a: City, b: City): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

// ─────────────────────────────────────────────────────────────────────────────
// B&B Algorithm — builds all frames up front
// ─────────────────────────────────────────────────────────────────────────────

function buildDistMatrix(cities: City[]): number[][] {
  const n = cities.length
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => i === j ? 0 : haversine(cities[i], cities[j]))
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Perbaikan Perhitungan Lower Bound TSP yang Akurat
// ─────────────────────────────────────────────────────────────────────────────
function lowerBound(d: number[][], path: number[]): number {
  const n = d.length
  let cost = 0

  // 1. Hitung biaya pasti dari jalur yang sudah terpilih
  for (let k = 0; k < path.length - 1; k++) {
    cost += d[path[k]][path[k + 1]]
  }

  // Jika jalur sudah komplit, langsung kembalikan total rute + kembali ke kota awal
  if (path.length === n) {
    return cost + d[path[n - 1]][path[0]]
  }

  const visited = new Set(path)

  // 2. Hubungkan kota terakhir di jalur aktif ke kota terdekat yang belum dikunjungi
  const lastCity = path[path.length - 1]
  let minToUnvisited = Infinity
  for (let j = 0; j < n; j++) {
    if (!visited.has(j) && d[lastCity][j] < minToUnvisited) {
      minToUnvisited = d[lastCity][j]
    }
  }
  if (minToUnvisited !== Infinity) {
    cost += minToUnvisited
  }

  // 3. Untuk setiap kota tersisa yang belum dikunjungi, 
  // tambahkan sisi keluar minimumnya (tanpa dikali 0.5)
  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue

    let minOut = Infinity
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      
      // Sisi boleh mengarah ke kota yang belum dikunjungi, atau kembali ke kota awal (0)
      if (!visited.has(j) || j === path[0]) {
        if (d[i][j] < minOut) {
          minOut = d[i][j]
        }
      }
    }
    if (minOut !== Infinity) {
      cost += minOut // Menggunakan 100% nilai jarak asli
    }
  }

  return cost
}

// ─────────────────────────────────────────────────────────────────────────────
// Perbaikan Algoritma B&B Loop dengan Urutan DFS Cerdas + Pengaman
// ─────────────────────────────────────────────────────────────────────────────
function buildFrames(cities: City[]): BnBFrame[] {
  const n = cities.length
  const d = buildDistMatrix(cities)
  const frames: BnBFrame[] = []

  let nodeCounter = 0
  const nodesMap = new Map<number, TreeNode>()

  let bestCost = Infinity
  let bestPath: number[] = []
  let nodesExplored = 0
  let nodesPruned = 0

  const root: TreeNode = { id: nodeCounter++, parent: null, city: 0, depth: 0, status: 'active', children: [] }
  nodesMap.set(root.id, root)

  const stack: { path: number[]; nodeId: number }[] = [{ path: [0], nodeId: root.id }]

  while (stack.length > 0) {
    // PENGAMAN: Mencegah browser crash jika input terlalu masif (misal > 8 kota)
    if (frames.length > 3000) {
      console.warn("Mencapai batas maksimum visualisasi frame aman untuk mencegah browser hang.")
      break
    }

    const { path, nodeId } = stack.pop()!
    const node = nodesMap.get(nodeId)!
    nodesExplored++

    const bound = lowerBound(d, path)

    // Jika batas bawah lebih buruk dari solusi terbaik saat ini -> PRUNE!
    if (bound >= bestCost) {
      node.status = 'pruned'
      nodesPruned++
      frames.push(snap(nodesMap, path, nodeId, bound, bestCost, bestPath, 'prune', nodesExplored, nodesPruned))
      continue
    }

    node.status = 'explored'

    // Jika semua kota dikunjungi, periksa kecocokan rute terbaik
    if (path.length === n) {
      // Karena lowerBound versi baru mengembalikan nilai mutlak rute lengkap saat path.length === n
      if (bound < bestCost) {
        bestCost = bound
        bestPath = [...path, 0]
        nodesMap.forEach(nd => { if (nd.status === 'best') nd.status = 'explored' })
        node.status = 'best'
        frames.push(snap(nodesMap, path, nodeId, bound, bestCost, bestPath, 'update-best', nodesExplored, nodesPruned))
      } else {
        frames.push(snap(nodesMap, path, nodeId, bound, bestCost, bestPath, 'explore', nodesExplored, nodesPruned))
      }
      continue
    }

    frames.push(snap(nodesMap, path, nodeId, bound, bestCost, bestPath, 'explore', nodesExplored, nodesPruned))

    const unvisited = Array.from({ length: n }, (_, i) => i).filter(i => !path.includes(i))
    const currentCity = path[path.length - 1]

    // OPTIMASI DFS: Urutkan kota terdekat terlebih dahulu agar cepat menemukan bestCost awal yang rendah.
    // Diurutkan descending karena stack bersifat LIFO (Last In First Out).
    unvisited.sort((a, b) => d[currentCity][b] - d[currentCity][a])

    for (const city of unvisited) {
      const child: TreeNode = { id: nodeCounter++, parent: nodeId, city, depth: path.length, status: 'active', children: [] }
      nodesMap.set(child.id, child)
      node.children.push(child.id)
      stack.push({ path: [...path, city], nodeId: child.id })
    }
  }

  frames.push(snap(nodesMap, bestPath.slice(0, -1), -1, bestCost, bestCost, bestPath, 'done', nodesExplored, nodesPruned))
  return frames
}

function snap(
  nodesMap: Map<number, TreeNode>, path: number[], activeId: number,
  bound: number, bestCost: number, bestPath: number[],
  action: BnBFrame['action'], nodesExplored: number, nodesPruned: number
): BnBFrame {
  const nodes = Array.from(nodesMap.values()).map(n => ({ ...n, children: [...n.children] }))
  return { partialPath: [...path], activeNodeId: activeId, bound, bestCost, bestPath: [...bestPath], nodes, action, nodesExplored, nodesPruned }
}

// ─────────────────────────────────────────────────────────────────────────────
// Europe preset cities
// ─────────────────────────────────────────────────────────────────────────────

const EUROPE_PRESET: Omit<City, 'id'>[] = [
  { lng:  2.3522, lat: 48.8566, label: 'A' }, // Paris
  { lng: 13.4050, lat: 52.5200, label: 'B' }, // Berlin
  { lng: -3.7038, lat: 40.4168, label: 'C' }, // Madrid
  { lng: 12.4964, lat: 41.9028, label: 'D' }, // Rome
  { lng:  4.9041, lat: 52.3676, label: 'E' }, // Amsterdam
  { lng: 18.0686, lat: 59.3293, label: 'F' }, // Stockholm
  { lng: 16.3738, lat: 48.2082, label: 'G' }, // Vienna
]

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BranchAndBoundPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const markersRef   = useRef<maplibregl.Marker[]>([])
  const treeRef      = useRef<HTMLCanvasElement>(null)
  const animRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playingRef   = useRef(false)

  const [cities,   setCities]   = useState<City[]>([])
  const [frames,   setFrames]   = useState<BnBFrame[]>([])
  const [frameIdx, setFrameIdx] = useState(0)
  const [playing,  setPlaying]  = useState(false)
  const [speed,    setSpeed]    = useState(200)
  const [phase,    setPhase]    = useState<'idle' | 'running' | 'done'>('idle')

  // keep ref in sync so animation closure doesn't go stale
  useEffect(() => { playingRef.current = playing }, [playing])

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [10, 52],
      zoom: 3.8,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('click', (e) => {
      // only add in idle
      setCities(prev => {
        if (prev.length >= 8) return prev
        const id = prev.length
        const label = String.fromCharCode(65 + id)
        addMarker(e.lngLat.lng, e.lngLat.lat, label, map)
        return [...prev, { id, lng: e.lngLat.lng, lat: e.lngLat.lat, label }]
      })
    })

    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const addMarker = (lng: number, lat: number, label: string, map: maplibregl.Map) => {
    const el = document.createElement('div')
    el.innerHTML = `<div style="
      width:26px;height:26px;border-radius:50%;
      background:#14532d;border:2px solid #4ade80;
      display:flex;align-items:center;justify-content:center;
      color:#4ade80;font-family:'Courier New',monospace;font-size:11px;font-weight:bold;
      box-shadow:0 0 8px rgba(74,222,128,0.4);">${label}</div>`
    const marker = new maplibregl.Marker(el).setLngLat([lng, lat]).addTo(map)
    markersRef.current.push(marker)
  }

  const drawMapRoute = useCallback((frame: BnBFrame | null, snap: City[]) => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    // Remove existing layers/sources
    ;['bnb-best', 'bnb-partial'].forEach(id => {
      if (map.getLayer(id + '-line')) map.removeLayer(id + '-line')
      if (map.getSource(id)) map.removeSource(id)
    })

    if (!frame) return

    const toCoord = (i: number) => [snap[i].lng, snap[i].lat] as [number, number]

    // Best path
    if (frame.bestPath.length > 1) {
      const coords = frame.bestPath.map(i => toCoord(i))
      map.addSource('bnb-best', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } as any })
      map.addLayer({ id: 'bnb-best-line', type: 'line', source: 'bnb-best', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#22c55e', 'line-width': 2.5, 'line-opacity': 0.9 } })
    }

    // Partial path
    if (frame.partialPath.length > 1) {
      const coords = frame.partialPath.map(i => toCoord(i))
      const color = frame.action === 'prune' ? '#f97316' : '#facc15'
      map.addSource('bnb-partial', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } as any })
      map.addLayer({ id: 'bnb-partial-line', type: 'line', source: 'bnb-partial', layout: { 'line-join': 'round', 'line-cap': 'round', 'line-cap': 'round' }, paint: { 'line-color': color, 'line-width': 1.8, 'line-opacity': 0.8, 'line-dasharray': [2, 2] } })
    }
  }, [])

  // ── Tree canvas ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = treeRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      const { width, height } = canvas.getBoundingClientRect()
      canvas.width = Math.round(width)
      canvas.height = Math.round(height)
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  const drawTree = useCallback((frame: BnBFrame | null) => {
    const canvas = treeRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    if (!frame || frame.nodes.length === 0) {
      ctx.fillStyle = '#166534'
      ctx.font = '11px "Courier New"'
      ctx.textAlign = 'center'
      ctx.fillText('search tree appears here', W / 2, H / 2)
      return
    }

    const byDepth = new Map<number, TreeNode[]>()
    for (const n of frame.nodes) {
      if (!byDepth.has(n.depth)) byDepth.set(n.depth, [])
      byDepth.get(n.depth)!.push(n)
    }
    const maxDepth = Math.max(...frame.nodes.map(n => n.depth))
    const rowH = Math.max(30, Math.min(55, (H - 20) / (maxDepth + 1)))
    const pos = new Map<number, { x: number; y: number }>()

    byDepth.forEach((nodes, depth) => {
      nodes.forEach((n, idx) => {
        pos.set(n.id, { x: ((idx + 1) / (nodes.length + 1)) * W, y: 16 + depth * rowH })
      })
    })

    const col = (status: NodeStatus, active: boolean) => {
      if (active)                return '#facc15'
      if (status === 'pruned')   return '#ef4444'
      if (status === 'best')     return '#22c55e'
      if (status === 'explored') return '#374151'
      return '#1e3a2a'
    }

    // edges
    for (const n of frame.nodes) {
      if (n.parent === null) continue
      const f = pos.get(n.parent), t = pos.get(n.id)
      if (!f || !t) continue
      const active = n.id === frame.activeNodeId || n.parent === frame.activeNodeId
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y)
      ctx.strokeStyle = active ? 'rgba(250,204,21,0.5)' : 'rgba(55,65,81,0.4)'
      ctx.lineWidth = active ? 1.5 : 0.7
      ctx.stroke()
    }

    // nodes
    const R = Math.max(4, Math.min(9, rowH * 0.26))
    for (const n of frame.nodes) {
      const p = pos.get(n.id)
      if (!p) continue
      const active = n.id === frame.activeNodeId
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2)
      ctx.fillStyle = col(n.status, active); ctx.fill()
      if (active) {
        ctx.save(); ctx.shadowColor = '#facc15'; ctx.shadowBlur = 10
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.5; ctx.stroke()
        ctx.restore()
      }
      if (R >= 6) {
        ctx.fillStyle = active || n.status === 'best' ? '#0a0a0a' : '#9ca3af'
        ctx.font = `bold ${Math.round(R)}px "Courier New"`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(String.fromCharCode(65 + n.city), p.x, p.y)
        ctx.textBaseline = 'alphabetic'
      }
    }
  }, [])

  // ── Sync draw on frame change ──────────────────────────────────────────────
  useEffect(() => {
    const f = frames[frameIdx] ?? null
    drawTree(f)
    const map = mapRef.current
    if (map && map.isStyleLoaded()) {
      drawMapRoute(f, cities)
    } else if (map) {
      map.once('load', () => drawMapRoute(f, cities))
    }
  }, [frameIdx, frames, cities, drawTree, drawMapRoute])

  // ── Animation — uses refs to avoid stale closure loop ─────────────────────
  const framesRef  = useRef<BnBFrame[]>([])
  const frameIdxRef = useRef(0)
  const speedRef   = useRef(200)

  useEffect(() => { framesRef.current = frames }, [frames])
  useEffect(() => { frameIdxRef.current = frameIdx }, [frameIdx])
  useEffect(() => { speedRef.current = speed }, [speed])

  useEffect(() => {
    if (!playing) {
      if (animRef.current) clearTimeout(animRef.current)
      return
    }

    const tick = () => {
      if (!playingRef.current) return
      const next = frameIdxRef.current + 1
      if (next >= framesRef.current.length) {
        setPlaying(false)
        setPhase('done')
        return
      }
      setFrameIdx(next)
      animRef.current = setTimeout(tick, speedRef.current)
    }

    animRef.current = setTimeout(tick, speedRef.current)
    return () => { if (animRef.current) clearTimeout(animRef.current) }
  }, [playing]) // ← only depends on playing, not frames/frameIdx

  // ── Controls ───────────────────────────────────────────────────────────────
  const clearMap = () => {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    const map = mapRef.current
    if (!map) return
    ;['bnb-best', 'bnb-partial'].forEach(id => {
      if (map.getLayer(id + '-line')) map.removeLayer(id + '-line')
      if (map.getSource(id)) map.removeSource(id)
    })
  }

  const handlePreset = () => {
    if (phase !== 'idle') return
    clearMap()
    const map = mapRef.current
    if (!map) return
    const cs = EUROPE_PRESET.map((p, i) => ({ ...p, id: i }))
    cs.forEach(c => addMarker(c.lng, c.lat, c.label, map))
    setCities(cs)
  }

  const handleRun = () => {
    if (cities.length < 3) return
    const f = buildFrames(cities)
    setFrames(f)
    setFrameIdx(0)
    frameIdxRef.current = 0
    framesRef.current = f
    setPhase('running')
    setPlaying(true)
  }

  const handleReset = () => {
    setPlaying(false)
    clearMap()
    setCities([])
    setFrames([])
    setFrameIdx(0)
    setPhase('idle')
    drawTree(null)
  }

  const stepBy = (delta: number) => {
    setPlaying(false)
    setFrameIdx(i => {
      const next = Math.min(Math.max(0, i + delta), frames.length - 1)
      if (next === frames.length - 1) setPhase('done')
      return next
    })
  }

  const cur = frames[frameIdx]
  const progress = frames.length > 1 ? (frameIdx / (frames.length - 1)) * 100 : 0

  const actionLabel = !cur ? '—'
    : cur.action === 'prune'       ? '✂ PRUNED'
    : cur.action === 'update-best' ? '★ NEW BEST'
    : cur.action === 'done'        ? '✓ DONE'
    : '→ EXPLORING'

  const actionColor = !cur ? '#4b7a56'
    : cur.action === 'prune'       ? '#ef4444'
    : cur.action === 'update-best' ? '#22c55e'
    : cur.action === 'done'        ? '#22c55e'
    : '#facc15'

  return (
    <div style={g.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        input[type=range] { accent-color: #4ade80; }
      `}</style>

      {/* Header */}
      <div style={g.header}>
        <div>
          <div style={g.breadcrumb}>TSP &nbsp;/&nbsp; BRANCH &amp; BOUND</div>
          <h1 style={g.title}>Branch &amp; Bound</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {cur && <div style={{ ...g.badge, color: actionColor, borderColor: actionColor }}>{actionLabel}</div>}
          <a href="/" style={g.back}>← back</a>
        </div>
      </div>

      {/* Body */}
      <div style={g.body}>

        {/* Map */}
        <div style={g.mapPanel}>
          <div style={g.panelLabel}>MAP &nbsp;·&nbsp; {phase === 'idle' ? 'click to place cities (max 8)' : 'route visualizer'}</div>
          <div ref={mapContainer} style={g.mapEl} />
        </div>

        {/* Right column */}
        <div style={g.rightCol}>

          {/* Tree */}
          <div style={{ display: 'flex', flexDirection: 'column' as const, flex: '1 1 0', minHeight: 0 }}>
            <div style={g.panelLabel}>SEARCH TREE</div>
            <canvas ref={treeRef} style={g.treeCanvas} />
          </div>

          {/* Controls */}
          <div style={g.controlBox}>
            {/* Stats */}
            <div style={g.statsRow}>
              {[
                { label: 'CITIES',   val: cities.length,            color: '#f0fdf4' },
                { label: 'EXPLORED', val: cur?.nodesExplored ?? '—', color: '#f0fdf4' },
                { label: 'PRUNED',   val: cur?.nodesPruned ?? '—',   color: '#ef4444' },
                { label: 'BEST km',  val: cur?.bestCost === Infinity ? '∞' : cur?.bestCost?.toFixed(0) ?? '—', color: '#22c55e' },
              ].map(({ label, val, color }) => (
                <div key={label} style={g.statCell}>
                  <span style={g.statLabel}>{label}</span>
                  <span style={{ ...g.statVal, color }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Progress */}
            <div style={g.progressTrack}>
              <div style={{ ...g.progressFill, width: `${progress}%` }} />
            </div>
            <div style={g.frameLabel}>frame {frames.length > 0 ? frameIdx + 1 : '—'} / {frames.length || '—'}</div>

            {/* Buttons */}
            <div style={g.btnRow}>
              {phase === 'idle' ? (
                <>
                  <button style={g.btnGhost} onClick={handlePreset}>⊞ Preset</button>
                  <button style={g.btnGreen} onClick={handleRun} disabled={cities.length < 3}>▶ Run</button>
                </>
              ) : (
                <>
                  <button style={g.btnSm} onClick={() => stepBy(-1)} disabled={frameIdx === 0}>‹</button>
                  <button style={g.btnSm} onClick={() => setPlaying(p => !p)}>{playing ? '⏸' : '▶'}</button>
                  <button style={g.btnSm} onClick={() => stepBy(1)} disabled={frameIdx === frames.length - 1}>›</button>
                </>
              )}
              <button style={g.btnGhost} onClick={handleReset}>↺</button>
            </div>

            {/* Speed */}
            {phase !== 'idle' && (
              <div style={g.speedRow}>
                <span style={g.statLabel}>SLOW</span>
                <input type="range" min={40} max={600} step={20}
                  value={600 - speed + 40}
                  onChange={e => setSpeed(600 - Number(e.target.value) + 40)}
                  style={{ flex: 1 }} />
                <span style={g.statLabel}>FAST</span>
              </div>
            )}

            {/* Legend */}
            <div style={g.legend}>
              {[['#facc15','Active'],['#22c55e','Best path'],['#ef4444','Pruned'],['#374151','Explored']].map(([c, l]) => (
                <div key={l} style={g.legendItem}>
                  <span style={{ ...g.dot, background: c }} />{l}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const g: Record<string, React.CSSProperties> = {
  page: {
    height: '100vh', background: '#060d07', color: '#d1fae5',
    fontFamily: '"Share Tech Mono","Courier New",monospace',
    display: 'flex', flexDirection: 'column', padding: '14px 18px',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 12, borderBottom: '1px solid #14532d', paddingBottom: 10,
    flexShrink: 0,
  },
  breadcrumb: { fontSize: 10, letterSpacing: 3, color: '#4ade80', marginBottom: 3 },
  title: { margin: 0, fontFamily: '"Syne",sans-serif', fontSize: 24, fontWeight: 800, color: '#f0fdf4' },
  back: { color: '#4ade80', textDecoration: 'none', fontSize: 12, opacity: 0.6 },
  badge: { fontSize: 10, letterSpacing: 2, fontWeight: 700, border: '1px solid', borderRadius: 4, padding: '3px 8px' },
  body: { flex: 1, display: 'flex', gap: 14, minHeight: 0, overflow: 'hidden' },
  mapPanel: { flex: '1 1 0', display: 'flex', flexDirection: 'column', minHeight: 0 },
  mapEl: { flex: 1, borderRadius: 10, border: '1px solid #14532d', overflow: 'hidden', minHeight: 0 },
  panelLabel: { fontSize: 9, letterSpacing: 3, color: '#166534', marginBottom: 5, flexShrink: 0 },
  rightCol: { width: 300, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 },
  treeCanvas: { flex: 1, display: 'block', width: '100%', height: '100%', background: '#0a130b', border: '1px solid #14532d', borderRadius: 8, minHeight: 180 },
  controlBox: { background: '#0a130b', border: '1px solid #14532d', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 },
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 },
  statCell: { display: 'flex', flexDirection: 'column', gap: 1 },
  statLabel: { fontSize: 7, letterSpacing: 2, color: '#166534' },
  statVal: { fontSize: 16, fontWeight: 700, lineHeight: 1.1 },
  progressTrack: { height: 3, background: '#14532d', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#4ade80', borderRadius: 2, transition: 'width 0.1s' },
  frameLabel: { fontSize: 8, color: '#166534', letterSpacing: 1, textAlign: 'right' as const, marginTop: -2 },
  btnRow: { display: 'flex', gap: 5 },
  btnGreen: { flex: 1, background: '#14532d', border: '1px solid #4ade80', borderRadius: 6, color: '#4ade80', fontFamily: '"Share Tech Mono",monospace', fontWeight: 700, fontSize: 12, padding: '7px 0', cursor: 'pointer' },
  btnSm: { flex: 1, background: '#0f1a10', border: '1px solid #1e3a2a', borderRadius: 6, color: '#86efac', fontFamily: '"Share Tech Mono",monospace', fontSize: 14, padding: '6px 0', cursor: 'pointer' },
  btnGhost: { background: 'transparent', border: '1px solid #1e3a2a', borderRadius: 6, color: '#4b7a56', fontFamily: '"Share Tech Mono",monospace', fontSize: 11, padding: '6px 8px', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  speedRow: { display: 'flex', alignItems: 'center', gap: 6 },
  legend: { display: 'flex', flexWrap: 'wrap' as const, gap: '3px 10px', fontSize: 9, color: '#4b7a56' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
}
