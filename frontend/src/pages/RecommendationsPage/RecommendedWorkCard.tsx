import { Button } from '../../components/ui/Button/Button'
import { getMediaTypeLabel } from '../../lib/mediaTypeUtils'
import type { RecommendedWork } from '../../types/recommendation'
import styles from './RecommendationsPage.module.css'

type RecommendedWorkCardProps = {
  work: RecommendedWork
  onRecord: (work: RecommendedWork) => void
  isLoading: boolean
}

export function RecommendedWorkCard({ work, onRecord, isLoading }: RecommendedWorkCardProps) {
  return (
    <div className={styles.recItem}>
      <div className={styles.recTop}>
        {work.cover_url ? (
          <img src={work.cover_url} alt={work.title} className={styles.recCover} />
        ) : (
          <div className={styles.recCoverPlaceholder} />
        )}
        <div className={styles.recInfo}>
          <div className={styles.recTitleRow}>
            <span className={styles.recTitle}>{work.title}</span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onRecord(work)}
              disabled={isLoading}
            >
              記録する
            </Button>
          </div>
          <div className={styles.recMeta}>
            <span className={`${styles.genreBadge} ${styles[`genre${work.media_type}`]}`}>
              {getMediaTypeLabel(work.media_type)}
            </span>
          </div>
        </div>
      </div>
      <div className={styles.recReason}>
        <div className={styles.reasonLabel}>おすすめの理由</div>
        <p className={styles.reasonText}>{work.reason}</p>
      </div>
    </div>
  )
}
