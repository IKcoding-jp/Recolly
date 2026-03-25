import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TagSection } from './TagSection'

vi.mock('../../hooks/useTags', () => ({
  useTags: () => ({
    tags: [{ id: 1, name: '泣ける', user_id: 1, created_at: '' }],
    allTags: [{ id: 1, name: '泣ける', user_id: 1, created_at: '' }],
    isLoading: false,
    addTag: vi.fn(),
    removeTag: vi.fn(),
  }),
}))

describe('TagSection', () => {
  it('付与済みタグをバッジで表示する', () => {
    render(<TagSection recordId={1} initialTags={[]} />)
    expect(screen.getByText('泣ける')).toBeInTheDocument()
  })

  it('タグ追加入力欄がある', () => {
    render(<TagSection recordId={1} initialTags={[]} />)
    expect(screen.getByPlaceholderText('タグを追加...')).toBeInTheDocument()
  })

  it('タグ削除ボタンがある', () => {
    render(<TagSection recordId={1} initialTags={[]} />)
    expect(screen.getByLabelText('泣けるを削除')).toBeInTheDocument()
  })

  it('追加ボタンがある', () => {
    render(<TagSection recordId={1} initialTags={[]} />)
    expect(screen.getByText('追加')).toBeInTheDocument()
  })
})
