import type { SearchResponse, WorkResponse, MediaType } from './types'
import { request } from './api'

export const worksApi = {
  search(query: string, mediaType?: MediaType): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query })
    if (mediaType) params.append('media_type', mediaType)
    return request<SearchResponse>(`/works/search?${params.toString()}`)
  },

  create(title: string, mediaType: MediaType, description?: string): Promise<WorkResponse> {
    return request<WorkResponse>('/works', {
      method: 'POST',
      body: JSON.stringify({
        work: { title, media_type: mediaType, description },
      }),
    })
  },
}
