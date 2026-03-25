import { request } from './api'
import type { Tag } from './types'

interface TagsListResponse {
  tags: Tag[]
}

interface TagResponse {
  tag: Tag
}

export const tagsApi = {
  getAll(): Promise<TagsListResponse> {
    return request<TagsListResponse>('/tags')
  },

  addToRecord(recordId: number, name: string): Promise<TagResponse> {
    return request<TagResponse>(`/records/${recordId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag: { name } }),
    })
  },

  removeFromRecord(recordId: number, tagId: number): Promise<void> {
    return request<void>(`/records/${recordId}/tags/${tagId}`, {
      method: 'DELETE',
    })
  },

  deleteTag(tagId: number): Promise<void> {
    return request<void>(`/tags/${tagId}`, {
      method: 'DELETE',
    })
  },
}
