import styles from './StatsSummary.module.css'

interface MonthlyChartProps {
  completions: Array<{ month: string; count: number }>
}

// 最大6ヶ月分のデータを表示する
const MAX_MONTHS = 6

// "2026-03" → "3月" の形式に変換
function formatMonth(month: string): string {
  const parts = month.split('-')
  return `${Number(parts[1])}月`
}

export function MonthlyChart({ completions }: MonthlyChartProps) {
  const recentMonths = completions.slice(-MAX_MONTHS)
  const maxCount = Math.max(...recentMonths.map((m) => m.count), 1)
  const lastIndex = recentMonths.length - 1

  return (
    <div className={styles.monthlySection}>
      <h3 className={styles.distributionTitle}>月別完了数</h3>
      <div className={styles.chartArea}>
        {recentMonths.map((item, index) => {
          const heightPercent = (item.count / maxCount) * 100
          const isCurrent = index === lastIndex
          return (
            <div key={item.month} className={styles.chartColumn}>
              <span className={styles.chartCount}>{item.count}</span>
              <div className={styles.chartBarWrapper}>
                <div
                  className={`${styles.chartBar} ${isCurrent ? styles.chartBarCurrent : ''}`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              <span className={styles.chartLabel}>{formatMonth(item.month)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
