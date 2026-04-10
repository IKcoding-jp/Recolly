import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PasswordEditPage } from './PasswordEditPage'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

function renderWithToken(token: string | null) {
  const search = token ? `?reset_password_token=${token}` : ''
  return render(
    <MemoryRouter initialEntries={[`/password/edit${search}`]}>
      <Routes>
        <Route path="/password/edit" element={<PasswordEditPage />} />
        <Route path="/password/new" element={<div>PasswordNewPage</div>} />
        <Route path="/login" element={<div>LoginPage</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PasswordEditPage', () => {
  it('トークンなしでアクセスすると /password/new にリダイレクト', () => {
    renderWithToken(null)
    expect(screen.getByText('PasswordNewPage')).toBeInTheDocument()
  })

  it('トークン付きでアクセスするとフォームが表示される', () => {
    renderWithToken('valid-token')
    expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument()
    expect(screen.getByLabelText('新しいパスワード（確認）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'パスワードを更新' })).toBeInTheDocument()
  })

  it('パスワードが 6 文字未満なら送信ボタンが disabled', async () => {
    renderWithToken('valid-token')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('新しいパスワード'), 'short')
    await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'short')

    expect(screen.getByRole('button', { name: 'パスワードを更新' })).toBeDisabled()
  })

  it('パスワードと確認が不一致なら送信ボタンが disabled', async () => {
    renderWithToken('valid-token')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('新しいパスワード'), 'newpassword123')
    await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'different123')

    expect(screen.getByRole('button', { name: 'パスワードを更新' })).toBeDisabled()
  })

  it('バリデーション通過後に送信ボタンが enabled', async () => {
    renderWithToken('valid-token')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('新しいパスワード'), 'newpassword123')
    await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'newpassword123')

    expect(screen.getByRole('button', { name: 'パスワードを更新' })).not.toBeDisabled()
  })

  it('送信成功時に /login に遷移する', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: 'パスワードを更新しました' }),
    })

    renderWithToken('valid-token')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('新しいパスワード'), 'newpassword123')
    await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }))

    expect(await screen.findByText('LoginPage')).toBeInTheDocument()
  })

  it('PUT /api/v1/password が正しいボディで呼ばれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: 'ok' }),
    })

    renderWithToken('valid-token')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('新しいパスワード'), 'newpassword123')
    await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/password',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          user: {
            reset_password_token: 'valid-token',
            password: 'newpassword123',
            password_confirmation: 'newpassword123',
          },
        }),
      }),
    )
  })

  it('password_reset_failed エラー時に再申請リンクが表示される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: () =>
        Promise.resolve({
          code: 'password_reset_failed',
          errors: ['Reset password token is invalid'],
        }),
    })

    renderWithToken('invalid-token')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('新しいパスワード'), 'newpassword123')
    await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }))

    expect(await screen.findByText(/リンクが無効または期限切れ/)).toBeInTheDocument()
    expect(screen.getByText('パスワードリセットを再申請')).toHaveAttribute('href', '/password/new')
  })
})
