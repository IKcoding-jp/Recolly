import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authApi, ApiError, request } from './api'

// fetchをモック化
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('authApi', () => {
  describe('login', () => {
    it('正常系: ユーザー情報を返す', async () => {
      const userData = { user: { id: 1, username: 'test', email: 'test@example.com' } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(userData),
      })

      const result = await authApi.login('test@example.com', 'password')
      expect(result.user.email).toBe('test@example.com')
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/login',
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      )
    })

    it('異常系: ApiErrorを投げる', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: '認証に失敗しました' }),
      })

      await expect(authApi.login('wrong@example.com', 'wrong')).rejects.toThrow(ApiError)
    })
  })

  describe('signup', () => {
    it('正常系: ユーザー情報を返す', async () => {
      const userData = { user: { id: 1, username: 'newuser', email: 'new@example.com' } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(userData),
      })

      const result = await authApi.signup('newuser', 'new@example.com', 'password', 'password')
      expect(result.user.username).toBe('newuser')
    })
  })

  describe('logout', () => {
    it('正常系: メッセージを返す', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'ログアウトしました' }),
      })

      const result = await authApi.logout()
      expect(result.message).toBe('ログアウトしました')
    })
  })

  describe('getCurrentUser', () => {
    it('正常系: ユーザー情報を返す', async () => {
      const userData = { user: { id: 1, username: 'test', email: 'test@example.com' } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(userData),
      })

      const result = await authApi.getCurrentUser()
      expect(result.user.email).toBe('test@example.com')
    })
  })
})

describe('ApiError', () => {
  it('ステータスコードを保持する', () => {
    const error = new ApiError('テストエラー', 401)
    expect(error.message).toBe('テストエラー')
    expect(error.status).toBe(401)
    expect(error.name).toBe('ApiError')
  })
})

describe('request', () => {
  it('204 No Contentでundefinedを返す', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 204,
      ok: true,
    })

    const result = await request<void>('/test', { method: 'DELETE' })
    expect(result).toBeUndefined()
  })

  it('200レスポンスでは従来通りJSONをパースする', async () => {
    const data = { message: 'success' }
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(data),
    })

    const result = await request<{ message: string }>('/test')
    expect(result).toEqual(data)
  })

  it('code フィールドがあれば errorMessages.ts 辞書経由でメッセージを返す', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          error: 'raw backend message',
          code: 'email_already_registered',
          message: 'raw backend message',
        }),
    })

    await expect(request<never>('/test')).rejects.toThrow(
      /このメールアドレスは既にメール\+パスワードで登録/,
    )
  })

  it('ApiError に code プロパティがセットされる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: () =>
        Promise.resolve({
          error: '最後のログイン手段',
          code: 'last_login_method',
          message: '最後のログイン手段',
        }),
    })

    try {
      await request<never>('/test')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).code).toBe('last_login_method')
      expect((err as ApiError).status).toBe(422)
    }
  })

  it('code がない場合は従来の error フィールドをそのまま使う', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'ログインが必要です' }),
    })

    await expect(request<never>('/test')).rejects.toThrow('ログインが必要です')
  })

  it('fetch 自体が失敗（TypeError）したらネットワークエラーとして扱う', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    try {
      await request<never>('/test')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).code).toBe('network_error')
      expect((err as ApiError).status).toBe(0)
      expect((err as ApiError).message).toContain('ネットワーク')
    }
  })
})
