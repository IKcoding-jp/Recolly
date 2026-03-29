import type { PublicRecordsResponse, UserProfileResponse } from './types'
import { request } from './api'

type UserRecordFilterParams = {
  mediaType?: string
  sort?: string
  page?: number
  perPage?: number
}

export const usersApi = {
  getProfile(userId: number): Promise<UserProfileResponse> {
    return request<UserProfileResponse>(`/users/${userId}`)
  },

  getRecords(userId: number, filters?: UserRecordFilterParams): Promise<PublicRecordsResponse> {
    const params = new URLSearchParams()
    if (filters?.mediaType) params.set('media_type', filters.mediaType)
    if (filters?.sort) params.set('sort', filters.sort)
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.perPage) params.set('per_page', String(filters.perPage))
    const query = params.toString()
    return request<PublicRecordsResponse>(`/users/${userId}/records${query ? `?${query}` : ''}`)
  },
}
