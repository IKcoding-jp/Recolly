import { Link } from 'react-router-dom'
import type { UserRecord } from '../../lib/types'
import { getStatusLabel } from '../../lib/mediaTypeUtils'
import styles from './RecordCardItem.module.css'

type RecordCardItemProps = {
  record: UserRecord
}

export function RecordCardItem({ record }: RecordCardItemProps) {
  const { work } = record

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
        <h3 className={styles.title}>{work.title}</h3>
        <div className={styles.meta}>
          {record.rating !== null && (
            <span className={styles.rating}>
              <span className={styles.star}>★</span>
              <span>{record.rating}</span>
            </span>
          )}
          <span className={`${styles.badge} ${styles[record.status]}`}>
            {getStatusLabel(record.status, work.media_type)}
          </span>
        </div>
      </div>
    </Link>
  )
}
