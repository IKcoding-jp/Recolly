import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

// fetchをモック化
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
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
        Promise.resolve({ user: { id: 1, username: 'testuser', email: 'test@example.com' } }),
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
        Promise.resolve({ user: { id: 1, username: 'testuser', email: 'test@example.com' } }),
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
})
