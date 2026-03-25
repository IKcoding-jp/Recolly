import { useState, useCallback } from 'react'
import { useEpisodeReviews } from '../../hooks/useEpisodeReviews'
import { Button } from '../ui/Button/Button'
import { EpisodeReviewCard } from './EpisodeReviewCard'
import styles from './EpisodeReviewSection.module.css'

type EpisodeReviewSectionProps = {
  recordId: number
  currentEpisode: number
}

export function EpisodeReviewSection({ recordId, currentEpisode }: EpisodeReviewSectionProps) {
  const { reviews, isLoading, createReview, updateReview, deleteReview } =
    useEpisodeReviews(recordId)

  const [episodeNumber, setEpisodeNumber] = useState(currentEpisode)
  const [body, setBody] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!body.trim()) return
    setIsSubmitting(true)
    try {
      await createReview(episodeNumber, body.trim())
      setBody('')
    } finally {
      setIsSubmitting(false)
    }
  }, [body, episodeNumber, createReview])

  // 新しい話数順（降順）で表示
  const sortedReviews = [...reviews].sort((a, b) => b.episode_number - a.episode_number)

  if (isLoading) {
    return <div className={styles.loading}>読み込み中...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.form}>
        <div className={styles.formRow}>
          <label className={styles.episodeLabel} htmlFor="episode-number">
            第
          </label>
          <input
            id="episode-number"
            type="number"
            className={styles.episodeInput}
            value={episodeNumber}
            onChange={(e) => setEpisodeNumber(Number(e.target.value))}
            min={1}
          />
          <span className={styles.episodeLabel}>話</span>
        </div>
        <textarea
          className={styles.textarea}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="この話数の感想を書く..."
          rows={3}
        />
        <div className={styles.formActions}>
          <Button
            variant="primary"
            size="sm"
            disabled={isSubmitting || !body.trim()}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      {sortedReviews.length > 0 && (
        <div className={styles.list}>
          {sortedReviews.map((review) => (
            <EpisodeReviewCard
              key={review.id}
              review={review}
              onUpdate={updateReview}
              onDelete={deleteReview}
            />
          ))}
        </div>
      )}
    </div>
  )
}
