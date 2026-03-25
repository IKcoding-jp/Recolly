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
})
