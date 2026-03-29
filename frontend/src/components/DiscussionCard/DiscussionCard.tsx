import { Link } from 'react-router-dom'
import type { Discussion } from '../../lib/types'
import { formatRelativeTime } from '../../lib/timeUtils'
import { getMediaTypeLabel } from '../../lib/mediaTypeUtils'
import { SpoilerBadge } from '../ui/SpoilerBadge/SpoilerBadge'
import { EpisodeBadge } from '../ui/EpisodeBadge/EpisodeBadge'
import styles from './DiscussionCard.module.css'

type Props = {
  discussion: Discussion
  showWorkInfo?: boolean
}

export function DiscussionCard({ discussion, showWorkInfo = true }: Props) {
  const { work, user } = discussion

  return (
    <Link to={`/discussions/${String(discussion.id)}`} className={styles.card}>
      {showWorkInfo && (
        <div className={styles.coverWrapper}>
          {work.cover_image_url ? (
            <img className={styles.cover} src={work.cover_image_url} alt={work.title} />
          ) : (
            <div className={styles.coverPlaceholder} />
          )}
        </div>
      )}
      <div className={styles.content}>
        <div className={styles.badges}>
          {showWorkInfo && (
            <span className={styles.genreBadge}>{getMediaTypeLabel(work.media_type)}</span>
          )}
          <EpisodeBadge episodeNumber={discussion.episode_number} />
          {discussion.has_spoiler && <SpoilerBadge />}
        </div>
        <div className={styles.title}>{discussion.title}</div>
        <div className={styles.meta}>
          {showWorkInfo && (
            <>
              <span className={styles.workTitle}>{work.title}</span>
              <span className={styles.dot} aria-hidden="true">
                ·
              </span>
            </>
          )}
          <span>{user.username}</span>
          <span className={styles.dot} aria-hidden="true">
            ·
          </span>
          <span>{formatRelativeTime(discussion.created_at)}</span>
          <span className={styles.dot} aria-hidden="true">
            ·
          </span>
          <span className={styles.commentCount}>{discussion.comments_count}件のコメント</span>
        </div>
      </div>
    </Link>
  )
}
