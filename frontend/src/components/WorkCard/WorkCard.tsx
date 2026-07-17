import type { KeyboardEvent } from 'react'
import type { SearchResult, MediaType } from '../../lib/types'
import styles from './WorkCard.module.css'

type WorkCardProps = {
  work: SearchResult
  onRecord: (work: SearchResult) => void
  isRecorded?: boolean
}

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  anime: 'アニメ',
  movie: '映画',
  drama: 'ドラマ',
  book: '本',
  manga: '漫画',
  game: 'ゲーム',
}

// ジャケット主体の縦型カード（ADR-0044）。カード全体のクリックで記録モーダルを開く
export function WorkCard({ work, onRecord, isRecorded = false }: WorkCardProps) {
  const handleClick = () => {
    onRecord(work)
  }

  // ボタンではなくdivをクリック対象にしているため、Enter/Spaceキー操作を自前で処理する
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRecord(work)
    }
  }

  return (
    <div
      className={styles.card}
      role="button"
      tabIndex={0}
      aria-label={isRecorded ? `${work.title}（記録済み）` : `${work.title}を記録する`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.coverWrapper}>
        {work.cover_image_url ? (
          <img
            className={styles.cover}
            src={work.cover_image_url}
            alt={`${work.title}のカバー画像`}
            loading="lazy"
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
      </div>
    </div>
  )
}
