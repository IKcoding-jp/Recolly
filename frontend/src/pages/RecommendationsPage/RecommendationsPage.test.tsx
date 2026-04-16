import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecommendationsPage } from './RecommendationsPage'
import { recommendationsApi } from '../../lib/recommendationsApi'
import { recordsApi } from '../../lib/recordsApi'

vi.mock('../../lib/recommendationsApi')
vi.mock('../../lib/recordsApi')
vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, username: 'testuser' } }),
}))

// PostHog ラッパーをモック化
vi.mock('../../lib/analytics/posthog', () => ({
  captureEvent: vi.fn(),
}))

import { captureEvent } from '../../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'

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

  it('おすすめ作品の「記録する」クリックで recommendation_clicked が発火する', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)

    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('葬送のフリーレン')).toBeInTheDocument()
    })

    // recommended_works[0] = 葬送のフリーレン (anime, reason あり)
    const recordButtons = screen.getAllByRole('button', { name: '記録する' })
    await user.click(recordButtons[0])

    expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.RECOMMENDATION_CLICKED, {
      media_type: 'anime',
      position: 1,
      has_reason: true,
    })
  })

  it('チャレンジ作品クリックで position が 1 始まり・has_reason が理由有無に対応する', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue({
      ...mockReadyResponse,
      recommendation: {
        ...mockReadyResponse.recommendation,
        recommended_works: [],
        challenge_works: [
          {
            title: '理由なし本',
            media_type: 'book',
            description: null,
            cover_url: null,
            reason: null,
            external_api_id: '999',
            external_api_source: 'google_books',
            metadata: {},
          },
        ],
      },
    })

    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('理由なし本')).toBeInTheDocument()
    })

    const recordButtons = screen.getAllByRole('button', { name: '記録する' })
    await user.click(recordButtons[0])

    expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.RECOMMENDATION_CLICKED, {
      media_type: 'book',
      position: 1,
      has_reason: false,
    })
  })

  it('レコメンドから記録を作成したら record_created を media_type 付きで発火する', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)
    vi.mocked(recordsApi.createFromSearchResult).mockResolvedValue({
      record: {
        id: 99,
        work_id: 1,
        status: 'watching',
        rating: null,
        current_episode: 0,
        rewatch_count: 0,
        review_text: null,
        visibility: 'private_record',
        started_at: null,
        completed_at: null,
        created_at: '2026-04-13T00:00:00Z',
        updated_at: '2026-04-13T00:00:00Z',
        work: {
          id: 1,
          title: '葬送のフリーレン',
          media_type: 'anime',
          description: null,
          cover_image_url: null,
          total_episodes: null,
          external_api_id: '154587',
          external_api_source: 'anilist',
          metadata: {},
          created_at: '2026-04-13T00:00:00Z',
          updated_at: '2026-04-13T00:00:00Z',
        },
        tags: [],
      },
    })

    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    // mockReadyResponse の葬送のフリーレン (media_type: anime) のカードが表示される
    await waitFor(() => {
      expect(screen.getByText('葬送のフリーレン')).toBeInTheDocument()
    })

    // 記録モーダルを開く
    const recordButtons = screen.getAllByRole('button', { name: '記録する' })
    await user.click(recordButtons[0])

    await waitFor(() => {
      expect(screen.getByText('葬送のフリーレンを記録')).toBeInTheDocument()
    })

    // モーダル内の確定ボタンをクリック
    const confirmButtons = screen.getAllByRole('button', { name: '記録する' })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => {
      expect(captureEvent).toHaveBeenCalledWith('record_created', { media_type: 'anime' })
    })
  })
})
