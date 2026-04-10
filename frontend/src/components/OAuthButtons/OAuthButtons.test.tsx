import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { OAuthButtons } from './OAuthButtons'
import { AuthContext } from '../../contexts/AuthContext'
import { ApiError } from '../../lib/api'
import type { User } from '../../lib/types'

// GoogleIdTokenSessions APIをモック
const mockSignIn = vi.fn()
const mockLinkProvider = vi.fn()

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    googleAuthApi: {
      signIn: (...args: unknown[]) => mockSignIn(...args),
      linkProvider: (...args: unknown[]) => mockLinkProvider(...args),
    },
  }
})

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// GIS SDK の window.google をモックするヘルパー
// initializeで受け取ったcallbackを保持して、テスト側から任意のタイミングで発火できるようにする
type GsiCallback = (response: { credential: string }) => void
function setupGoogleSdkMock() {
  const initializeMock = vi.fn()
  const renderButtonMock = vi.fn()
  let capturedCallback: GsiCallback | null = null

  initializeMock.mockImplementation((config: { callback: GsiCallback }) => {
    capturedCallback = config.callback
  })

  window.google = {
    accounts: {
      id: {
        initialize: initializeMock,
        renderButton: renderButtonMock,
        prompt: vi.fn(),
        disableAutoSelect: vi.fn(),
        cancel: vi.fn(),
      },
    },
  }

  return {
    initializeMock,
    renderButtonMock,
    triggerCallback: (credential: string) => capturedCallback?.({ credential }),
  }
}

