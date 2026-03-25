import type { Statistics } from '../../lib/types'
import styles from './StatsSummary.module.css'

interface NumberCardsProps {
  statistics: Statistics
}

// by_genreの合計を算出する
function sumGenreValues(byGenre: Record<string, number>): number {
  return Object.values(byGenre).reduce((sum, v) => sum + v, 0)
}

// 今月の完了数を取得する（月別完了配列の最後の要素）
function getCurrentMonthCount(
  completions: Array<{ month: string; count: number }>,
): number {
  if (completions.length === 0) return 0
  return completions[completions.length - 1].count
}

export function NumberCards({ statistics }: NumberCardsProps) {
  const totalRecords = sumGenreValues(statistics.by_genre)
  const currentMonthCount = getCurrentMonthCount(statistics.monthly_completions)

  const cards = [
    { label: '総記録数', value: totalRecords },
    { label: '総視聴話数', value: statistics.totals.episodes_watched },
    { label: '総読了巻数', value: statistics.totals.volumes_read },
    { label: '今月完了', value: currentMonthCount },
  ]

  return (
    <div className={styles.numberCards}>
      {cards.map((card) => (
        <div key={card.label} className={styles.numberCard}>
          <span className={styles.numberValue}>{card.value}</span>
          <span className={styles.numberLabel}>{card.label}</span>
        </div>
      ))}
    </div>
  )
}
