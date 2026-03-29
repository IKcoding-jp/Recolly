import { Link } from 'react-router-dom'
import type { UserRecord } from '../../lib/types'
import {
  getActionLabel,
  getGenreLabel,
  getProgressText,
  isOngoing,
  getUnreadCount,
} from '../../lib/mediaTypeUtils'
import styles from './WatchingListItem.module.css'

const GENRE_COLOR_VAR: Record<string, string> = {
  anime: 'var(--color-anime)',
  movie: 'var(--color-movie)',
  drama: 'var(--color-drama)',
  book: 'var(--color-book)',
  manga: 'var(--color-manga)',
  game: 'var(--color-game)',
}

type WatchingListItemProps = {
  record: UserRecord
  onAction: (record: UserRecord) => void
}

export function WatchingListItem({ record, onAction }: WatchingListItemProps) {
  const { work } = record
  const color = GENRE_COLOR_VAR[work.media_type]
  const progressText = getProgressText(work.media_type, record.current_episode, work.total_episodes)
  // 連載中の漫画のみ未読巻数を計算する
  const unreadCount =
    work.media_type === 'manga' && isOngoing(work.metadata)
      ? getUnreadCount(record.current_episode, work.total_episodes)
      : 0

  return (
    <div className={styles.row}>
      <Link to={`/works/${work.id}`} className={styles.link}>
        {work.cover_image_url ? (
          <img src={work.cover_image_url} alt="" className={styles.cover} />
        ) : (
          <div className={styles.coverPlaceholder} style={{ background: color }} />
        )}
        <div className={styles.info}>
          <div className={styles.title}>{work.title}</div>
          <div className={styles.genre} style={{ color }}>
            {getGenreLabel(work.media_type)}
          </div>
          <div className={styles.progress}>
            {progressText}
            {unreadCount > 0 && <span className={styles.unreadBadge}>未読 {unreadCount}巻</span>}
          </div>
        </div>
      </Link>
      <button
        className={styles.actionButton}
        onClick={(e) => {
          e.preventDefault()
          onAction(record)
        }}
      >
        {getActionLabel(work.media_type)}
      </button>
    </div>
  )
}
