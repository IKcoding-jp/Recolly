// frontend/src/components/RecordCardItem/RecordCardItem.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { RecordCardItem } from './RecordCardItem'
import type { UserRecord } from '../../lib/types'

const baseRecord: UserRecord = {
  id: 1,
  work_id: 10,
  status: 'completed',
  rating: 9,
  current_episode: 72,
  rewatch_count: 0,
  review_text: null,
  visibility: 'public_record',
  started_at: null,
  completed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  work: {
    id: 10,
    title: 'NARUTO -ナルト-',
    media_type: 'manga',
    description: null,
    cover_image_url: 'https://example.com/naruto.jpg',
    total_episodes: 72,
    external_api_id: null,
    external_api_source: null,
    metadata: {},
    last_synced_at: null,
    created_at: '2026-01-01T00:00:00Z',
  },
}

function renderWithRouter(record: UserRecord) {
  return render(
    <MemoryRouter>
      <RecordCardItem record={record} />
    </MemoryRouter>,
  )
}

describe('RecordCardItem', () => {
  it('作品タイトルを表示する', () => {
    renderWithRouter(baseRecord)
    expect(screen.getByText('NARUTO -ナルト-')).toBeInTheDocument()
  })

  it('カバー画像を表示する', () => {
    renderWithRouter(baseRecord)
    const img = screen.getByAltText('NARUTO -ナルト-のカバー画像')
    expect(img).toHaveAttribute('src', 'https://example.com/naruto.jpg')
  })

  it('カバー画像がない場合はプレースホルダーを表示する', () => {
    const recordWithoutCover = {
      ...baseRecord,
      work: { ...baseRecord.work, cover_image_url: null },
    }
    const { container } = renderWithRouter(recordWithoutCover)
    expect(container.querySelector('[class*="coverPlaceholder"]')).toBeInTheDocument()
  })

  it('評価を表示する', () => {
    renderWithRouter(baseRecord)
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('★')).toBeInTheDocument()
  })

  it('評価がnullのときは評価を表示しない', () => {
    const recordWithoutRating = { ...baseRecord, rating: null }
    renderWithRouter(recordWithoutRating)
    expect(screen.queryByText('★')).not.toBeInTheDocument()
  })

  it('ステータスバッジを表示する', () => {
    renderWithRouter(baseRecord)
    // manga + completed = '読了'
    expect(screen.getByText('読了')).toBeInTheDocument()
  })

  it('作品詳細ページへのリンクを生成する', () => {
    renderWithRouter(baseRecord)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/works/10')
  })
})
