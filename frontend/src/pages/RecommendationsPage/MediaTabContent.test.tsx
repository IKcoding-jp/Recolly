import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { MediaTabContent } from './MediaTabContent'
import type { MediaPreferenceProfile } from '../../types/mediaPreferenceProfile'

const readyProfile: MediaPreferenceProfile = {
  media_type: 'anime',
  status: 'ready',
  analysis_summary: 'アニメの好み傾向テスト',
  preference_scores: [],
  top_tags: [],
  same_media_works: [
    {
      title: '葬送のフリーレン',
      media_type: 'anime',
      description: '',
      cover_url: null,
      reason: 'テスト理由',
      external_api_id: '1',
      external_api_source: 'anilist',
      metadata: {},
    },
  ],
  cross_media_works: [
    {
      title: '風の谷のナウシカ',
      media_type: 'manga',
      description: '',
      cover_url: null,
      reason: 'クロス理由',
      external_api_id: '2',
      external_api_source: 'anilist',
      metadata: {},
    },
  ],
  record_count: 24,
  analyzed_at: '2026-05-09T10:00:00+09:00',
}

const wrap = (profile: MediaPreferenceProfile) =>
  render(
    <MemoryRouter>
      <MediaTabContent
        profile={profile}
        onRecord={vi.fn()}
        recordedIds={new Set()}
        recordingId={null}
      />
    </MemoryRouter>,
  )

describe('MediaTabContent', () => {
  it('ready状態: 分析テキストを表示する', () => {
    wrap(readyProfile)
    expect(screen.getByText('アニメの好み傾向テスト')).toBeInTheDocument()
  })

  it('ready状態: 同メディアおすすめを表示する', () => {
    wrap(readyProfile)
    expect(screen.getByText('葬送のフリーレン')).toBeInTheDocument()
    expect(screen.getByText('アニメのおすすめ')).toBeInTheDocument()
  })

  it('ready状態: クロスメディアおすすめを表示する', () => {
    wrap(readyProfile)
    expect(screen.getByText('風の谷のナウシカ')).toBeInTheDocument()
    expect(screen.getByText('アニメ好きにおすすめの他メディア')).toBeInTheDocument()
  })

  it('insufficient_records状態: プログレス表示', () => {
    const profile: MediaPreferenceProfile = {
      media_type: 'movie',
      status: 'insufficient_records',
      record_count: 1,
      required_count: 3,
    }
    wrap(profile)
    expect(screen.getByText(/あと2件/)).toBeInTheDocument()
  })

  it('no_records状態: 空状態を表示する', () => {
    const profile: MediaPreferenceProfile = {
      media_type: 'game',
      status: 'no_records',
      record_count: 0,
    }
    wrap(profile)
    expect(screen.getByText(/まだゲームの記録がありません/)).toBeInTheDocument()
  })

  it('generating状態: 分析中メッセージを表示する', () => {
    const profile: MediaPreferenceProfile = {
      media_type: 'book',
      status: 'generating',
      record_count: 5,
    }
    wrap(profile)
    expect(screen.getByText(/分析中/)).toBeInTheDocument()
  })
})
