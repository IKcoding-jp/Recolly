// frontend/src/components/RecordCompactItem/RecordCompactItem.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { RecordCompactItem } from './RecordCompactItem'
import type { UserRecord } from '../../lib/types'

const baseRecord: UserRecord = {
  id: 1,
  work_id: 10,
  status: 'watching',
  rating: 8,
  current_episode: 5,
  rewatch_count: 0,
  review_text: null,
  visibility: 'public_record',
  started_at: null,
  completed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  work: {
    id: 10,
    title: '進撃の巨人',
    media_type: 'anime',
    description: null,
    cover_image_url: null,
    total_episodes: 25,
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
      <RecordCompactItem record={record} />
    </MemoryRouter>,
  )
}

describe('RecordCompactItem', () => {
  it('タイトルを表示する', () => {
    renderWithRouter(baseRecord)
    expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
  })

  it('ステータスバッジを表示する', () => {
    renderWithRouter(baseRecord)
    expect(screen.getByText('視聴中')).toBeInTheDocument()
  })

  it('評価を表示する', () => {
    renderWithRouter(baseRecord)
    expect(screen.getByText('★')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('評価がnullのときは評価を表示しない', () => {
    const recordWithoutRating = { ...baseRecord, rating: null }
    renderWithRouter(recordWithoutRating)
    expect(screen.queryByText('★')).not.toBeInTheDocument()
  })

  it('作品詳細ページへのリンクを生成する', () => {
    renderWithRouter(baseRecord)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/works/10')
  })
})
