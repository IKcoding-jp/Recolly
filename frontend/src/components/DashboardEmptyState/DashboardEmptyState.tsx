import { Link } from 'react-router-dom'
import styles from './DashboardEmptyState.module.css'

/**
 * ジャンル定義: ラベルとCSSクラス名の一覧
 * 色は tokens.css のCSS変数で管理し、CSSモジュール側で適用する
 */
const GENRES = [
  { label: 'アニメ', className: styles.pillAnime },
  { label: '映画', className: styles.pillMovie },
  { label: 'ドラマ', className: styles.pillDrama },
  { label: '本', className: styles.pillBook },
  { label: '漫画', className: styles.pillManga },
  { label: 'ゲーム', className: styles.pillGame },
] as const

const STEPS = [
  { number: 1, label: '作品を探す', detail: '検索ページで気になる作品を見つける' },
  { number: 2, label: '記録する', detail: 'ステータスを選んでライブラリに追加' },
  { number: 3, label: '進捗を更新', detail: 'ワンクリックで「+1話」' },
] as const

export function DashboardEmptyState() {
  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>はじめましょう</h2>

      <ul className={styles.pillList}>
        {GENRES.map(({ label, className }) => (
          <li key={label} className={`${styles.pill} ${className}`}>
            <span className={styles.dot} />
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
