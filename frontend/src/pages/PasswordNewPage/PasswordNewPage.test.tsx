import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { PasswordNewPage } from './PasswordNewPage'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

function renderPasswordNewPage() {
  return render(
    <BrowserRouter>
      <PasswordNewPage />
    </BrowserRouter>,
  )
}

describe('PasswordNewPage', () => {
  it('メールアドレス入力フォームが表示される', () => {
    renderPasswordNewPage()
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'リセットメールを送信' })).toBeInTheDocument()
  })

  it('「ログインに戻る」リンクが表示される', () => {
    renderPasswordNewPage()
    expect(screen.getByText('ログインに戻る')).toHaveAttribute('href', '/login')
  })

  it('送信成功時に成功メッセージが表示されフォームが非表示になる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: 'パスワードリセットの手順をメールで送信しました' }),
    })

    renderPasswordNewPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'リセットメールを送信' }))

    expect(await screen.findByText(/メールをお送りしました/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'リセットメールを送信' })).not.toBeInTheDocument()
  })

  it('API がエラーを返したらエラーメッセージが表示される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'サーバーエラーが発生しました' }),
    })

    renderPasswordNewPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'リセットメールを送信' }))

    expect(await screen.findByText('サーバーエラーが発生しました')).toBeInTheDocument()
  })

  it('POST /api/v1/password が正しいボディで呼ばれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: 'ok' }),
    })

    renderPasswordNewPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'リセットメールを送信' }))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ user: { email: 'test@example.com' } }),
      }),
    )
  })
})
