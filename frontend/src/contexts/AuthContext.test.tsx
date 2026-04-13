import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

// fetchをモック化
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// PostHog ラッパーをモック化（実際のネットワーク通信を発生させない）
vi.mock('../lib/analytics/posthog', () => ({
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
}))

import { identifyUser, resetAnalytics } from '../lib/analytics/posthog'

beforeEach(() => {
  mockFetch.mockReset()
  vi.mocked(identifyUser).mockClear()
  vi.mocked(resetAnalytics).mockClear()
})

// AuthContextの値を表示するテスト用コンポーネント
function TestConsumer() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="username">{user?.username ?? 'none'}</span>
      <button onClick={logout}>ログアウト</button>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </BrowserRouter>,
  )
}

describe('AuthContext', () => {
  it('初回ロード時にセッション確認APIを呼ぶ', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'ログインが必要です' }),
    })

    renderWithProvider()

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
  })

  it('セッションが有効な場合、isAuthenticatedがtrueになる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          user: {
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
            avatar_url: null,
            bio: null,
            created_at: '2026-04-01T00:00:00Z',
            has_password: true,
            providers: [],
            email_missing: false,
          },
        }),
    })

    renderWithProvider()

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    expect(screen.getByTestId('username')).toHaveTextContent('testuser')
  })

  it('ログアウト後にisAuthenticatedがfalseになる', async () => {
    // 初回: ログイン済み
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          user: {
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
            avatar_url: null,
            bio: null,
            created_at: '2026-04-01T00:00:00Z',
            has_password: true,
            providers: [],
            email_missing: false,
          },
        }),
    })

    renderWithProvider()

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    })

    // ログアウトAPI
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'ログアウトしました' }),
    })

    await userEvent.click(screen.getByText('ログアウト'))

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
    })
  })

  describe('analytics integration', () => {
    it('セッション復帰時 (email 登録) に identifyUser が email で呼ばれる', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            user: {
              id: 7,
              username: 'alice',
              email: 'alice@example.com',
              avatar_url: null,
              bio: null,
              created_at: '2026-04-01T00:00:00Z',
              has_password: true,
              providers: [],
              email_missing: false,
            },
          }),
      })

      renderWithProvider()

      await waitFor(() => {
        expect(identifyUser).toHaveBeenCalledWith({
          id: 7,
          signup_method: 'email',
          signup_date: '2026-04-01T00:00:00Z',
        })
      })
    })

    it('セッション復帰時 (Google 連携済) に identifyUser が google で呼ばれる', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            user: {
              id: 99,
              username: 'bob',
              email: 'bob@example.com',
              avatar_url: null,
              bio: null,
              created_at: '2026-03-15T00:00:00Z',
              has_password: false,
              providers: ['google_oauth2'],
              email_missing: false,
            },
          }),
      })

      renderWithProvider()

      await waitFor(() => {
        expect(identifyUser).toHaveBeenCalledWith({
          id: 99,
          signup_method: 'google',
          signup_date: '2026-03-15T00:00:00Z',
        })
      })
    })

    it('ログアウト時に resetAnalytics が呼ばれる', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            user: {
              id: 1,
              username: 'testuser',
              email: 'test@example.com',
              avatar_url: null,
              bio: null,
              created_at: '2026-04-01T00:00:00Z',
              has_password: true,
              providers: [],
              email_missing: false,
            },
          }),
      })

      renderWithProvider()

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'ログアウトしました' }),
      })

      await userEvent.click(screen.getByText('ログアウト'))

      await waitFor(() => {
        expect(resetAnalytics).toHaveBeenCalled()
      })
    })

    it('未ログイン状態で初回ロード完了しても identifyUser / resetAnalytics は呼ばれない', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'ログインが必要です' }),
      })

      renderWithProvider()

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false')
      })
      expect(identifyUser).not.toHaveBeenCalled()
      expect(resetAnalytics).not.toHaveBeenCalled()
    })
  })
})
