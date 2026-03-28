import type { SearchResult, MediaType } from '../../lib/types'
import { Button } from '../ui/Button/Button'
import styles from './WorkCard.module.css'

type WorkCardProps = {
  work: SearchResult
  onRecord: (work: SearchResult) => void
  isRecorded?: boolean
  isLoading?: boolean
}

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  anime: 'アニメ',
  movie: '映画',
  drama: 'ドラマ',
  book: '本',
  manga: '漫画',
  game: 'ゲーム',
}

export function WorkCard({ work, onRecord, isRecorded = false, isLoading = false }: WorkCardProps) {
  const handleRecord = () => {
    if (!isRecorded && !isLoading) {
      onRecord(work)
    }
  }

  return (
    <div className={styles.card}>
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
        <span className={`${styles.genre} ${styles[work.media_type]}`}>
          {MEDIA_TYPE_LABELS[work.media_type]}
        </span>
        <h3 className={styles.title}>{work.title}</h3>
        {work.description && <p className={styles.description}>{work.description}</p>}
      </div>
      <div className={styles.action}>
        {isRecorded ? (
          <span className={styles.recorded}>記録済み</span>
        ) : (
          <Button variant="primary" size="sm" onClick={handleRecord} disabled={isLoading}>
            {isLoading ? '記録中...' : '記録する'}
          </Button>
        )}
      </div>
    </div>
  )
}
