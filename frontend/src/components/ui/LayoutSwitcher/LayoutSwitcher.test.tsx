// frontend/src/components/ui/LayoutSwitcher/LayoutSwitcher.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { LayoutSwitcher } from './LayoutSwitcher'

describe('LayoutSwitcher', () => {
  it('件数を表示する', () => {
    render(<LayoutSwitcher currentLayout="list" totalCount={12} onLayoutChange={vi.fn()} />)
    expect(screen.getByText('12件の作品')).toBeInTheDocument()
  })

  it('3つのレイアウトボタンを表示する', () => {
    render(<LayoutSwitcher currentLayout="list" totalCount={5} onLayoutChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'リスト表示' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'カード表示' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'コンパクト表示' })).toBeInTheDocument()
  })

  it('選択中のレイアウトボタンにaria-pressed=trueが付く', () => {
    render(<LayoutSwitcher currentLayout="card" totalCount={5} onLayoutChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'リスト表示' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'カード表示' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'コンパクト表示' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('ボタンクリックでonLayoutChangeが呼ばれる', async () => {
    const user = userEvent.setup()
    const onLayoutChange = vi.fn()
    render(<LayoutSwitcher currentLayout="list" totalCount={5} onLayoutChange={onLayoutChange} />)

    await user.click(screen.getByRole('button', { name: 'カード表示' }))
    expect(onLayoutChange).toHaveBeenCalledWith('card')

    await user.click(screen.getByRole('button', { name: 'コンパクト表示' }))
    expect(onLayoutChange).toHaveBeenCalledWith('compact')
  })
})
