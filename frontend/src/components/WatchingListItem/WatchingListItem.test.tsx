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

// 未読バッジのテスト用データ
const mangaRecord: UserRecord = {
  id: 3,
  work_id: 30,
  status: 'watching',
  rating: null,
  current_episode: 108,
  rewatch_count: 0,
  review_text: null,
  visibility: 'private_record',
  started_at: null,
  completed_at: null,
  created_at: '2026-01-01',
  work: {
    id: 30,
    title: 'ONE PIECE',
    media_type: 'manga',
    description: null,
    cover_image_url: null,
    total_episodes: 110,
    external_api_id: '21',
    external_api_source: 'anilist',
    metadata: { status: 'RELEASING' },
    last_synced_at: null,
    created_at: '2026-01-01',
  },
}

describe('未読バッジ', () => {
  it('連載中の漫画で未読がある場合「未読 2巻」を表示する', () => {
    renderItem(mangaRecord)
    expect(screen.getByText('未読 2巻')).toBeInTheDocument()
  })

  it('追いついている場合はバッジを表示しない', () => {
    const caughtUp = {
      ...mangaRecord,
      current_episode: 110,
    }
    renderItem(caughtUp)
    expect(screen.queryByText(/未読/)).not.toBeInTheDocument()
  })

  it('完結済み作品ではバッジを表示しない', () => {
    const finished = {
      ...mangaRecord,
      work: { ...mangaRecord.work, metadata: { status: 'FINISHED' as const } },
    }
    renderItem(finished)
    expect(screen.queryByText(/未読/)).not.toBeInTheDocument()
  })

  it('アニメではバッジを表示しない', () => {
    const anime = {
      ...mangaRecord,
      work: {
        ...mangaRecord.work,
        media_type: 'anime' as const,
        metadata: { status: 'RELEASING' as const },
      },
    }
    renderItem(anime)
    expect(screen.queryByText(/未読/)).not.toBeInTheDocument()
  })
})
