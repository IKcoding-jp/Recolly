import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { MediaPreferenceProfile } from '../../types/mediaPreferenceProfile'
import { MediaTabContent } from './MediaTabContent'

const defaultProps = {
  onRecord: vi.fn(),
  recordedIds: new Set<string>(),
  recordingId: null,
}

const renderWithRouter = (profile: MediaPreferenceProfile) =>
  render(
    <MemoryRouter>
      <MediaTabContent profile={profile} {...defaultProps} />
    </MemoryRouter>,
  )

describe('MediaTabContent', () => {
  it('generating状態でスピナーを表示する', () => {
    renderWithRouter({ media_type: 'anime', status: 'generating', record_count: 0 })
    expect(screen.getByText('アニメの分析中...')).toBeInTheDocument()
  })

  it('ready状態で傾向文とおすすめ作品を表示する', () => {
    renderWithRouter({
      media_type: 'movie',
      status: 'ready',
      analysis_summary: 'アニメの好みから映画を推定しました',
      same_media_works: [
        {
          title: 'インセプション',
          media_type: 'movie',
          description: '夢の中の物語',
          cover_url: null,
          reason: '構造の凝った物語が好きなあなたへ',
          external_api_id: '1',
          external_api_source: 'tmdb',
          metadata: {},
        },
      ],
      record_count: 0,
      analyzed_at: '2026-07-19T00:00:00Z',
    })
    expect(screen.getByText('アニメの好みから映画を推定しました')).toBeInTheDocument()
    expect(screen.getByText('インセプション')).toBeInTheDocument()
    expect(screen.getByText('映画のおすすめ')).toBeInTheDocument()
  })

  it('記録0件でもready状態ならおすすめを表示する（進捗カードを出さない）', () => {
    renderWithRouter({
      media_type: 'movie',
      status: 'ready',
      analysis_summary: '推定傾向',
      same_media_works: [],
      record_count: 0,
      analyzed_at: '2026-07-19T00:00:00Z',
    })
    expect(screen.queryByText(/あと\d+件記録すると/)).not.toBeInTheDocument()
  })
})
