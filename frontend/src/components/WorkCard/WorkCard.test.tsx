import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkCard } from './WorkCard'
import type { SearchResult } from '../../lib/types'

const mockWork: SearchResult = {
  title: 'テスト作品',
  media_type: 'anime',
  description: 'テストの説明文',
  cover_image_url: 'https://example.com/cover.jpg',
  total_episodes: 12,
  external_api_id: '123',
  external_api_source: 'anilist',
  metadata: {},
}

describe('WorkCard', () => {
  it('作品タイトルが表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    expect(screen.getByText('テスト作品')).toBeInTheDocument()
  })

  it('ジャンルラベルが表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    expect(screen.getByText('アニメ')).toBeInTheDocument()
  })

  it('「記録する」ボタンが表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    expect(screen.getByRole('button', { name: '記録する' })).toBeInTheDocument()
  })

  it('「記録する」ボタン押下でコールバックが呼ばれる', async () => {
    const onRecord = vi.fn()
    render(<WorkCard work={mockWork} onRecord={onRecord} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '記録する' }))
    expect(onRecord).toHaveBeenCalledWith(mockWork)
  })

  it('記録済みの場合は「記録済み」と表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} isRecorded />)
    expect(screen.getByText('記録済み')).toBeInTheDocument()
  })

  it('カバー画像が表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg')
  })
})
