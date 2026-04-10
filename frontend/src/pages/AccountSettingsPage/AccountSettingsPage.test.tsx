import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AccountSettingsPage } from './AccountSettingsPage'
import type { User } from '../../lib/types'

// APIモック
const mockUnlinkProvider = vi.fn()
const mockSetPassword = vi.fn()

vi.mock('../../lib/api', () => ({
  accountApi: {
    unlinkProvider: (...args: unknown[]) => mockUnlinkProvider(...args),
    setPassword: (...args: unknown[]) => mockSetPassword(...args),
  },
  googleAuthApi: {
    signIn: vi.fn(),
    linkProvider: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number
    code?: string
    constructor(message: string, status: number, code?: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.code = code
    }
  },
}))

// useAuthをモック（テストごとにユーザーを切り替え）
const mockSetUser = vi.fn()
let mockUser: User | null = null

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    setUser: mockSetUser,
  }),
}))

// OAuthButtons は複雑なGIS初期化処理を含むため、
// このテストでは単純なダミーに差し替える（機能テストはOAuthButtons側で実施）
vi.mock('../../components/OAuthButtons/OAuthButtons', () => ({
  OAuthButtons: ({ mode }: { mode?: string }) => (
    <div data-testid={`oauth-buttons-${mode ?? 'sign_in'}`}>Googleログイン</div>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = null
})

afterEach(() => {
  mockUser = null
})

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountSettingsPage />
    </MemoryRouter>,
  )
}

describe('AccountSettingsPage', () => {
  it('連携済みプロバイダーに「連携済み」ラベルを表示する', () => {
    mockUser = createUser({ providers: ['google_oauth2'], has_password: true })
    renderPage()

    expect(screen.getByText('Google')).toBeInTheDocument()
    expect(screen.getAllByText('連携済み').length).toBeGreaterThanOrEqual(1)
  })

  it('未連携プロバイダーにOAuthButtons（linkモード）を表示する', () => {
    mockUser = createUser({ providers: [], has_password: true })
    renderPage()

    expect(screen.getByTestId('oauth-buttons-link')).toBeInTheDocument()
  })

  it('パスワード未設定時は「パスワードを設定」と表示する', () => {
    mockUser = createUser({ providers: ['google_oauth2'], has_password: false })
    renderPage()

    expect(screen.getByText('パスワードを設定')).toBeInTheDocument()
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '設定する' })).toBeInTheDocument()
  })

  it('パスワード設定済み時は「パスワードを変更」と表示する', () => {
    mockUser = createUser({ providers: [], has_password: true })
    renderPage()

    expect(screen.getByText('パスワードを変更')).toBeInTheDocument()
    expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '変更する' })).toBeInTheDocument()
  })

  it('連携解除失敗時（last_login_method）に ActionErrorCard が表示される', async () => {
    const user = userEvent.setup()
    mockUser = createUser({ providers: ['google_oauth2'], has_password: true })
    const { ApiError: MockApiError } = await import('../../lib/api')
    mockUnlinkProvider.mockRejectedValue(
      new MockApiError(
        '最後のログイン手段は解除できません。先にパスワードを設定するか、別のOAuthを連携してください',
        422,
        'last_login_method',
      ),
    )

    renderPage()

    const unlinkButton = screen.getByRole('button', { name: '解除' })
    await user.click(unlinkButton)

    await waitFor(() => {
      expect(screen.getByText('解除できません')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'パスワードを設定する' })).toBeInTheDocument()
    })
  })

  it('連携解除失敗時（その他エラー）は従来通りテキスト表示', async () => {
    const user = userEvent.setup()
    mockUser = createUser({ providers: ['google_oauth2'], has_password: true })
    const { ApiError: MockApiError } = await import('../../lib/api')
    mockUnlinkProvider.mockRejectedValue(new MockApiError('サーバーエラー', 500))

    renderPage()

    const unlinkButton = screen.getByRole('button', { name: '解除' })
    await user.click(unlinkButton)

    await waitFor(() => {
      expect(screen.getByText('サーバーエラー')).toBeInTheDocument()
      expect(screen.queryByText('解除できません')).not.toBeInTheDocument()
    })
  })
})

// テスト用ユーザー生成ヘルパー
function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    avatar_url: null,
    bio: null,
    created_at: '2026-01-01',
    has_password: true,
    providers: [],
    email_missing: false,
    ...overrides,
  }
}
