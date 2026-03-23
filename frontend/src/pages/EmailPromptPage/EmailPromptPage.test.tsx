import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { EmailPromptPage } from './EmailPromptPage'

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

// accountApiをモック
vi.mock('../../lib/api', () => ({
  accountApi: {
    setEmail: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <EmailPromptPage />
    </MemoryRouter>,
  )
}

describe('EmailPromptPage', () => {
  it('メールアドレス入力フォームが表示される', () => {
    renderPage()
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '設定する' })).toBeInTheDocument()
  })

  it('「あとで設定する」ボタンで/dashboardに遷移する', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByText('あとで設定する'))

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })
})
