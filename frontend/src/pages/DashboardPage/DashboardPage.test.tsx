import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DashboardPage } from './DashboardPage'

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      bio: null,
      created_at: '2026-01-01',
      has_password: true,
      providers: [],
      email_missing: false,
    },
  }),
}))

vi.mock('../../lib/recordsApi', () => ({
  recordsApi: { getAll: vi.fn(), update: vi.fn() },
}))

vi.mock('../../lib/statisticsApi', () => ({
  statisticsApi: {
    get: vi.fn().mockResolvedValue({
      by_genre: { anime: 0, movie: 0, drama: 0, book: 0, manga: 0, game: 0 },
      by_status: { watching: 0, completed: 0, on_hold: 0, dropped: 0, plan_to_watch: 0 },
      monthly_completions: [],
      totals: { episodes_watched: 0, volumes_read: 0 },
    }),
  },
}))

import { recordsApi } from '../../lib/recordsApi'

const mockAnimeRecord = {
  id: 1,
  work_id: 10,
  status: 'watching' as const,
  rating: null,
  current_episode: 12,
  rewatch_count: 0,
  started_at: null,
  completed_at: null,
  created_at: '2026-01-01',
  work: {
    id: 10,
    title: '進撃の巨人',
    media_type: 'anime' as const,
    description: null,
    cover_image_url: null,
    total_episodes: 25,
    external_api_id: null,
    external_api_source: null,
    metadata: {},
    created_at: '2026-01-01',
  },
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('進行中の記録を表示する', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: [mockAnimeRecord] })
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })
    expect(screen.getByText('進行中')).toBeInTheDocument()
    expect(screen.getByText('12 / 25話')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+1話' })).toBeInTheDocument()
  })

  it('記録が0件のとき空状態を表示する', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: [] })
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('はじめましょう')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: '作品を探す' })).toBeInTheDocument()
  })

  it('+1話ボタンで進捗が更新される', async () => {
    const user = userEvent.setup()
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: [mockAnimeRecord] })
    vi.mocked(recordsApi.update).mockResolvedValue({
      record: { ...mockAnimeRecord, current_episode: 13 },
    })
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '+1話' }))
    expect(recordsApi.update).toHaveBeenCalledWith(1, { current_episode: 13 })
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    vi.mocked(recordsApi.getAll).mockRejectedValue(new Error('fail'))
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('記録の取得に失敗しました')).toBeInTheDocument()
    })
  })
})
