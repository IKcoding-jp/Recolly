import type { RecordResponse, RecordsListResponse, SearchResult, RecordStatus } from './types'
import { request } from './api'

type RecordCreateOptions = {
  status?: RecordStatus
  rating?: number
}

type RecordUpdateParams = {
  status?: RecordStatus
  rating?: number | null
  current_episode?: number
  started_at?: string | null
  completed_at?: string | null
  review_text?: string | null
  rewatch_count?: number
}

type RecordFilterParams = {
  status?: RecordStatus
  mediaType?: string
  workId?: number
  sort?: string
  page?: number
  perPage?: number
  tags?: string[]
}

export const recordsApi = {
  getAll(filters?: RecordFilterParams): Promise<RecordsListResponse> {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.mediaType) params.set('media_type', filters.mediaType)
    if (filters?.workId) params.set('work_id', String(filters.workId))
    if (filters?.sort) params.set('sort', filters.sort)
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.perPage) params.set('per_page', String(filters.perPage))
    if (filters?.tags) {
      filters.tags.forEach((tag) => params.append('tag[]', tag))
    }
    const query = params.toString()
    return request<RecordsListResponse>(`/records${query ? `?${query}` : ''}`)
  },

  getOne(id: number): Promise<RecordResponse> {
    return request<RecordResponse>(`/records/${id}`)
  },

  createFromWorkId(workId: number, options?: RecordCreateOptions): Promise<RecordResponse> {
    return request<RecordResponse>('/records', {
      method: 'POST',
      body: JSON.stringify({ record: { work_id: workId, ...options } }),
    })
  },

  createFromSearchResult(
    workData: Pick<
      SearchResult,
      | 'title'
      | 'media_type'
      | 'description'
      | 'cover_image_url'
      | 'total_episodes'
      | 'external_api_id'
      | 'external_api_source'
    >,
    options?: RecordCreateOptions,
  ): Promise<RecordResponse> {
    return request<RecordResponse>('/records', {
      method: 'POST',
      body: JSON.stringify({ record: { work_data: workData, ...options } }),
    })
  },

  update(id: number, params: RecordUpdateParams): Promise<RecordResponse> {
    return request<RecordResponse>(`/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ record: params }),
    })
  },

  remove(id: number): Promise<void> {
    return request<void>(`/records/${id}`, { method: 'DELETE' })
  },
}
