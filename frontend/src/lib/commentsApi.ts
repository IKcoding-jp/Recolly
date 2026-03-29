import type { CommentResponse, CommentsResponse } from './types'
import { request } from './api'

export const commentsApi = {
  getAll(discussionId: number, page?: number): Promise<CommentsResponse> {
    const params = new URLSearchParams()
    if (page) params.set('page', String(page))
    const query = params.toString()
    return request<CommentsResponse>(
      `/discussions/${discussionId}/comments${query ? `?${query}` : ''}`,
    )
  },

  create(discussionId: number, body: string): Promise<CommentResponse> {
    return request<CommentResponse>(`/discussions/${discussionId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment: { body } }),
    })
  },

  update(id: number, body: string): Promise<CommentResponse> {
    return request<CommentResponse>(`/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ comment: { body } }),
    })
  },

  delete(id: number): Promise<void> {
    return request<void>(`/comments/${id}`, { method: 'DELETE' })
  },
}
