import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { UserMenu } from './UserMenu'

const mockUser = {
  id: 1,
  username: 'IK',
  email: 'ik@example.com',
  avatar_url: null,
  bio: null,
  created_at: '2026-01-01',
}

describe('UserMenu', () => {
  it('イニシャルアバターを表示する', () => {
    render(<UserMenu user={mockUser} onLogout={vi.fn()} />)
    expect(screen.getByText('IK')).toBeInTheDocument()
  })

  it('クリックでドロップダウンを表示する', async () => {
    const user = userEvent.setup()
    render(<UserMenu user={mockUser} onLogout={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'ユーザーメニュー' }))
    expect(screen.getByText('ik@example.com')).toBeInTheDocument()
    expect(screen.getByText('ログアウト')).toBeInTheDocument()
    expect(screen.getByText('マイページ（準備中）')).toBeInTheDocument()
  })

  it('ログアウトをクリックするとonLogoutが呼ばれる', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    render(<UserMenu user={mockUser} onLogout={onLogout} />)
    await user.click(screen.getByRole('button', { name: 'ユーザーメニュー' }))
    await user.click(screen.getByText('ログアウト'))
    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('ドロップダウン外クリックで閉じる', async () => {
    const user = userEvent.setup()
    render(<UserMenu user={mockUser} onLogout={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'ユーザーメニュー' }))
    expect(screen.getByText('ik@example.com')).toBeInTheDocument()
    await user.click(document.body)
    expect(screen.queryByText('ik@example.com')).not.toBeInTheDocument()
  })
})
