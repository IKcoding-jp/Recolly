// frontend/src/components/RecordCompactItem/RecordCompactItem.tsx
import { Link } from 'react-router-dom'
import type { UserRecord } from '../../lib/types'
import { getStatusLabel } from '../../lib/mediaTypeUtils'
import styles from './RecordCompactItem.module.css'

type RecordCompactItemProps = {
  record: UserRecord
}

export function RecordCompactItem({ record }: RecordCompactItemProps) {
  const { work } = record

  return (
    <Link to={`/works/${work.id}`} className={styles.row}>
      <span className={styles.title}>{work.title}</span>
      <span className={styles.right}>
        {record.rating !== null && (
          <span className={styles.rating}>
            <span className={styles.star}>★</span>
            <span>{record.rating}</span>
          </span>
        )}
        <span className={`${styles.badge} ${styles[record.status]}`}>
          {getStatusLabel(record.status, work.media_type)}
        </span>
      </span>
    </Link>
  )
}
