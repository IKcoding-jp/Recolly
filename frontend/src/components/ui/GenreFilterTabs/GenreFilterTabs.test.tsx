import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GenreFilterTabs } from './GenreFilterTabs'

describe('GenreFilterTabs', () => {
  it('全ジャンルのタブを表示する', () => {
    render(<GenreFilterTabs value="all" onChange={() => {}} />)
    for (const label of ['すべて', 'アニメ', '映画', 'ドラマ', '本', '漫画・ラノベ', 'ゲーム']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('value に一致するタブが選択状態になる', () => {
    render(<GenreFilterTabs value="anime" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'アニメ' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'すべて' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('タブクリックで onChange がそのジャンル値で呼ばれる', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()
    render(<GenreFilterTabs value="all" onChange={handleChange} />)

    await user.click(screen.getByRole('button', { name: 'ゲーム' }))

    expect(handleChange).toHaveBeenCalledWith('game')
  })
})
