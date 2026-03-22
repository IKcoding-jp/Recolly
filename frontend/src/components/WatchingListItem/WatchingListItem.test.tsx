import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { WatchingListItem } from './WatchingListItem'
import type { UserRecord } from '../../lib/types'

const animeRecord: UserRecord = {
  id: 1,
  work_id: 10,
  status: 'watching',
  rating: null,
  current_episode: 12,
  rewatch_count: 0,
  started_at: null,
  completed_at: null,
  created_at: '2026-01-01',
  work: {
    id: 10,
    title: '進撃の巨人',
    media_type: 'anime',
    description: null,
    cover_image_url: 'https://example.com/cover.jpg',
    total_episodes: 25,
    external_api_id: null,
    external_api_source: null,
    metadata: {},
    created_at: '2026-01-01',
  },
}

const movieRecord: UserRecord = {
  ...animeRecord,
  id: 2,
  work_id: 20,
  current_episode: 0,
  work: {
    ...animeRecord.work,
    id: 20,
    title: 'インターステラー',
    media_type: 'movie',
    cover_image_url: null,
    total_episodes: null,
  },
}

function renderItem(record: UserRecord, onAction = vi.fn()) {
  return render(
    <MemoryRouter>
      <WatchingListItem record={record} onAction={onAction} />
    </MemoryRouter>,
  )
}

describe('WatchingListItem', () => {
  it('作品タイトルを表示する', () => {
    renderItem(animeRecord)
    expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
  })

  it('ジャンルラベルを表示する', () => {
    renderItem(animeRecord)
    expect(screen.getByText('アニメ')).toBeInTheDocument()
  })

  it('進捗テキストを表示する', () => {
    renderItem(animeRecord)
    expect(screen.getByText('12 / 25話')).toBeInTheDocument()
  })

  it('アニメには「+1話」ボタンを表示する', () => {
    renderItem(animeRecord)
    expect(screen.getByRole('button', { name: '+1話' })).toBeInTheDocument()
  })

  it('映画には「観た」ボタンを表示する', () => {
    renderItem(movieRecord)
    expect(screen.getByRole('button', { name: '観た' })).toBeInTheDocument()
  })

  it('ボタンクリックでonActionが呼ばれる', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    renderItem(animeRecord, onAction)
    await user.click(screen.getByRole('button', { name: '+1話' }))
    expect(onAction).toHaveBeenCalledWith(animeRecord)
  })

  it('行クリックで作品詳細ページへのリンクになっている', () => {
    renderItem(animeRecord)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/works/10')
  })
})
