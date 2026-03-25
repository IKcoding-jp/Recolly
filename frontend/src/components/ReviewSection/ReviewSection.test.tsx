import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ReviewSection } from './ReviewSection'

describe('ReviewSection', () => {
  const mockOnSave = vi.fn()

  it('感想テキストを表示する', () => {
    render(<ReviewSection reviewText="素晴らしい作品" onSave={mockOnSave} />)
    expect(screen.getByDisplayValue('素晴らしい作品')).toBeInTheDocument()
  })

  it('未記入時にプレースホルダーを表示する', () => {
    render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
    expect(screen.getByPlaceholderText('作品の感想を書く...')).toBeInTheDocument()
  })

  it('テキスト変更時に保存ボタンを表示する', async () => {
    render(<ReviewSection reviewText="" onSave={mockOnSave} />)
    const textarea = screen.getByPlaceholderText('作品の感想を書く...')
    await userEvent.type(textarea, 'テスト')
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })

  it('テキスト未変更時は保存ボタンを非表示にする', () => {
    render(<ReviewSection reviewText="既存テキスト" onSave={mockOnSave} />)
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument()
  })

  it('保存ボタン押下時にonSaveが呼ばれる', async () => {
    mockOnSave.mockResolvedValue(undefined)
    render(<ReviewSection reviewText="" onSave={mockOnSave} />)
    const textarea = screen.getByPlaceholderText('作品の感想を書く...')
    await userEvent.type(textarea, '新しい感想')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('新しい感想')
    })
  })
})
