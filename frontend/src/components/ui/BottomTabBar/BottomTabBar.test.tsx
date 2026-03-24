import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomTabBar } from './BottomTabBar'

function renderWithRouter(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomTabBar />
    </MemoryRouter>,
  )
}

describe('BottomTabBar', () => {
  it('4つのタブを表示する', () => {
    renderWithRouter()
    expect(screen.getByText('ホーム')).toBeInTheDocument()
    expect(screen.getByText('検索')).toBeInTheDocument()
    expect(screen.getByText('ライブラリ')).toBeInTheDocument()
    expect(screen.getByText('設定')).toBeInTheDocument()
  })

  it('各タブが正しいリンク先を持つ', () => {
    renderWithRouter()
    expect(screen.getByText('ホーム').closest('a')).toHaveAttribute('href', '/dashboard')
    expect(screen.getByText('検索').closest('a')).toHaveAttribute('href', '/search')
    expect(screen.getByText('ライブラリ').closest('a')).toHaveAttribute('href', '/library')
    expect(screen.getByText('設定').closest('a')).toHaveAttribute('href', '/settings')
  })

  it('現在のパスに対応するタブがアクティブになる', () => {
    renderWithRouter('/search')
    const searchTab = screen.getByText('検索').closest('a')
    expect(searchTab?.className).toMatch(/active/)
  })

  it('ダッシュボードパスでホームタブがアクティブになる', () => {
    renderWithRouter('/dashboard')
    const homeTab = screen.getByText('ホーム').closest('a')
    expect(homeTab?.className).toMatch(/active/)
  })

  it('/settings/xxxのようなサブパスで設定タブがアクティブになる', () => {
    renderWithRouter('/settings/account')
    const settingsTab = screen.getByText('設定').closest('a')
    expect(settingsTab?.className).toMatch(/active/)
  })

  it('/works/:idではどのタブもアクティブにならない', () => {
    renderWithRouter('/works/123')
    const tabs = screen.getAllByRole('link')
    tabs.forEach((tab) => {
      expect(tab.className).not.toMatch(/active/)
    })
  })
})
