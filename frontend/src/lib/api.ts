import type { AuthResponse, ErrorResponse, GoogleAuthResponse } from './types'
import { getErrorMessage } from './errorMessages'

const API_BASE = '/api/v1'

// 共通のfetchラッパー（credentials: 'include' でCookieを自動送信）
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } catch (err) {
    // fetch 自体の失敗（ネットワーク不通、CORSエラー等）は TypeError として送出される
    if (err instanceof TypeError) {
      throw new ApiError(
        'ネットワークに接続できませんでした。通信環境をご確認ください',
        0,
        'network_error',
      )
    }
    throw err
  }

  // ボディなしレスポンス（204 No Content）はJSONパースをスキップ
  if (response.status === 204) {
    return undefined as T
  }

  const data: unknown = await response.json()

  if (!response.ok) {
    const errorData = data as ErrorResponse
    const rawMessage =
      errorData.error ?? errorData.message ?? errorData.errors?.join(', ') ?? 'エラーが発生しました'
    // code があれば errorMessages.ts 辞書経由で日本語メッセージに変換、なければ raw を使う
    const message = getErrorMessage(errorData.code, rawMessage)
    throw new ApiError(message, response.status, errorData.code)
  }

  return data as T
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
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

  updatePassword(
    resetPasswordToken: string,
    password: string,
    passwordConfirmation: string,
  ): Promise<{ message: string }> {
    return request<{ message: string }>('/password', {
      method: 'PUT',
      body: JSON.stringify({
        user: {
          reset_password_token: resetPasswordToken,
          password,
          password_confirmation: passwordConfirmation,
        },
      }),
    })
  },
}

// CSRFトークン取得API
export const csrfApi = {
  getToken(): Promise<{ token: string }> {
    return request<{ token: string }>('/csrf_token')
  },
}

// OAuth関連API
export const oauthApi = {
  completeRegistration(username: string): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/complete_registration', {
      method: 'POST',
      body: JSON.stringify({ username }),
    })
  },
}

// Google Identity Services (ADR-0035) のID Tokenを検証してログインする
export const googleAuthApi = {
  // 未ログイン状態でID Token検証 + ログイン/新規登録判定
  signIn(credential: string): Promise<GoogleAuthResponse> {
    return request<GoogleAuthResponse>('/auth/google_id_token', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    })
  },
  // ログイン済みユーザーがGoogleアカウントを連携追加する
  linkProvider(credential: string): Promise<AuthResponse> {
    return request<AuthResponse>('/account_settings/link_provider', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    })
  },
}

// アカウント設定API
export const accountApi = {
  setEmail(email: string): Promise<AuthResponse> {
    return request<AuthResponse>('/account_settings/set_email', {
      method: 'PUT',
      body: JSON.stringify({ email }),
    })
  },
  unlinkProvider(provider: string): Promise<AuthResponse> {
    return request<AuthResponse>('/account_settings/unlink_provider', {
      method: 'DELETE',
      body: JSON.stringify({ provider }),
    })
  },
  setPassword(password: string, passwordConfirmation: string): Promise<AuthResponse> {
    return request<AuthResponse>('/account_settings/set_password', {
      method: 'PUT',
      body: JSON.stringify({ password, password_confirmation: passwordConfirmation }),
    })
  },
}
