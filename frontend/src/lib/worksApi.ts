import type { SearchResponse, WorkResponse, MediaType } from './types'
import { request } from './api'

export const worksApi = {
  // options.signal で AbortController と連携できるようにする（検索のレース条件対策）
  // options.enrich: false で補完スキップの速報結果を要求する（二段階レスポンス）
  search(
    query: string,
    mediaType?: MediaType,
    options?: { signal?: AbortSignal; enrich?: boolean },
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query })
    if (mediaType) params.append('media_type', mediaType)
    if (options?.enrich === false) params.append('enrich', 'false')
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
