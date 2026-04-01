import type { AuthResponse, FavoriteWorksResponse, PresignResponse } from './types'
import { request } from './api'

export const profileApi = {
  update(params: {
    bio?: string
    avatar_url?: string | null
    favorite_display_mode?: 'ranking' | 'favorites'
  }): Promise<AuthResponse> {
    return request<AuthResponse>('/profile', {
      method: 'PATCH',
      body: JSON.stringify({ profile: params }),
    })
  },

  presignAvatar(fileName: string, contentType: string, fileSize: number): Promise<PresignResponse> {
    return request<PresignResponse>('/profile/presign_avatar', {
      method: 'POST',
      body: JSON.stringify({
        image: { file_name: fileName, content_type: contentType, file_size: fileSize },
      }),
    })
  },

  getFavoriteWorks(userId: number): Promise<FavoriteWorksResponse> {
    return request<FavoriteWorksResponse>(`/users/${userId}/favorite_works`)
  },

  updateFavoriteWorks(
    items: Array<{ work_id: number; position: number }>,
  ): Promise<{ favorite_works: FavoriteWorksResponse['favorite_works'] }> {
    return request<{ favorite_works: FavoriteWorksResponse['favorite_works'] }>(
      '/profile/favorite_works',
      {
        method: 'PUT',
        body: JSON.stringify({ favorite_works: items }),
      },
    )
  },
}
