import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { OauthUsernamePage } from './OauthUsernamePage'

// react-router-domのnavigateをモック
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// useAuthをモック
const mockSetUser = vi.fn()
vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    setUser: mockSetUser,
  }),
}))

// oauthApiをモック
const mockCompleteRegistration = vi.fn()
vi.mock('../../lib/api', () => ({
  oauthApi: {
    completeRegistration: (...args: unknown[]) => mockCompleteRegistration(...args),
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

// PostHog ラッパーをモック化
vi.mock('../../lib/analytics/posthog', () => ({
  captureEvent: vi.fn(),
}))

import { captureEvent } from '../../lib/analytics/posthog'

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <OauthUsernamePage />
    </MemoryRouter>,
  )
}

describe('OauthUsernamePage', () => {
  it('ユーザー名入力フォームが表示される', () => {
    renderPage()
    expect(screen.getByLabelText('ユーザー名')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
  })

  it('登録成功時（email_missing: false）に/dashboardへ遷移する', async () => {
    mockCompleteRegistration.mockResolvedValue({
      user: {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        email_missing: false,
        providers: ['google'],
      },
    })

    renderPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('ユーザー名'), 'testuser')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(mockCompleteRegistration).toHaveBeenCalledWith('testuser')
      expect(mockSetUser).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('登録成功時（email_missing: true）に/auth/email-setupへ遷移する', async () => {
    mockCompleteRegistration.mockResolvedValue({
      user: {
        id: 1,
        username: 'testuser',
        email: '',
        email_missing: true,
        providers: ['google'],
      },
    })

    renderPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('ユーザー名'), 'testuser')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(mockCompleteRegistration).toHaveBeenCalledWith('testuser')
      expect(mockSetUser).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/auth/email-setup', { replace: true })
    })
  })

  it('登録完了時に signup_completed イベントを method=google で発火する', async () => {
    mockCompleteRegistration.mockResolvedValue({
      user: {
        id: 42,
        username: 'alice',
        email: 'alice@example.com',
        email_missing: false,
        providers: ['google_oauth2'],
      },
    })

    renderPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('ユーザー名'), 'alice')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(captureEvent).toHaveBeenCalledWith('signup_completed', { method: 'google' })
    })
  })
})