// AuthContextのProvider（テスト用）
const mockSetUser = vi.fn()
const authContextValue = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  setUser: mockSetUser,
  refreshUser: vi.fn(),
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authContextValue}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('OAuthButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 環境変数をモック
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    delete (window as { google?: unknown }).google
  })

  describe('sign_inモード（デフォルト）', () => {
    it('「または」区切り線が表示される', () => {
      setupGoogleSdkMock()
      renderWithProviders(<OAuthButtons />)
      expect(screen.getByText('または')).toBeInTheDocument()
    })

    it('SDK読み込み後にGoogleボタンが描画される', async () => {
      const { initializeMock, renderButtonMock } = setupGoogleSdkMock()
      renderWithProviders(<OAuthButtons />)

      await waitFor(() => {
        expect(initializeMock).toHaveBeenCalledWith(
          expect.objectContaining({
            client_id: 'test-client-id.apps.googleusercontent.com',
          }),
        )
      })
      expect(renderButtonMock).toHaveBeenCalled()
    })

    it('successレスポンス時にsetUserを呼んで/dashboardへ遷移', async () => {
      const { triggerCallback } = setupGoogleSdkMock()
      const user: User = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        avatar_url: null,
        bio: null,
        created_at: '2026-04-09',
        has_password: false,
        providers: ['google_oauth2'],
        email_missing: false,
      }
      mockSignIn.mockResolvedValue({ status: 'success', user })

      renderWithProviders(<OAuthButtons />)

      await waitFor(() => expect(window.google).toBeDefined())
      triggerCallback('dummy-id-token')

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('dummy-id-token')
        expect(mockSetUser).toHaveBeenCalledWith(user)
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
      })
    })

    it('new_userレスポンス時に/auth/completeへ遷移', async () => {
      const { triggerCallback } = setupGoogleSdkMock()
      mockSignIn.mockResolvedValue({ status: 'new_user' })

      renderWithProviders(<OAuthButtons />)
      await waitFor(() => expect(window.google).toBeDefined())
      triggerCallback('dummy-id-token')

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/auth/complete', { replace: true })
      })
    })

    it('errorレスポンス時にエラーメッセージを表示', async () => {
      const { triggerCallback } = setupGoogleSdkMock()
      mockSignIn.mockResolvedValue({
        status: 'error',
        code: 'email_already_registered',
        message: 'このメールアドレスは既に登録されています',
      })

      renderWithProviders(<OAuthButtons />)
      await waitFor(() => expect(window.google).toBeDefined())
      triggerCallback('dummy-id-token')

      await waitFor(() => {
        expect(screen.getByText('このメールアドレスは既に登録されています')).toBeInTheDocument()
      })
    })

    it('signInがApiErrorをrejectしたらエラーメッセージを表示（409経路）', async () => {
      // バックエンドが 409 Conflict を返すと api.ts の request() が
      // errorMessages.ts 辞書経由で日本語メッセージに変換した ApiError を throw する。
      // OAuthButtons の catch 節が err.message を setError に渡す経路を検証。
      const { triggerCallback } = setupGoogleSdkMock()
      mockSignIn.mockRejectedValue(
        new ApiError(
          'このメールアドレスは既にメール+パスワードで登録されています。メールでログインしてください',
          409,
          'email_already_registered',
        ),
      )

      renderWithProviders(<OAuthButtons />)
      await waitFor(() => expect(window.google).toBeDefined())
      triggerCallback('dummy-id-token')

      await waitFor(() => {
        expect(screen.getByText(/既にメール\+パスワードで登録/)).toBeInTheDocument()
      })
    })

    it('email_already_registered エラー時に ActionErrorCard が表示される', async () => {
      const { triggerCallback } = setupGoogleSdkMock()
      mockSignIn.mockRejectedValue(
        new ApiError(
          'このメールアドレスは既にメール+パスワードで登録されています。メールでログインしてください',
          409,
          'email_already_registered',
        ),
      )

      const mockScrollToEmail = vi.fn()
      renderWithProviders(<OAuthButtons onScrollToEmailForm={mockScrollToEmail} />)
      await waitFor(() => expect(window.google).toBeDefined())
      triggerCallback('dummy-id-token')

      await waitFor(() => {
        expect(screen.getByText('ログイン方法が異なります')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'メールでログイン' })).toBeInTheDocument()
      })
    })

    it('email_registered_with_other_provider エラー時に ActionErrorCard が表示される（ボタンなし）', async () => {
      const { triggerCallback } = setupGoogleSdkMock()
      mockSignIn.mockRejectedValue(
        new ApiError(
          'このメールアドレスは既にGoogleで登録されています',
          409,
          'email_registered_with_other_provider',
        ),
      )

      renderWithProviders(<OAuthButtons />)
      await waitFor(() => expect(window.google).toBeDefined())
      triggerCallback('dummy-id-token')

      await waitFor(() => {
        expect(screen.getByText('別のアカウントで登録済みです')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'メールでログイン' })).not.toBeInTheDocument()
      })
    })

    it('その他のエラーは従来通りテキスト表示', async () => {
      const { triggerCallback } = setupGoogleSdkMock()
      mockSignIn.mockRejectedValue(new ApiError('不明なエラー', 500))

      renderWithProviders(<OAuthButtons />)
      await waitFor(() => expect(window.google).toBeDefined())
      triggerCallback('dummy-id-token')

      await waitFor(() => {
        expect(screen.getByText('不明なエラー')).toBeInTheDocument()
        expect(screen.queryByText('ログイン方法が異なります')).not.toBeInTheDocument()
      })
    })
  })

  describe('linkモード', () => {
    it('「または」区切り線は表示しない', () => {
      setupGoogleSdkMock()
      renderWithProviders(<OAuthButtons mode="link" />)
      expect(screen.queryByText('または')).not.toBeInTheDocument()
    })

    it('連携成功時にonLinkSuccessを呼ぶ', async () => {
      const { triggerCallback } = setupGoogleSdkMock()
      const user: User = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        avatar_url: null,
        bio: null,
        created_at: '2026-04-09',
        has_password: true,
        providers: ['google_oauth2'],
        email_missing: false,
      }
      mockLinkProvider.mockResolvedValue({ user })
      const onLinkSuccess = vi.fn()

      renderWithProviders(<OAuthButtons mode="link" onLinkSuccess={onLinkSuccess} />)
      await waitFor(() => expect(window.google).toBeDefined())
      triggerCallback('dummy-id-token')

      await waitFor(() => {
        expect(mockLinkProvider).toHaveBeenCalledWith('dummy-id-token')
        expect(onLinkSuccess).toHaveBeenCalledWith(user)
      })
    })
  })
})
