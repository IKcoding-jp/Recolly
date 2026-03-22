import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { DashboardEmptyState } from './DashboardEmptyState'

describe('DashboardEmptyState', () => {
  it('「はじめましょう」の見出しを表示する', () => {
    render(
      <MemoryRouter>
        <DashboardEmptyState />
      </MemoryRouter>,
    )
    expect(screen.getByText('はじめましょう')).toBeInTheDocument()
  })

  it('6つのジャンルピルを表示する', () => {
    render(
      <MemoryRouter>
        <DashboardEmptyState />
      </MemoryRouter>,
    )
    expect(screen.getByText('アニメ')).toBeInTheDocument()
    expect(screen.getByText('映画')).toBeInTheDocument()
    expect(screen.getByText('ドラマ')).toBeInTheDocument()
    expect(screen.getByText('本')).toBeInTheDocument()
    expect(screen.getByText('漫画')).toBeInTheDocument()
    expect(screen.getByText('ゲーム')).toBeInTheDocument()
  })

  it('3つのステップを表示する', () => {
    render(
      <MemoryRouter>
        <DashboardEmptyState />
      </MemoryRouter>,
    )
    expect(screen.getByText('作品を探す')).toBeInTheDocument()
    expect(screen.getByText('記録する')).toBeInTheDocument()
    expect(screen.getByText('進捗を更新')).toBeInTheDocument()
  })

  it('検索ページへのリンクを表示する', () => {
    render(
      <MemoryRouter>
        <DashboardEmptyState />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: '作品を探す' })
    expect(link).toHaveAttribute('href', '/search')
  })
})
