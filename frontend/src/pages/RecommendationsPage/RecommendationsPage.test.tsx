import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecommendationsPage } from './RecommendationsPage'
import { recommendationsApi } from '../../lib/recommendationsApi'
import { recordsApi } from '../../lib/recordsApi'

vi.mock('../../lib/recommendationsApi')
vi.mock('../../lib/recordsApi')

// アニメタブのready状態モック。record系クリックの検証は総合タブから作品リストが消えたため
// このタブ経由（MediaTabContent → RecommendedWorkCard）で行う
const animeReadyProfile = {
  media_type: 'anime',
  status: 'ready',
  analysis_summary: 'アニメ分析',
  same_media_works: [
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
    {
      title: '理由なし本',
      media_type: 'book',
      description: '',
      cover_url: null,
      reason: '',
      external_api_id: '999',
      external_api_source: 'google_books',
      metadata: {},
    },
  ],
  record_count: 24,
  analyzed_at: '',
}

vi.mock('../../hooks/useMediaProfiles', () => ({
  useMediaProfiles: () => ({
    profiles: [
      animeReadyProfile,
      { media_type: 'movie', status: 'no_records', record_count: 0 },
      { media_type: 'drama', status: 'no_records', record_count: 0 },
      { media_type: 'book', status: 'no_records', record_count: 0 },
      { media_type: 'manga', status: 'no_records', record_count: 0 },
      { media_type: 'game', status: 'no_records', record_count: 0 },
    ],
    isLoading: false,
    error: null,
    getProfileByMediaType: (mt: string) =>
      mt === 'anime'
        ? animeReadyProfile
        : { media_type: mt, status: 'no_records', record_count: 0 },
    refetch: vi.fn(),
  }),
}))
vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, username: 'testuser' } }),
}))

// PostHog ラッパーをモック化
vi.mock('../../lib/analytics/posthog', () => ({
  captureEvent: vi.fn(),
}))

vi.mock('../../lib/analytics/userProperties', () => ({
  updateMediaTypesCount: vi.fn(),
}))

import { captureEvent } from '../../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'
import { updateMediaTypesCount } from '../../lib/analytics/userProperties'

const mockReadyResponse = {
  recommendation: {
    analysis: {
      summary: 'テスト分析サマリー',
      preference_scores: [{ label: 'キャラクター重視', score: 9.2 }],
      genre_stats: [{ media_type: 'anime', count: 24, avg_rating: 8.2 }],
      top_tags: [{ name: '名作', count: 12 }],
    },
    analyzed_at: '2026-04-05T14:30:00+09:00',
    record_count: 70,
  },
  status: 'ready' as const,
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <RecommendationsPage />
    </MemoryRouter>,
  )

describe('RecommendationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常時: 分析サマリーを表示する', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('テスト分析サマリー')).toBeInTheDocument()
    })
  })

  it('総合タブに作品リストを表示しない（分析ダッシュボードのみ）', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)

    renderPage()

    // ページ内に「好み」を含むテキストが複数（見出し・サブタイトル等）あるため、
    // 分析サマリーラベルで一意に特定する
    expect(await screen.findByText('あなたの好み傾向')).toBeInTheDocument()
    expect(screen.queryByText('あなたへのおすすめ')).not.toBeInTheDocument()
    expect(screen.queryByText('いつもと違うジャンルに挑戦')).not.toBeInTheDocument()
  })

  it('記録0件: 空状態を表示する', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue({
      recommendation: null,
      status: 'no_records',
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('作品を記録しておすすめを受け取ろう')).toBeInTheDocument()
    })
  })

  it('記録不足: プログレスバーを表示する', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue({
      recommendation: {
        analysis: null,
        genre_stats: [{ media_type: 'anime', count: 2, avg_rating: 8.0 }],
        record_count: 2,
        required_count: 5,
        analyzed_at: null,
      },
      status: 'insufficient_records',
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/あと3件/)).toBeInTheDocument()
    })
  })

  it('エラー時: エラーメッセージを表示する', async () => {
    vi.mocked(recommendationsApi.get).mockRejectedValue(new Error('Network error'))

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('おすすめの取得に失敗しました')).toBeInTheDocument()
    })
  })

  it('アコーディオン: 詳細を展開できる', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)

    const user = userEvent.setup()

    renderPage()

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

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('分析を更新')).toBeInTheDocument()
    })

    await user.click(screen.getByText('分析を更新'))
    expect(recommendationsApi.refresh).toHaveBeenCalled()
  })

  it('メディアタブのおすすめ作品「記録する」クリックで recommendation_clicked が発火する', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)

    const user = userEvent.setup()

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /アニメ/ })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('tab', { name: /アニメ/ }))

    await waitFor(() => {
      expect(screen.getByText('葬送のフリーレン')).toBeInTheDocument()
    })

    // same_media_works[0] = 葬送のフリーレン (anime, reason あり)
    const recordButtons = screen.getAllByRole('button', { name: '記録する' })
    await user.click(recordButtons[0])

    expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.RECOMMENDATION_CLICKED, {
      media_type: 'anime',
      position: 1,
      has_reason: true,
    })
  })

  it('理由なしの作品クリックでは has_reason が false になる', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)

    const user = userEvent.setup()

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /アニメ/ })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('tab', { name: /アニメ/ }))

    await waitFor(() => {
      expect(screen.getByText('理由なし本')).toBeInTheDocument()
    })

    // same_media_works[1] = 理由なし本 (book, reason なし)
    const recordButtons = screen.getAllByRole('button', { name: '記録する' })
    await user.click(recordButtons[1])

    expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.RECOMMENDATION_CLICKED, {
      media_type: 'book',
      position: 2,
      has_reason: false,
    })
  })

  it('メディアタブから記録を作成したら record_created を media_type 付きで発火する', async () => {
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

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /アニメ/ })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('tab', { name: /アニメ/ }))

    // animeReadyProfile.same_media_works[0] = 葬送のフリーレン (media_type: anime)
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
      expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.RECORD_CREATED, {
        media_type: 'anime',
      })
    })
    await waitFor(() => {
      expect(updateMediaTypesCount).toHaveBeenCalledTimes(1)
    })
  })

  it('タブバーが表示される（readyステータス時）', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /全体/ })).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: /アニメ/ })).toBeInTheDocument()
  })

  it('アニメタブをクリックするとアニメ分析が表示される', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /アニメ/ })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: /アニメ/ }))
    expect(screen.getByText('アニメ分析')).toBeInTheDocument()
  })
})
