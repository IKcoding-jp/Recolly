import { useState, useEffect } from 'react'
import styles from './SearchProgress.module.css'

const STEPS = [
  { message: '作品を検索しています...', delay: 0 },
  { message: '詳細情報を取得しています...', delay: 1000 },
  { message: '結果をまとめています...', delay: 2500 },
]

// message 指定時は固定メッセージ表示（補完中表示等に流用）。未指定時は3段階の演出
export function SearchProgress({ message }: { message?: string }) {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (message) return undefined
    const timers = STEPS.slice(1).map((step, i) =>
      setTimeout(() => setStepIndex(i + 1), step.delay),
    )
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [message])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.spinner} />
        <span className={styles.message}>{message ?? STEPS[stepIndex].message}</span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} role="progressbar" />
      </div>
    </div>
  )
}
