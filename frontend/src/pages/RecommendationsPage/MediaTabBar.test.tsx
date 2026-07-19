import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MediaTabBar } from './MediaTabBar'

describe('MediaTabBar', () => {
  it('全体タブを含む7タブを表示する', () => {
    render(<MediaTabBar activeTab="overall" onTabChange={vi.fn()} />)
    expect(screen.getByRole('tab', { name: '全体' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'アニメ' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '映画' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'ドラマ' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '本' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '漫画・ラノベ' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'ゲーム' })).toBeInTheDocument()
  })

  it('件数バッジを表示しない', () => {
    render(<MediaTabBar activeTab="overall" onTabChange={vi.fn()} />)
    // タブ名は数字を含まない（バッジ廃止）
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument()
  })

  it('タブをクリックするとonTabChangeが呼ばれる', async () => {
    const onTabChange = vi.fn()
    const user = userEvent.setup()
    render(<MediaTabBar activeTab="overall" onTabChange={onTabChange} />)
    await user.click(screen.getByRole('tab', { name: 'アニメ' }))
    expect(onTabChange).toHaveBeenCalledWith('anime')
  })
})
