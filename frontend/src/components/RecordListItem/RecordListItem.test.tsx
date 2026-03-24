import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RecordListItem } from './RecordListItem'
import type { UserRecord } from '../../lib/types'

const mockRecord: UserRecord = {
  id: 1,
  work_id: 10,
  status: 'watching',
  rating: 8,
  current_episode: 32,
  rewatch_count: 0,
  started_at: '2026-01-15',
  completed_at: null,
  created_at: '2026-01-15T10:00:00Z',
  work: {
    id: 10,
    title: '進撃の巨人',
    media_type: 'anime',
    description: null,
    cover_image_url: 'https://example.com/cover.jpg',
    total_episodes: 75,
    external_api_id: null,
    external_api_source: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
}

function renderWithRouter(record: UserRecord) {
  return render(
    <MemoryRouter>
      <RecordListItem record={record} />
    </MemoryRouter>,
  )
}

describe('RecordListItem', () => {
  it('タイトルが表示される', () => {
    renderWithRouter(mockRecord)
    expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
  })

  it('ステータスバッジが表示される', () => {
    renderWithRouter(mockRecord)
    expect(screen.getByText('視聴中')).toBeInTheDocument()
  })

  it('評価が表示される', () => {
    renderWithRouter(mockRecord)
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('進捗が表示される（total_episodes がある場合）', () => {
    renderWithRouter(mockRecord)
    expect(screen.getByText('32 / 75話')).toBeInTheDocument()
  })

  it('作品詳細ページへのリンクが設定される', () => {
    renderWithRouter(mockRecord)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/works/10')
  })

  it('評価がない場合は評価を表示しない', () => {
    const noRating = { ...mockRecord, rating: null }
    renderWithRouter(noRating)
    expect(screen.queryByText('★')).not.toBeInTheDocument()
  })

  it('total_episodes がない場合は進捗バーを表示しない', () => {
    const noEpisodes = {
      ...mockRecord,
      work: { ...mockRecord.work, total_episodes: null },
    }
    renderWithRouter(noEpisodes)
    expect(screen.queryByText(/話/)).not.toBeInTheDocument()
  })

  it('本のステータスバッジは「読書中」と表示される', () => {
    const bookRecord: UserRecord = {
      ...mockRecord,
      work: { ...mockRecord.work, media_type: 'book', total_episodes: null },
    }
    renderWithRouter(bookRecord)
    expect(screen.getByText('読書中')).toBeInTheDocument()
  })

  it('ゲームの completed は「プレイ完了」と表示される', () => {
    const gameRecord: UserRecord = {
      ...mockRecord,
      status: 'completed',
      work: { ...mockRecord.work, media_type: 'game', total_episodes: null },
    }
    renderWithRouter(gameRecord)
    expect(screen.getByText('プレイ完了')).toBeInTheDocument()
  })
})
