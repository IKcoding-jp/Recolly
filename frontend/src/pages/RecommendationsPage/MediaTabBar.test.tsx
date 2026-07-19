import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MediaTabBar } from './MediaTabBar'
import type { MediaPreferenceProfile } from '../../types/mediaPreferenceProfile'

const mockProfiles: MediaPreferenceProfile[] = [
  {
    media_type: 'anime',
    status: 'ready',
    analysis_summary: '',
    same_media_works: [],
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

  it('アニメタブに記録数バッジ（24）が表示される', () => {
    render(<MediaTabBar profiles={mockProfiles} activeTab="overall" onTabChange={vi.fn()} />)
    expect(screen.getByText('24')).toBeInTheDocument()
  })

  it('タブをクリックするとonTabChangeが呼ばれる', async () => {
    const onTabChange = vi.fn()
    const user = userEvent.setup()
    render(<MediaTabBar profiles={mockProfiles} activeTab="overall" onTabChange={onTabChange} />)
    await user.click(screen.getByRole('tab', { name: /アニメ/ }))
    expect(onTabChange).toHaveBeenCalledWith('anime')
  })
})
