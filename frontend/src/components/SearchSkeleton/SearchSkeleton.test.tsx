import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SearchSkeleton } from './SearchSkeleton'

describe('SearchSkeleton', () => {
  it('スケルトンカードが4枚レンダリングされる', () => {
    render(<SearchSkeleton />)
    const cards = screen.getAllByRole('status')
    expect(cards).toHaveLength(4)
  })

  it('各カードにaria-labelが設定されている', () => {
    render(<SearchSkeleton />)
    const cards = screen.getAllByRole('status')
    cards.forEach((card) => {
      expect(card).toHaveAttribute('aria-label', '読み込み中')
    })
  })
})
