import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { SignUpPage } from './SignUpPage'

// OAuthButtons は GIS SDK 初期化を含み、テストでは外部依存が多すぎるため差し替える
vi.mock('../../components/OAuthButtons/OAuthButtons', () => ({
  OAuthButtons: () => <div data-testid="oauth-buttons-mock">Googleログイン（mock）</div>,
}))

// PostHog ラッパーをモック化
vi.mock('../../lib/analytics/posthog', () => ({
  captureEvent: vi.fn(),
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
}))

import { captureEvent } from '../../lib/analytics/posthog'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  vi.mocked(captureEvent).mockClear()
  // 初回セッション確認: 未認証
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 401,
    json: () => Promise.resolve({ error: 'ログインが必要です' }),
  })
})

function renderSignUpPage() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <SignUpPage />
      </AuthProvider>
    </BrowserRouter>,
  )
}

describe('SignUpPage', () => {
  it('登録フォームが表示される', async () => {
    renderSignUpPage()
    expect(await screen.findByLabelText('ユーザー名')).toBeInTheDocument()
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
    expect(screen.getByLabelText('パスワード（確認）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'アカウントを作成' })).toBeInTheDocument()
  })

  it('入力して送信するとAPIが呼ばれる', async () => {
    renderSignUpPage()
    const user = userEvent.setup()

    // 登録API成功
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          user: {
            id: 1,
            username: 'newuser',
            email: 'new@example.com',
            avatar_url: null,
            bio: null,
            created_at: '2026-04-13T00:00:00Z',
            has_password: true,
            providers: [],
            email_missing: false,
          },
        }),
    })

    await user.type(await screen.findByLabelText('ユーザー名'), 'newuser')
    await user.type(screen.getByLabelText('メールアドレス'), 'new@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'password123')
    await user.type(screen.getByLabelText('パスワード（確認）'), 'password123')
    await user.click(screen.getByRole('button', { name: 'アカウントを作成' }))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/signup',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('エラー時にエラーメッセージが表示される', async () => {
    renderSignUpPage()
    const user = userEvent.setup()

    // 登録API失敗
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ errors: ['Email has already been taken'] }),
    })

    await user.type(await screen.findByLabelText('ユーザー名'), 'newuser')
    await user.type(screen.getByLabelText('メールアドレス'), 'existing@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'password123')
    await user.type(screen.getByLabelText('パスワード（確認）'), 'password123')
    await user.click(screen.getByRole('button', { name: 'アカウントを作成' }))

    expect(await screen.findByText('Email has already been taken')).toBeInTheDocument()
  })

  it('「ログインはこちら」リンクが表示される', async () => {
    renderSignUpPage()
    expect(await screen.findByText('ログインはこちら')).toHaveAttribute('href', '/login')
  })

  it('OAuthボタンが表示される', async () => {
    renderSignUpPage()
    expect(await screen.findByTestId('oauth-buttons-mock')).toBeInTheDocument()
  })

  it('登録成功時に signup_completed イベントを method=email で発火する', async () => {
    renderSignUpPage()
    const user = userEvent.setup()

    // 登録API成功
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          user: {
            id: 1,
            username: 'newuser',
            email: 'new@example.com',
            avatar_url: null,
            bio: null,
            created_at: '2026-04-13T00:00:00Z',
            has_password: true,
            providers: [],
            email_missing: false,
          },
        }),
    })

    await user.type(await screen.findByLabelText('ユーザー名'), 'newuser')
    await user.type(screen.getByLabelText('メールアドレス'), 'new@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'password123')
    await user.type(screen.getByLabelText('パスワード（確認）'), 'password123')
    await user.click(screen.getByRole('button', { name: 'アカウントを作成' }))

    await waitFor(() => {
      expect(captureEvent).toHaveBeenCalledWith('signup_completed', { method: 'email' })
    })
  })
})
