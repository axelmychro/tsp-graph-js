'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface Point {
  lng: number
  lat: number
}

interface History {
  path: number[]
  distance: number
  time: number
}

export default function Home() {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  const [points, setPoints] = useState<Point[]>([])
  const [bestPath, setBestPath] = useState<number[]>([])
  const [mode, setMode] = useState<'edit' | 'run'>('edit')
  const [running, setRunning] = useState(false)
  const [darkMode, setDarkMode] = useState(true)

  // 🧠 HISTORY FEATURE
  const [history, setHistory] = useState<History[]>([])
  const [lastDistance, setLastDistance] = useState<number | null>(null)

  const MAX_BRUTE = 9

  // =========================
  // INIT MAP
  // =========================
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: darkMode
        ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
        : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [110, 2],
      zoom: 4,
    })

    mapRef.current = map

    // SCALE CONTROL (NEW FEATURE 1)
    map.addControl(new maplibregl.ScaleControl({
      maxWidth: 120,
      unit: 'metric'
    }))

    map.on('click', (e) => {
      if (mode !== 'edit') return

      const { lng, lat } = e.lngLat

      setPoints((prev) => [...prev, { lng, lat }])
      addPin(lng, lat)
    })

    return () => map.remove()
  }, [])

  // =========================
  // MODE CONTROL
  // =========================
  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.getCanvas().style.cursor =
      mode === 'edit' ? 'crosshair' : ''
  }, [mode])

  // =========================
  // PIN
  // =========================
  const addPin = (lng: number, lat: number) => {
    if (!mapRef.current) return

    const el = document.createElement('div')
    el.innerHTML = `
      <div style="
        width: 11px;
        height: 11px;
        background: #60a5fa;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      "></div>
    `

    const marker = new maplibregl.Marker(el)
      .setLngLat([lng, lat])
      .addTo(mapRef.current)

    markersRef.current.push(marker)
  }

  // =========================
  // CLEAR ALL
  // =========================
  const clearAll = () => {
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const map = mapRef.current
    if (!map) return

    if (map.getLayer('route-line')) map.removeLayer('route-line')
    if (map.getSource('route')) map.removeSource('route')

    setPoints([])
    setBestPath([])
    setRunning(false)
  }

  // =========================
  // DISTANCE (KM)
  // =========================
  const dist = (a: Point, b: Point) => {
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

  // =========================
  // COST
  // =========================
  const cost = (path: number[]) => {
    let sum = 0
    for (let i = 0; i < path.length - 1; i++) {
      sum += dist(points[path[i]], points[path[i + 1]])
    }
    sum += dist(points[path[path.length - 1]], points[path[0]])
    return sum
  }

  // =========================
  // NEAREST NEIGHBOR (FAST)
  // =========================
  const nearestNeighbor = (start: number) => {
    const n = points.length
    const visited = Array(n).fill(false)

    let path = [start]
    visited[start] = true

    for (let i = 1; i < n; i++) {
      let last = path[path.length - 1]
      let best = -1
      let bestDist = Infinity

      for (let j = 0; j < n; j++) {
        if (visited[j]) continue
        const d = dist(points[last], points[j])
        if (d < bestDist) {
          bestDist = d
          best = j
        }
      }

      visited[best] = true
      path.push(best)
    }

    return path
  }

  // =========================
  // DRAW ROUTE
  // =========================
  const drawRoute = (path: number[]) => {
    const map = mapRef.current
    if (!map) return

    const coords = path.map((i) => [
      points[i].lng,
      points[i].lat,
    ])

    coords.push(coords[0])

    const geojson: any = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
    }

    if (map.getSource('route')) {
      ;(map.getSource('route') as any).setData(geojson)
      return
    }

    map.addSource('route', { type: 'geojson', data: geojson })

    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#60a5fa',
        'line-width': 2,
        'line-opacity': 0.9,
      },
    })
  }

  // =========================
  // SOLVE + HISTORY FEATURE
  // =========================
  const solve = async () => {
    if (points.length < 2) return

    setMode('run')
    setRunning(true)

    let path: number[] = []

    if (points.length <= MAX_BRUTE) {
      const idx = points.map((_, i) => i)

      // brute force simple (safe)
      let best = idx
      let bestCost = Infinity

      const permute = (arr: number[]): number[][] => {
        if (arr.length <= 1) return [arr]
        const res: number[][] = []
        for (let i = 0; i < arr.length; i++) {
          const rest = arr.filter((_, idx) => idx !== i)
          for (const p of permute(rest)) {
            res.push([arr[i], ...p])
          }
        }
        return res
      }

      const perms = permute(idx)

      for (const p of perms) {
        const c = cost(p)
        if (c < bestCost) {
          best = p
          bestCost = c
        }
      }

      path = best
      setLastDistance(bestCost)
    } else {
      path = nearestNeighbor(0)
      setLastDistance(cost(path))
    }

    // 🧠 SAVE HISTORY (NEW FEATURE 2)
    setHistory((prev) => [
      {
        path,
        distance: cost(path),
        time: Date.now(),
      },
      ...prev.slice(0, 4),
    ])

    setBestPath(path)
    drawRoute(path)

    setRunning(false)
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2>TSP Visualizer</h2>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setMode('edit')} style={styles.btn2}>
            Edit
          </button>

          <button onClick={solve} style={styles.btn}>
            Run
          </button>

          <button onClick={clearAll} style={styles.btn2}>
            Clear
          </button>
        </div>
      </div>

      <div ref={mapContainer} style={styles.map} />

      {/* =========================
         INFO PANEL (NEW)
      ========================= */}
      <div style={styles.info}>
        <div>Mode: {mode} | Points: {points.length}</div>

        <div>
          Current Route Distance:{' '}
          {lastDistance ? `${lastDistance.toFixed(2)} km` : '-'}
        </div>

        <div style={{ marginTop: 10 }}>
          <b>History:</b>
          {history.map((h, i) => (
            <div key={i}>
              Route {i + 1}: {h.distance.toFixed(2)} km
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* STYLE */
const styles: Record<string, React.CSSProperties> = {
  page: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0b0f1a',
    color: 'white',
  },
  header: {
    padding: 12,
    display: 'flex',
    justifyContent: 'space-between',
  },
  map: {
    flex: 1,
    margin: 10,
    borderRadius: 12,
  },
  btn: {
    background: '#3b82f6',
    border: 'none',
    padding: '8px 14px',
    borderRadius: 8,
    color: 'white',
    fontWeight: 'bold',
  },
  btn2: {
    background: '#1f2937',
    border: '1px solid #444',
    padding: '8px 14px',
    borderRadius: 8,
    color: 'white',
  },
  info: {
    padding: 10,
    fontSize: 12,
    opacity: 0.8,
  },
}