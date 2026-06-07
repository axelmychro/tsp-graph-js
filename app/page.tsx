'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>TSP Visualizer</h1>

      <p style={styles.desc}>
        Traveling Salesman Problem Visualization using Map + Algorithms
        (Brute Force, Heuristic, Branch & Bound)
      </p>

      <div style={styles.card}>
        <button
          style={styles.button}
          onClick={() => router.push('/tsp')}
        >
          Open Map Simulator
        </button>

        <button
          style={styles.buttonAlt}
          onClick={() => router.push('/algorithms/bruteforce')}
        >
          Brute Force
        </button>

        <button
          style={styles.buttonAlt}
          onClick={() => router.push('/algorithms/heuristic')}
        >
          Heuristic
        </button>

        <button
          style={styles.buttonAlt}
          onClick={() => router.push('/algorithms/branchAndBound')}
        >
          Branch & Bound
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#0b0f1a',
    color: 'white',
    textAlign: 'center',
    padding: 20,
  },

  title: {
    fontSize: 44,
    fontWeight: 'bold',
    marginBottom: 10,
  },

  desc: {
    maxWidth: 600,
    opacity: 0.7,
    marginBottom: 30,
  },

  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: 260,
  },

  button: {
    padding: '12px 16px',
    background: '#3b82f6',
    border: 'none',
    borderRadius: 10,
    color: 'white',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  buttonAlt: {
    padding: '10px 14px',
    background: '#1f2937',
    border: '1px solid #444',
    borderRadius: 10,
    color: 'white',
    cursor: 'pointer',
  },
}