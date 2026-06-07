'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>TSP Visualizer</h1>
      <p style={styles.desc}>
        Traveling Salesman Problem — visualized with three algorithms
      </p>

      <div style={styles.card}>
        <button style={styles.button} onClick={() => router.push('/algoritma/brute-force')}>
          Brute Force
        </button>
        <button style={styles.button} onClick={() => router.push('/algoritma/heuristik')}>
          Heuristic
        </button>
        <button style={styles.button} onClick={() => router.push('/algoritma/branch-and-bound')}>
          Branch &amp; Bound
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
    background: '#1f2937',
    border: '1px solid #444',
    borderRadius: 10,
    color: 'white',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
}
