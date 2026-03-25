import { useState, useEffect, useCallback } from 'react'
import { episodeReviewsApi } from '../lib/episodeReviewsApi'
import type { EpisodeReview } from '../lib/types'

export function useEpisodeReviews(recordId: number) {
  const [reviews, setReviews] = useState<EpisodeReview[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchReviews = async () => {
      try {
        const res = await episodeReviewsApi.getAll(recordId)
        if (!cancelled) {
          setReviews(res.episode_reviews)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void fetchReviews()
    return () => {
      cancelled = true
    }
  }, [recordId])

  const createReview = useCallback(
    async (episodeNumber: number, body: string) => {
      const res = await episodeReviewsApi.create(recordId, {
        episode_number: episodeNumber,
        body,
      })
      setReviews((prev) =>
        [...prev, res.episode_review].sort((a, b) => a.episode_number - b.episode_number),
      )
    },
    [recordId],
  )

  const updateReview = useCallback(
    async (reviewId: number, body: string) => {
      const res = await episodeReviewsApi.update(recordId, reviewId, { body })
      setReviews((prev) => prev.map((r) => (r.id === reviewId ? res.episode_review : r)))
    },
    [recordId],
  )

  const deleteReview = useCallback(
    async (reviewId: number) => {
      await episodeReviewsApi.remove(recordId, reviewId)
      setReviews((prev) => prev.filter((r) => r.id !== reviewId))
    },
    [recordId],
  )

  return { reviews, isLoading, createReview, updateReview, deleteReview }
}
