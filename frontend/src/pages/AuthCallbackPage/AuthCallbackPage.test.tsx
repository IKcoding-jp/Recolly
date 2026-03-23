import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthCallbackPage } from './AuthCallbackPage'

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
const mockRefreshUser = vi.fn()
vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    refreshUser: mockRefreshUser,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockRefreshUser.mockResolvedValue(undefined)
})

function renderWithRoute(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <AuthCallbackPage />
    </MemoryRouter>,
  )
}

describe('AuthCallbackPage', () => {
  it('status=successでrefreshUserを呼び/dashboardに遷移する', async () => {
    renderWithRoute('?status=success')

    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('status=provider_linkedでrefreshUserを呼び/settingsに遷移する', async () => {
    renderWithRoute('?status=provider_linked')

    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/settings', {
        replace: true,
        state: { message: 'OAuth連携が完了しました' },
      })
    })
  })

  it('status=new_userで/auth/completeに遷移する', async () => {
    renderWithRoute('?status=new_user')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/auth/complete', { replace: true })
    })
  })

  it('status=errorでエラーメッセージ付きで/に遷移する', async () => {
    renderWithRoute('?status=error&message=email_already_registered')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', {
        replace: true,
        state: {
          error: 'このメールアドレスは既に登録されています。メールアドレスでログインしてください',
        },
      })
    })
  })

  it('認証処理中のメッセージを表示する', () => {
    renderWithRoute('?status=success')
    expect(screen.getByText('認証処理中...')).toBeInTheDocument()
  })
})
