import type { SearchResponse, WorkResponse, MediaType } from './types'
import { request } from './api'

export const worksApi = {
  // options.signal で AbortController と連携できるようにする（検索のレース条件対策）
  search(
    query: string,
    mediaType?: MediaType,
    options?: { signal?: AbortSignal },
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query })
    if (mediaType) params.append('media_type', mediaType)
    return request<SearchResponse>(`/works/search?${params.toString()}`, {
      signal: options?.signal,
    })
  },

  create(title: string, mediaType: MediaType, description?: string): Promise<WorkResponse> {
    return request<WorkResponse>('/works', {
      method: 'POST',
      body: JSON.stringify({
        work: { title, media_type: mediaType, description },
      }),
    })
  },

  sync(workId: number): Promise<WorkResponse> {
    return request<WorkResponse>(`/works/${workId}/sync`, {
      method: 'POST',
    })
  },
}
