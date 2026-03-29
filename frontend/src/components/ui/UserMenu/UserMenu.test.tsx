import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { UserMenu } from './UserMenu'
import type { User } from '../../../lib/types'

const mockUser: User = {
  id: 1,
  username: 'IK',
  email: 'ik@example.com',
  avatar_url: null,
  bio: null,
  created_at: '2026-01-01',
  has_password: true,
  providers: [],
  email_missing: false,
}

function renderMenu(props = {}) {
  return render(
    <MemoryRouter>
      <UserMenu user={mockUser} onLogout={vi.fn()} {...props} />
    </MemoryRouter>,
  )
}

describe('UserMenu', () => {
  it('イニシャルアバターを表示する', () => {
    renderMenu()
    expect(screen.getByText('IK')).toBeInTheDocument()
  })

  it('クリックでドロップダウンを表示する（プロフィール→設定の順）', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button', { name: 'ユーザーメニュー' }))
    expect(screen.getByText('ik@example.com')).toBeInTheDocument()
    expect(screen.getByText('ログアウト')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'プロフィール' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '設定' })).toBeInTheDocument()

    const links = screen.getAllByRole('link')
    const profileIndex = links.findIndex((l) => l.textContent === 'プロフィール')
    const settingsIndex = links.findIndex((l) => l.textContent === '設定')
    expect(profileIndex).toBeLessThan(settingsIndex)
  })

  it('ログアウトをクリックするとonLogoutが呼ばれる', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    render(
      <MemoryRouter>
        <UserMenu user={mockUser} onLogout={onLogout} />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'ユーザーメニュー' }))
    await user.click(screen.getByText('ログアウト'))
    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('ドロップダウン外クリックで閉じる', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button', { name: 'ユーザーメニュー' }))
    expect(screen.getByText('ik@example.com')).toBeInTheDocument()
    await user.click(document.body)
    expect(screen.queryByText('ik@example.com')).not.toBeInTheDocument()
  })
})
