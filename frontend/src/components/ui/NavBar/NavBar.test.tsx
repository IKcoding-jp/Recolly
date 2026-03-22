// frontend/src/components/ui/NavBar/NavBar.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { NavBar } from './NavBar'

const mockUser = {
  id: 1,
  username: 'IK',
  email: 'ik@example.com',
  avatar_url: null,
  bio: null,
  created_at: '2026-01-01',
}

function renderNavBar(currentPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[currentPath]}>
      <NavBar user={mockUser} onLogout={vi.fn()} />
    </MemoryRouter>,
  )
}

describe('NavBar', () => {
  it('ロゴ「Recolly」を表示する', () => {
    renderNavBar()
    expect(screen.getByText('Recolly')).toBeInTheDocument()
  })

  it('有効なナビ項目をリンクとして表示する', () => {
    renderNavBar()
    expect(screen.getByRole('link', { name: 'ホーム' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: '検索' })).toHaveAttribute('href', '/search')
    expect(screen.getByRole('link', { name: 'ライブラリ' })).toHaveAttribute('href', '/library')
  })

  it('未実装のナビ項目はリンクではなくグレーアウトで表示する', () => {
    renderNavBar()
    expect(screen.getByText('コミュニティ')).toBeInTheDocument()
    expect(screen.getByText('おすすめ')).toBeInTheDocument()
    expect(screen.getByText('マイページ')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'コミュニティ' })).not.toBeInTheDocument()
  })

  it('現在のパスに対応するナビ項目がアクティブ状態になる', () => {
    renderNavBar('/library')
    const libraryLink = screen.getByRole('link', { name: 'ライブラリ' })
    expect(libraryLink.className).toContain('active')
  })

  it('UserMenuを表示する', () => {
    renderNavBar()
    expect(screen.getByRole('button', { name: 'ユーザーメニュー' })).toBeInTheDocument()
  })
})
