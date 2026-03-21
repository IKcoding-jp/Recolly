import type { AuthResponse, ErrorResponse } from './types'

const API_BASE = '/api/v1'

// 共通のfetchラッパー（credentials: 'include' でCookieを自動送信）
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data: unknown = await response.json()

  if (!response.ok) {
    const errorData = data as ErrorResponse
    const message = errorData.error ?? errorData.errors?.join(', ') ?? 'エラーが発生しました'
    throw new ApiError(message, response.status)
  }

  return data as T
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// 認証API
export const authApi = {
  login(email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ user: { email, password } }),
    })
  },

  signup(
    username: string,
    email: string,
    password: string,
    passwordConfirmation: string,
  ): Promise<AuthResponse> {
    return request<AuthResponse>('/signup', {
      method: 'POST',
      body: JSON.stringify({
        user: { username, email, password, password_confirmation: passwordConfirmation },
      }),
    })
  },

  logout(): Promise<{ message: string }> {
    return request<{ message: string }>('/logout', { method: 'DELETE' })
  },

  getCurrentUser(): Promise<AuthResponse> {
    return request<AuthResponse>('/current_user')
  },

  resetPassword(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('/password', {
      method: 'POST',
      body: JSON.stringify({ user: { email } }),
    })
  },
}
