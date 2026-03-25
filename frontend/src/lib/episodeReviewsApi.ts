import { request } from './api'
import type { EpisodeReview } from './types'

interface EpisodeReviewsListResponse {
  episode_reviews: EpisodeReview[]
}

interface EpisodeReviewResponse {
  episode_review: EpisodeReview
}

interface CreateParams {
  episode_number: number
  body: string
}

interface UpdateParams {
  body: string
}

export const episodeReviewsApi = {
  getAll(recordId: number): Promise<EpisodeReviewsListResponse> {
    return request<EpisodeReviewsListResponse>(`/records/${recordId}/episode_reviews`)
  },

  create(recordId: number, params: CreateParams): Promise<EpisodeReviewResponse> {
    return request<EpisodeReviewResponse>(`/records/${recordId}/episode_reviews`, {
      method: 'POST',
      body: JSON.stringify({ episode_review: params }),
    })
  },

  update(recordId: number, reviewId: number, params: UpdateParams): Promise<EpisodeReviewResponse> {
    return request<EpisodeReviewResponse>(`/records/${recordId}/episode_reviews/${reviewId}`, {
      method: 'PATCH',
      body: JSON.stringify({ episode_review: params }),
    })
  },

  remove(recordId: number, reviewId: number): Promise<void> {
    return request<void>(`/records/${recordId}/episode_reviews/${reviewId}`, {
      method: 'DELETE',
    })
  },
}
