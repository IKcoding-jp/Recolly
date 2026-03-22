import { Link } from 'react-router-dom'
import styles from './DashboardEmptyState.module.css'

/**
 * ジャンル定義: ラベル・HEXカラーの一覧
 * CSS変数では opacity 操作ができないため、HEX値をインラインスタイルで使用する
 */
const GENRES = [
  { label: 'アニメ', color: '#3d5a80' },
  { label: '映画', color: '#5e548e' },
  { label: 'ドラマ', color: '#9f86c0' },
  { label: '本', color: '#c4956a' },
  { label: '漫画', color: '#e07a5f' },
  { label: 'ゲーム', color: '#6b9080' },
] as const

const STEPS = [
  { number: 1, label: '作品を探す', detail: '検索ページで気になる作品を見つける' },
  { number: 2, label: '記録する', detail: 'ステータスを選んでライブラリに追加' },
  { number: 3, label: '進捗を更新', detail: 'ワンクリックで「+1話」' },
] as const

/** HEXカラーをRGBA文字列に変換する */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function DashboardEmptyState() {
  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>はじめましょう</h2>

      <ul className={styles.pillList}>
        {GENRES.map(({ label, color }) => (
          <li
            key={label}
            className={styles.pill}
            style={{
              backgroundColor: hexToRgba(color, 0.1),
              border: `1px solid ${hexToRgba(color, 0.3)}`,
            }}
          >
            <span className={styles.dot} style={{ backgroundColor: color }} />
            {label}
          </li>
        ))}
      </ul>

      <p className={styles.description}>すべてのジャンルをまとめて記録・管理できます</p>

      <div className={styles.steps}>
        {STEPS.map(({ number, label, detail }) => (
          <div key={number} className={styles.step}>
            <span className={styles.stepNumber}>{number}</span>
            <span className={styles.stepLabel}>{label}</span>
            <span className={styles.stepDetail}>{detail}</span>
          </div>
        ))}
      </div>

      <Link to="/search" className={styles.cta} aria-label="作品を探す">
        作品を探してみる
      </Link>
    </div>
  )
}
