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

  it('「記録する」ボタンは表示されない（カード全体がクリック対象のため）', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '記録する' })).not.toBeInTheDocument()
  })

  it('カードクリックでコールバックが呼ばれる', async () => {
    const onRecord = vi.fn()
    render(<WorkCard work={mockWork} onRecord={onRecord} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'テスト作品を記録する' }))
    expect(onRecord).toHaveBeenCalledWith(mockWork)
  })

  it('Enterキーでコールバックが呼ばれる', async () => {
    const onRecord = vi.fn()
    render(<WorkCard work={mockWork} onRecord={onRecord} />)
    const user = userEvent.setup()
    screen.getByRole('button', { name: 'テスト作品を記録する' }).focus()
    await user.keyboard('{Enter}')
    expect(onRecord).toHaveBeenCalledWith(mockWork)
  })

  it('記録済みの場合はカードクリックでもコールバックが呼ばれる', async () => {
    const onRecord = vi.fn()
    render(<WorkCard work={mockWork} onRecord={onRecord} isRecorded />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'テスト作品（記録済み）' }))
    expect(onRecord).toHaveBeenCalledWith(mockWork)
  })

  it('記録済みの場合も「記録済み」の文字は表示しない（一覧上は記録有無を表示しない）', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} isRecorded />)
    expect(screen.queryByText('記録済み')).not.toBeInTheDocument()
  })

  it('カバー画像が表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg')
  })

  it('説明文は表示しない（ADR-0044: 検索カードはジャケット・ジャンル・タイトルのみ）', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    expect(screen.queryByText('テストの説明文')).not.toBeInTheDocument()
  })

  it('カバー画像がない場合はプレースホルダーを表示する', () => {
    const { container } = render(
      <WorkCard work={{ ...mockWork, cover_image_url: null }} onRecord={vi.fn()} />,
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('[class*="coverPlaceholder"]')).toBeInTheDocument()
  })
})
