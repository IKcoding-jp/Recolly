import { request } from './api'
import type { RecommendationResponse, RefreshResponse } from '../types/recommendation'

export const recommendationsApi = {
  get(): Promise<RecommendationResponse> {
    return request<RecommendationResponse>('/recommendations')
  },

  refresh(): Promise<RefreshResponse> {
    return request<RefreshResponse>('/recommendations/refresh', {
      method: 'POST',
    })
  },
}
