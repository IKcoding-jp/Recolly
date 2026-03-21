import { Link } from 'react-router-dom'
import type { UserRecord, RecordStatus } from '../../lib/types'
import styles from './RecordListItem.module.css'

type RecordListItemProps = {
  record: UserRecord
}

const STATUS_LABELS: Record<RecordStatus, string> = {
  watching: '視聴中',
  completed: '視聴完了',
  on_hold: '一時停止',
  dropped: '中断',
  plan_to_watch: '視聴予定',
}

export function RecordListItem({ record }: RecordListItemProps) {
  const { work } = record
  const hasRating = record.rating !== null
  const hasEpisodes = work.total_episodes !== null

  // 進捗の割合を計算（プログレスバー描画用）
  const progressPercent =
    hasEpisodes && work.total_episodes > 0
      ? Math.min((record.current_episode / work.total_episodes) * 100, 100)
      : 0

  return (
    <Link to={`/works/${work.id}`} className={styles.card}>
      <div className={styles.coverWrapper}>
        {work.cover_image_url ? (
          <img
            className={styles.cover}
            src={work.cover_image_url}
            alt={`${work.title}のカバー画像`}
          />
        ) : (
          <div className={styles.coverPlaceholder} />
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.header}>
          <h3 className={styles.title}>{work.title}</h3>
          <span className={`${styles.badge} ${styles[record.status]}`}>
            {STATUS_LABELS[record.status]}
          </span>
        </div>

        <div className={styles.meta}>
          {hasRating && (
            <span className={styles.rating}>
              <span className={styles.star}>★</span>
              <span>{record.rating}</span>
            </span>
          )}

          {hasEpisodes && (
            <div className={styles.progress}>
              <span className={styles.progressText}>
                {record.current_episode} / {work.total_episodes}話
              </span>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
