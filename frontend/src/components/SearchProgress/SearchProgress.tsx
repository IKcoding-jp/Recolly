import { useState, useEffect } from 'react'
import styles from './SearchProgress.module.css'

const STEPS = [
  { message: '作品を検索しています...', delay: 0 },
  { message: '詳細情報を取得しています...', delay: 1000 },
  { message: '結果をまとめています...', delay: 2500 },
]

export function SearchProgress() {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const timers = STEPS.slice(1).map((step, i) =>
      setTimeout(() => setStepIndex(i + 1), step.delay),
    )
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.spinner} />
        <span className={styles.message}>{STEPS[stepIndex].message}</span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} role="progressbar" />
      </div>
    </div>
  )
}
