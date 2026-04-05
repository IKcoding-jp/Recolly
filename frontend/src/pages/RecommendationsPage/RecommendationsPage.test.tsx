import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecommendationsPage } from './RecommendationsPage'
import { recommendationsApi } from '../../lib/recommendationsApi'

vi.mock('../../lib/recommendationsApi')
vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, username: 'testuser' } }),
}))

const mockReadyResponse = {
  recommendation: {
    analysis: {
      summary: 'テスト分析サマリー',
      preference_scores: [{ label: 'キャラクター重視', score: 9.2 }],
      genre_stats: [{ media_type: 'anime', count: 24, avg_rating: 8.2 }],
      top_tags: [{ name: '名作', count: 12 }],
    },
    recommended_works: [
      {
        title: '葬送のフリーレン',
        media_type: 'anime',
        description: 'テスト説明',
        cover_url: null,
        reason: 'テスト理由',
        external_api_id: '154587',
        external_api_source: 'anilist',
        metadata: {},
      },
    ],
    challenge_works: [
      {
        title: 'コンビニ人間',
        media_type: 'book',
        description: 'テスト説明',
        cover_url: null,
        reason: 'チャレンジ理由',
        external_api_id: '123',
        external_api_source: 'google_books',
        metadata: {},
      },
    ],
    analyzed_at: '2026-04-05T14:30:00+09:00',
    record_count: 70,
  },
  status: 'ready' as const,
}

describe('RecommendationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常時: 分析サマリーとおすすめ作品を表示する', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('テスト分析サマリー')).toBeInTheDocument()
    })
    expect(screen.getByText('葬送のフリーレン')).toBeInTheDocument()
    expect(screen.getByText('テスト理由')).toBeInTheDocument()
    expect(screen.getByText('コンビニ人間')).toBeInTheDocument()
  })

  it('記録0件: 空状態を表示する', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue({
      recommendation: null,
      status: 'no_records',
    })

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('作品を記録しておすすめを受け取ろう')).toBeInTheDocument()
    })
  })

  it('記録不足: プログレスバーを表示する', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue({
      recommendation: {
        analysis: null,
        recommended_works: [],
        challenge_works: [],
        genre_stats: [{ media_type: 'anime', count: 2, avg_rating: 8.0 }],
        record_count: 2,
        required_count: 5,
        analyzed_at: null,
      },
      status: 'insufficient_records',
    })

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/あと3件/)).toBeInTheDocument()
    })
  })

  it('エラー時: エラーメッセージを表示する', async () => {
    vi.mocked(recommendationsApi.get).mockRejectedValue(new Error('Network error'))

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('おすすめの取得に失敗しました')).toBeInTheDocument()
    })
  })

  it('アコーディオン: 詳細を展開できる', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)

    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('テスト分析サマリー')).toBeInTheDocument()
    })

    expect(screen.queryByText('ジャンル別統計')).not.toBeInTheDocument()

    await user.click(screen.getByText('好み分析の詳細を見る'))
    expect(screen.getByText('ジャンル別統計')).toBeInTheDocument()
  })

  it('更新ボタン: refresh APIを呼び出す', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)
    vi.mocked(recommendationsApi.refresh).mockResolvedValue({
      message: '分析を開始しました',
      status: 'processing',
    })

    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('分析を更新')).toBeInTheDocument()
    })

    await user.click(screen.getByText('分析を更新'))
    expect(recommendationsApi.refresh).toHaveBeenCalled()
  })
})
