import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReviewSection } from './ReviewSection'

describe('ReviewSection', () => {
  let mockOnSave: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnSave = vi.fn().mockResolvedValue(undefined)
  })

  describe('empty モード', () => {
    it('reviewText が null の時、空状態メッセージが表示される', () => {
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      expect(screen.getByText('まだ感想が書かれていません')).toBeInTheDocument()
    })

    it('reviewText が空文字の時、空状態メッセージが表示される', () => {
      render(<ReviewSection reviewText="" onSave={mockOnSave} />)
      expect(screen.getByText('まだ感想が書かれていません')).toBeInTheDocument()
    })

    it('「感想を書く」ボタンが表示される', () => {
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      expect(screen.getByRole('button', { name: '感想を書く' })).toBeInTheDocument()
    })

    it('「感想を書く」クリックで編集モードに切り替わる', async () => {
      const user = userEvent.setup()
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '感想を書く' }))
      expect(screen.getByPlaceholderText('作品の感想を書く...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    })

    it('空状態では「編集」「保存」ボタンが表示されない', () => {
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      expect(screen.queryByRole('button', { name: '編集' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument()
    })
  })

  describe('view モード', () => {
    it('reviewText に値がある時、本文が表示される', () => {
      render(<ReviewSection reviewText="素晴らしい作品" onSave={mockOnSave} />)
      expect(screen.getByText('素晴らしい作品')).toBeInTheDocument()
    })

    it('改行を含むテキストで pre-wrap スタイルが適用される', () => {
      const text = '1行目\n2行目\n3行目'
      const { container } = render(<ReviewSection reviewText={text} onSave={mockOnSave} />)
      const textEl = container.querySelector('p')
      expect(textEl?.textContent).toBe(text)
      expect(textEl?.className).toMatch(/viewText/)
    })

    it('「編集」ボタンが表示される', () => {
      render(<ReviewSection reviewText="感想" onSave={mockOnSave} />)
      expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument()
    })

    it('「編集」クリックで編集モードに切り替わり、既存テキストが入っている', async () => {
      const user = userEvent.setup()
      render(<ReviewSection reviewText="感想" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '編集' }))
      expect(screen.getByDisplayValue('感想')).toBeInTheDocument()
    })

    it('view モードではテキストエリアが表示されない', () => {
      render(<ReviewSection reviewText="感想" onSave={mockOnSave} />)
      expect(screen.queryByPlaceholderText('作品の感想を書く...')).not.toBeInTheDocument()
    })
  })
})
