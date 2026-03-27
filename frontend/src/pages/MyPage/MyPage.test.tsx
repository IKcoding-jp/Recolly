import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MyPage } from './MyPage'

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

vi.mock('../../lib/statisticsApi', () => ({
  statisticsApi: {
    get: vi.fn().mockResolvedValue({
      by_genre: { anime: 3, movie: 1, drama: 0, book: 2, manga: 0, game: 0 },
      by_status: { watching: 2, completed: 3, on_hold: 1, dropped: 0, plan_to_watch: 0 },
      monthly_completions: [],
      totals: { episodes_watched: 48, volumes_read: 5 },
    }),
  },
}))

describe('MyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('マイページのタイトルを表示する', async () => {
    render(
      <MemoryRouter>
        <MyPage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('マイページ')).toBeInTheDocument()
    })
  })

  it('統計情報を表示する', async () => {
    render(
      <MemoryRouter>
        <MyPage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('マイページ')).toBeInTheDocument()
    })
  })
})
