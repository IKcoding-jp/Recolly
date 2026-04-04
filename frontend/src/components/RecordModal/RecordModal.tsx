import { useState } from 'react'
import type { MediaType, RecordStatus } from '../../lib/types'
import { StatusSelector } from '../ui/StatusSelector/StatusSelector'
import { RatingSlider } from '../ui/RatingSlider/RatingSlider'
import { Button } from '../ui/Button/Button'
import styles from './RecordModal.module.css'

type RecordModalProps = {
  isOpen: boolean
  title: string
  mediaType: MediaType
  mediaTypeLabel: string
  onConfirm: (data: { status: RecordStatus; rating: number | null }) => void
  onCancel: () => void
  isLoading: boolean
}

export function RecordModal({
  isOpen,
  title,
  mediaType,
  mediaTypeLabel,
  onConfirm,
  onCancel,
  isLoading,
}: RecordModalProps) {
  const [status, setStatus] = useState<RecordStatus>('watching')
  const [rating, setRating] = useState<number | null>(null)

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm({ status, rating })
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}を記録</h3>
          <p className={styles.meta}>{mediaTypeLabel}</p>
        </div>

        <div className={styles.card}>
          <label className={styles.label}>ステータス</label>
          <StatusSelector value={status} onChange={setStatus} mediaType={mediaType} />
        </div>

        <div className={styles.card}>
          <label className={styles.label}>評価（任意）</label>
          <RatingSlider value={rating ?? 0} onChange={(v) => setRating(v === 0 ? null : v)} />
        </div>

        <div className={styles.actions}>
          <Button variant="primary" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? '記録中...' : '記録する'}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
        </div>
      </div>
    </div>
  )
}
