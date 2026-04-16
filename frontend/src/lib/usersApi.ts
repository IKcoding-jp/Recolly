import type { MediaType, PublicRecordsResponse, UserProfileResponse } from './types'
import { request } from './api'

export type MyMediaTypesResponse = {
  media_types: MediaType[]
}

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

  // ログイン中ユーザーが記録済みの distinct な media_type 一覧を取得する
  // distinct_media_types_count の User Property 更新（spec §4.3）で使用する
  getMyMediaTypes(): Promise<MyMediaTypesResponse> {
    return request<MyMediaTypesResponse>('/users/me/media_types')
  },
}
