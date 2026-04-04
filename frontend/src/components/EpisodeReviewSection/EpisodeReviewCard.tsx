import { useState, useCallback } from 'react'
import type { EpisodeReview } from '../../lib/types'
import { Button } from '../ui/Button/Button'
import { FormTextarea } from '../ui/FormTextarea/FormTextarea'
import styles from './EpisodeReviewSection.module.css'

type EpisodeReviewCardProps = {
  review: EpisodeReview
  onUpdate: (reviewId: number, body: string) => Promise<void>
  onDelete: (reviewId: number) => Promise<void>
  unit?: string
}

export function EpisodeReviewCard({
  review,
  onUpdate,
  onDelete,
  unit = '話',
}: EpisodeReviewCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editBody, setEditBody] = useState(review.body)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = useCallback(async () => {
    if (!editBody.trim()) return
    setIsSaving(true)
    try {
      await onUpdate(review.id, editBody.trim())
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }, [editBody, review.id, onUpdate])

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`第${review.episode_number}${unit}の感想を削除しますか？`)) return
    await onDelete(review.id)
  }, [review.id, review.episode_number, onDelete, unit])

  const formattedDate = new Date(review.created_at).toLocaleDateString('ja-JP')

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.episodeTag}>
          第{review.episode_number}
          {unit}
        </span>
        <span className={styles.cardDate}>{formattedDate}</span>
        <div className={styles.cardActions}>
          {!isEditing && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                編集
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void handleDelete()}>
                削除
              </Button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className={styles.editForm}>
          <FormTextarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} />
          <div className={styles.editActions}>
            <Button
              variant="primary"
              size="sm"
              disabled={isSaving || !editBody.trim()}
              onClick={() => void handleSave()}
            >
              {isSaving ? '保存中...' : '保存'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditBody(review.body)
                setIsEditing(false)
              }}
            >
              キャンセル
            </Button>
          </div>
        </div>
      ) : (
        <p className={styles.cardBody}>{review.body}</p>
      )}
    </div>
  )
}
