import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccountSettingsPage } from './AccountSettingsPage'
import type { User } from '../../lib/types'

// CSRFトークン取得をモック
vi.mock('../../lib/api', () => ({
  csrfApi: {
    getToken: vi.fn().mockResolvedValue({ token: 'test-csrf-token' }),
  },
  accountApi: {
    unlinkProvider: vi.fn(),
    setPassword: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'ApiError'
      this.status = status
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

beforeEach(() => {
  vi.clearAllMocks()
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

  it('未連携プロバイダーに「連携する」ボタンを表示する', () => {
    mockUser = createUser({ providers: [], has_password: true })
    renderPage()

    const connectButtons = screen.getAllByText('連携する')
    expect(connectButtons).toHaveLength(2)
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
