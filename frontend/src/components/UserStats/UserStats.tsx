import type { UserStatistics } from '../../lib/types'
import { getMediaTypeLabel } from '../../lib/mediaTypeUtils'
import styles from './UserStats.module.css'

type UserStatsProps = {
  statistics: UserStatistics
}

export function UserStats({ statistics }: UserStatsProps) {
  // 平均評価を小数点1桁で表示。null（評価なし）の場合は「-」を表示
  const averageRatingDisplay =
    statistics.average_rating !== null ? statistics.average_rating.toFixed(1) : '-'

  // ジャンル別の件数を配列に変換し、件数が多い順に並べる
  const genreEntries = Object.entries(statistics.by_genre)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)

  return (
    <section className={styles.section}>
      <div className={styles.grid}>
        <div className={styles.card}>
          <span className={styles.cardValue}>{statistics.total_records}</span>
          <span className={styles.cardLabel}>総記録数</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardValue}>{statistics.completed_count}</span>
          <span className={styles.cardLabel}>完了</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardValue}>{statistics.watching_count}</span>
          <span className={styles.cardLabel}>進行中</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardValue}>{averageRatingDisplay}</span>
          <span className={styles.cardLabel}>平均評価</span>
        </div>
      </div>

      {genreEntries.length > 0 && (
        <div className={styles.genres}>
          {genreEntries.map(([genre, count]) => (
            <span key={genre} className={styles.genreChip}>
              {getMediaTypeLabel(genre)} {count}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
