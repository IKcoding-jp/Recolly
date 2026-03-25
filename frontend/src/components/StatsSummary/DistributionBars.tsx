import styles from './StatsSummary.module.css'

interface DistributionBarsProps {
  title: string
  data: Record<string, number>
  labels: Record<string, string>
}

// バーの幅比率を計算する（最大値を100%とした相対値）
function calcBarPercent(value: number, maxValue: number): number {
  if (maxValue === 0) return 0
  return (value / maxValue) * 100
}

export function DistributionBars({ title, data, labels }: DistributionBarsProps) {
  const entries = Object.entries(data)
  const maxValue = Math.max(...entries.map(([, v]) => v), 1)

  return (
    <div className={styles.distributionSection}>
      <h3 className={styles.distributionTitle}>{title}</h3>
      <div className={styles.barList}>
        {entries.map(([key, value]) => (
          <div key={key} className={styles.barRow}>
            <span className={styles.barLabel}>{labels[key] ?? key}</span>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${calcBarPercent(value, maxValue)}%` }}
              />
            </div>
            <span className={styles.barCount}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
