import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { LoginPage } from './LoginPage'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  // 初回セッション確認: 未認証
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 401,
    json: () => Promise.resolve({ error: 'ログインが必要です' }),
  })
  // OAuthButtons用のCSRFトークン取得
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ token: 'test-csrf-token' }),
  })
})

function renderLoginPage() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </BrowserRouter>,
  )
}

describe('LoginPage', () => {
  it('メールアドレスとパスワードのフォームが表示される', async () => {
    renderLoginPage()
    expect(await screen.findByLabelText('メールアドレス')).toBeInTheDocument()
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
  })

  it('入力して送信するとAPIが呼ばれる', async () => {
    renderLoginPage()
    const user = userEvent.setup()

    // ログインAPI成功
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: { id: 1, username: 'test', email: 'test@example.com' } }),
    })

    await user.type(await screen.findByLabelText('メールアドレス'), 'test@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'password123')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    // ログインAPIが呼ばれたか確認（2番目のfetch呼び出し）
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/login',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('エラー時にエラーメッセージが表示される', async () => {
    renderLoginPage()
    const user = userEvent.setup()

    // ログインAPI失敗
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'メールアドレスまたはパスワードが正しくありません' }),
    })

    await user.type(await screen.findByLabelText('メールアドレス'), 'wrong@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(
      await screen.findByText('メールアドレスまたはパスワードが正しくありません'),
    ).toBeInTheDocument()
  })

  it('「アカウントを作成」リンクが表示される', async () => {
    renderLoginPage()
    expect(await screen.findByText('アカウントを作成')).toHaveAttribute('href', '/signup')
  })

  it('OAuthボタンが表示される', async () => {
    renderLoginPage()
    expect(await screen.findByText('Googleでログイン')).toBeInTheDocument()
  })
})
