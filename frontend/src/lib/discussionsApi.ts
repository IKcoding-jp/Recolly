import type { DiscussionResponse, DiscussionsResponse } from './types'
import { request } from './api'

type DiscussionFilterParams = {
  workId?: number
  episodeNumber?: number
  mediaType?: string
  sort?: string
  page?: number
  perPage?: number
}

type CreateDiscussionParams = {
  title: string
  body: string
  episode_number?: number | null
  has_spoiler?: boolean
}

type UpdateDiscussionParams = {
  title?: string
  body?: string
  episode_number?: number | null
  has_spoiler?: boolean
}

export const discussionsApi = {
  getByWork(workId: number, filters?: DiscussionFilterParams): Promise<DiscussionsResponse> {
    const params = new URLSearchParams()
    if (filters?.episodeNumber) params.set('episode_number', String(filters.episodeNumber))
    if (filters?.sort) params.set('sort', filters.sort)
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.perPage) params.set('per_page', String(filters.perPage))
    const query = params.toString()
    return request<DiscussionsResponse>(`/works/${workId}/discussions${query ? `?${query}` : ''}`)
  },

  getAll(filters?: DiscussionFilterParams): Promise<DiscussionsResponse> {
    const params = new URLSearchParams()
    if (filters?.workId) params.set('work_id', String(filters.workId))
    if (filters?.mediaType) params.set('media_type', filters.mediaType)
    if (filters?.sort) params.set('sort', filters.sort)
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.perPage) params.set('per_page', String(filters.perPage))
    const query = params.toString()
    return request<DiscussionsResponse>(`/discussions${query ? `?${query}` : ''}`)
  },

  getById(id: number): Promise<DiscussionResponse> {
    return request<DiscussionResponse>(`/discussions/${id}`)
  },

  create(workId: number, data: CreateDiscussionParams): Promise<DiscussionResponse> {
    return request<DiscussionResponse>(`/works/${workId}/discussions`, {
      method: 'POST',
      body: JSON.stringify({ discussion: data }),
    })
  },

  update(id: number, data: UpdateDiscussionParams): Promise<DiscussionResponse> {
    return request<DiscussionResponse>(`/discussions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ discussion: data }),
    })
  },

  delete(id: number): Promise<void> {
    return request<void>(`/discussions/${id}`, { method: 'DELETE' })
  },
}
