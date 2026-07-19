import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MediaTabBar } from './MediaTabBar'
import type { MediaPreferenceProfile } from '../../types/mediaPreferenceProfile'
import type { RecommendedWork } from '../../types/recommendation'

const makeWork = (id: number): RecommendedWork => ({
  title: `作品${id}`,
  media_type: 'anime',
  description: '',
  cover_url: null,
  reason: '',
  external_api_id: String(id),
  external_api_source: 'anilist',
  metadata: {},
})

const mockProfiles: MediaPreferenceProfile[] = [
  {
    media_type: 'anime',
    status: 'ready',
    analysis_summary: '',
    same_media_works: [makeWork(1), makeWork(2), makeWork(3), makeWork(4), makeWork(5)],
    record_count: 24,
    analyzed_at: '',
  },
  { media_type: 'movie', status: 'insufficient_records', record_count: 1 },
  { media_type: 'drama', status: 'no_records', record_count: 0 },
  { media_type: 'book', status: 'no_records', record_count: 0 },
  { media_type: 'manga', status: 'no_records', record_count: 0 },
  { media_type: 'game', status: 'no_records', record_count: 0 },
]

describe('MediaTabBar', () => {
  it('全体タブを含む7タブを表示する', () => {
    render(<MediaTabBar profiles={mockProfiles} activeTab="overall" onTabChange={vi.fn()} />)
    expect(screen.getByRole('tab', { name: /全体/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /アニメ/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /映画/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /ドラマ/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /本/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /漫画/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /ゲーム/ })).toBeInTheDocument()
  })

  it('アニメタブにおすすめ数（5）のバッジが表示され、記録数（24）は表示されない', () => {
    render(<MediaTabBar profiles={mockProfiles} activeTab="overall" onTabChange={vi.fn()} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.queryByText('24')).not.toBeInTheDocument()
  })

  it('ready以外のタブのバッジは0になる', () => {
    render(<MediaTabBar profiles={mockProfiles} activeTab="overall" onTabChange={vi.fn()} />)
    // movie（insufficient_records・記録1件）もおすすめが無いため0
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })

  it('タブをクリックするとonTabChangeが呼ばれる', async () => {
    const onTabChange = vi.fn()
    const user = userEvent.setup()
    render(<MediaTabBar profiles={mockProfiles} activeTab="overall" onTabChange={onTabChange} />)
    await user.click(screen.getByRole('tab', { name: /アニメ/ }))
    expect(onTabChange).toHaveBeenCalledWith('anime')
  })
})
