import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { SearchPage } from './SearchPage'

// PostHog ラッパーをモック化
vi.mock('../../lib/analytics/posthog', () => ({
  captureEvent: vi.fn(),
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
}))

vi.mock('../../lib/analytics/userProperties', () => ({
  updateMediaTypesCount: vi.fn(),
}))

import { captureEvent } from '../../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'
import { updateMediaTypesCount } from '../../lib/analytics/userProperties'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  vi.mocked(captureEvent).mockClear()
  vi.mocked(updateMediaTypesCount).mockClear()
  vi.mocked(updateMediaTypesCount).mockResolvedValue(undefined)
  // 初回セッション確認: 認証済み
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        user: {
          id: 1,
          username: 'test',
          email: 'test@example.com',
          avatar_url: null,
          bio: null,
          created_at: '2026-04-01T00:00:00Z',
          has_password: true,
          providers: [],
          email_missing: false,
        },
      }),
  })
  // SearchPage マウント時の recorded_external_ids 取得
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ recorded_ids: [] }),
  })
})

function renderSearchPage() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <SearchPage />
      </AuthProvider>
    </BrowserRouter>,
  )
}

describe('SearchPage', () => {
  it('検索バーが表示される', async () => {
    renderSearchPage()
    expect(await screen.findByPlaceholderText('作品を検索...')).toBeInTheDocument()
  })

  it('ジャンルフィルタが表示される', async () => {
    renderSearchPage()
    // PCではボタン、モバイルではselectの両方が存在するためgetAllByTextを使用
    const allLabels = await screen.findAllByText('すべて')
    expect(allLabels.length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('アニメ').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('映画').length).toBeGreaterThanOrEqual(1)
  })

  it('キーワード入力→検索で結果が表示される', async () => {
    renderSearchPage()
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: 'テスト作品',
              media_type: 'anime',
              description: '説明',
              cover_image_url: null,
              total_episodes: 12,
              external_api_id: '1',
              external_api_source: 'anilist',
              metadata: {},
            },
          ],
        }),
    })

    const searchInput = await screen.findByPlaceholderText('作品を検索...')
    await user.type(searchInput, 'テスト')
    await user.click(screen.getByRole('button', { name: '検索' }))

    await waitFor(() => {
      expect(screen.getByText('テスト作品')).toBeInTheDocument()
    })
  })

  it('結果がない場合「見つかりませんでした」と表示される', async () => {
    renderSearchPage()
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    })

    const searchInput = await screen.findByPlaceholderText('作品を検索...')
    await user.type(searchInput, '存在しない')
    await user.click(screen.getByRole('button', { name: '検索' }))

    await waitFor(() => {
      expect(screen.getByText('作品が見つかりませんでした')).toBeInTheDocument()
    })
  })

  it('ジャンル「アニメ」選択時にゲーム英語検索ヒントが表示されない', async () => {
    renderSearchPage()
    const user = userEvent.setup()

    // アニメフィルタをクリック（検索前なのでAPI呼び出しなし）
    const animeButtons = await screen.findAllByText('アニメ')
    await user.click(animeButtons[0])

    // 検索API: アニメ結果のみ返す（ゲーム結果0件）
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: '進撃の巨人',
              media_type: 'anime',
              description: 'アニメ作品',
              cover_image_url: null,
              total_episodes: 25,
              external_api_id: '1',
              external_api_source: 'anilist',
              metadata: {},
            },
          ],
        }),
    })

    const searchInput = await screen.findByPlaceholderText('作品を検索...')
    await user.type(searchInput, '進撃の巨人')
    await user.click(screen.getByRole('button', { name: '検索' }))

    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })

    // ゲーム英語検索ヒントが表示されないことを確認
    expect(
      screen.queryByText('海外ゲームは英語タイトルでも検索してみてください'),
    ).not.toBeInTheDocument()
  })

  it('ジャンル「すべて」で日本語検索＋ゲーム結果が少ない時にヒントが表示される', async () => {
    renderSearchPage()
    const user = userEvent.setup()

    // 検索API: ゲーム結果が少ない（3件以下）
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: 'テストアニメ',
              media_type: 'anime',
              description: 'アニメ',
              cover_image_url: null,
              total_episodes: 12,
              external_api_id: '1',
              external_api_source: 'anilist',
              metadata: {},
            },
            {
              title: 'テストゲーム',
              media_type: 'game',
              description: 'ゲーム',
              cover_image_url: null,
              total_episodes: null,
              external_api_id: '2',
              external_api_source: 'igdb',
              metadata: {},
            },
          ],
        }),
    })

    const searchInput = await screen.findByPlaceholderText('作品を検索...')
    await user.type(searchInput, 'テスト作品')
    await user.click(screen.getByRole('button', { name: '検索' }))

    await waitFor(() => {
      expect(screen.getByText('テストアニメ')).toBeInTheDocument()
    })

    // ジャンル「すべて」なのでヒントが表示される
    expect(screen.getByText('海外ゲームは英語タイトルでも検索してみてください')).toBeInTheDocument()
  })

  it('連続で異なる作品を記録する際にステータス・評価がリセットされる', async () => {
    renderSearchPage()
    const user = userEvent.setup()

    // 検索API: 2作品を返す
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: '作品A',
              media_type: 'anime',
              description: '説明A',
              cover_image_url: null,
              total_episodes: 12,
              external_api_id: '100',
              external_api_source: 'anilist',
              metadata: {},
            },
            {
              title: '作品B',
              media_type: 'anime',
              description: '説明B',
              cover_image_url: null,
              total_episodes: 24,
              external_api_id: '200',
              external_api_source: 'anilist',
              metadata: {},
            },
          ],
        }),
    })

    // 検索実行
    const searchInput = await screen.findByPlaceholderText('作品を検索...')
    await user.type(searchInput, 'テスト')
    await user.click(screen.getByRole('button', { name: '検索' }))

    // 作品Aが表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByText('作品A')).toBeInTheDocument()
    })

    // 作品Aの「記録する」をクリック → RecordModal が開く
    const recordButtons = screen.getAllByRole('button', { name: '記録する' })
    await user.click(recordButtons[0])

    // モーダルが開いたことを確認
    await waitFor(() => {
      expect(screen.getByText('作品Aを記録')).toBeInTheDocument()
    })

    // ステータスを「視聴完了」に変更
    await user.click(screen.getByRole('button', { name: '視聴完了' }))

    // 評価を「8」に変更（スライダーで操作）
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '8' } })

    // 記録API（作品A）: 成功を返す
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          record: { id: 1, status: 'completed', rating: 8 },
        }),
    })

    // 「記録する」をクリック（モーダル内の確定ボタン）
    const confirmButtons = screen.getAllByRole('button', { name: '記録する' })
    await user.click(confirmButtons[confirmButtons.length - 1])

    // モーダルが閉じるのを待つ
    await waitFor(() => {
      expect(screen.queryByText('作品Aを記録')).not.toBeInTheDocument()
    })

    // 作品Bの「記録する」をクリック → RecordModal が開く
    const recordButtons2 = screen.getAllByRole('button', { name: '記録する' })
    await user.click(recordButtons2[0])

    // モーダルが開いたことを確認
    await waitFor(() => {
      expect(screen.getByText('作品Bを記録')).toBeInTheDocument()
    })

    // 記録API（作品B）: 成功を返す
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          record: { id: 2, status: 'watching', rating: null },
        }),
    })

    // 何も変更せずにそのまま「記録する」をクリック
    const confirmButtons2 = screen.getAllByRole('button', { name: '記録する' })
    await user.click(confirmButtons2[confirmButtons2.length - 1])

    // APIに送信されたデータを検証: 初期値（watching, ratingなし）で送信されているか
    // mockFetch の呼び出し履歴: [0]=認証, [1]=recorded_external_ids, [2]=検索, [3]=作品A記録, [4]=作品B記録
    const workBCall = mockFetch.mock.calls[4]
    const workBBody = JSON.parse(workBCall[1].body as string)
    expect(workBBody.record.status).toBe('watching')
    expect(workBBody.record.rating).toBeNull()
  })

  it('検索中にスケルトンUIとプログレスが表示される', async () => {
    renderSearchPage()
    const user = userEvent.setup()

    // 検索APIが解決しないPromiseを返す（ローディング状態を維持）
    mockFetch.mockReturnValueOnce(new Promise(() => {}))

    const searchInput = await screen.findByPlaceholderText('作品を検索...')
    await user.type(searchInput, 'テスト')
    await user.click(screen.getByRole('button', { name: '検索' }))

    // スケルトンカードが表示される
    await waitFor(() => {
      expect(screen.getAllByRole('status')).toHaveLength(4)
    })
    // プログレスメッセージが表示される
    expect(screen.getByText('作品を検索しています...')).toBeInTheDocument()
    // プログレスバーが表示される
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('新しい検索を開始したら、前の結果が即座に消える', async () => {
    const user = userEvent.setup()
    // 1回目の検索（成功）
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: '人間失格',
              media_type: 'book',
              description: '古い結果',
              cover_image_url: null,
              total_episodes: null,
              external_api_id: '1',
              external_api_source: 'google_books',
              metadata: {},
            },
          ],
        }),
    })

    renderSearchPage()
    const input = await screen.findByPlaceholderText('作品を検索...')
    await user.type(input, '人間失格')
    await user.click(screen.getByRole('button', { name: /検索/ }))

    // 1回目の結果が表示される
    await waitFor(() => {
      expect(screen.getByText('人間失格')).toBeInTheDocument()
    })

    // 2回目の検索（APIは永久保留、即時クリアを確認するため）
    let resolveSecond: ((value: unknown) => void) | null = null
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve
        }),
    )

    await user.clear(input)
    await user.type(input, 'ワンピース')
    await user.click(screen.getByRole('button', { name: /検索/ }))

    // 2回目のレスポンスが返る前に、1回目の結果が画面から消えている
    await waitFor(() => {
      expect(screen.queryByText('古い結果')).not.toBeInTheDocument()
    })

    // クリーンアップ
    resolveSecond?.({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    })
  })

  it('検索中にさらに別の検索を開始すると、古いリクエストの結果は反映されない', async () => {
    const user = userEvent.setup()
    // 1回目の検索を意図的に遅延させる
    let resolveFirst: ((value: unknown) => void) | null = null
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )
    // 2回目の検索は即座に返る
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: 'ワンピース新結果',
              media_type: 'manga',
              description: '新しい結果',
              cover_image_url: null,
              total_episodes: null,
              external_api_id: '2',
              external_api_source: 'anilist',
              metadata: {},
            },
          ],
        }),
    })

    renderSearchPage()
    const input = await screen.findByPlaceholderText('作品を検索...')
    await user.type(input, '古い検索')
    await user.click(screen.getByRole('button', { name: /検索/ }))

    // 2回目の検索を直後に投げる
    // 1回目の検索が永久保留のため検索ボタンが disabled のままになる。
    // userEvent.click は disabled 要素では発火しないので、フォーム送信を直接 dispatch して
    // handleSearch を呼ぶ（実アプリでも検索中の再送信は disabled で防がれるが、
    // ここではレース条件のロジックそのものを検証したい）。
    await user.clear(input)
    await user.type(input, '新しい検索')
    const form = input.closest('form')
    if (!form) throw new Error('form not found')
    fireEvent.submit(form)

    // 2回目の結果が画面に表示される
    await waitFor(() => {
      expect(screen.getByText('ワンピース新結果')).toBeInTheDocument()
    })

    // 遅延していた1回目のレスポンスが遅れて返ってくる
    resolveFirst?.({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: '遅延した古い結果',
              media_type: 'book',
              description: '古い',
              cover_image_url: null,
              total_episodes: null,
              external_api_id: '99',
              external_api_source: 'google_books',
              metadata: {},
            },
          ],
        }),
    })

    // 古い結果は画面に現れない（AbortControllerで中断されているため）
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByText('遅延した古い結果')).not.toBeInTheDocument()
    expect(screen.getByText('ワンピース新結果')).toBeInTheDocument()
  })

  it('検索成功時に search_performed イベントが発火する', async () => {
    renderSearchPage()
    const user = userEvent.setup()

    // 検索API: 2件の結果を返す
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: '進撃の巨人',
              media_type: 'anime',
              description: 'アニメ',
              cover_image_url: null,
              total_episodes: 25,
              external_api_id: '1',
              external_api_source: 'anilist',
              metadata: {},
            },
            {
              title: '進撃の巨人 劇場版',
              media_type: 'anime',
              description: '映画',
              cover_image_url: null,
              total_episodes: null,
              external_api_id: '2',
              external_api_source: 'anilist',
              metadata: {},
            },
          ],
        }),
    })

    const input = await screen.findByPlaceholderText('作品を検索...')
    await user.type(input, '進撃')
    await user.click(screen.getByRole('button', { name: '検索' }))

    await waitFor(() => {
      expect(captureEvent).toHaveBeenCalledWith('search_performed', {
        query_length: 2,
        genre_filter: 'all',
        result_count: 2,
      })
    })
  })

  it('検索失敗時は search_performed を発火しない', async () => {
    renderSearchPage()
    const user = userEvent.setup()

    // 検索APIがエラーを返す（ネットワークエラーとしてreject）
    mockFetch.mockRejectedValueOnce(new TypeError('network error'))

    const input = await screen.findByPlaceholderText('作品を検索...')
    await user.type(input, 'x')
    await user.click(screen.getByRole('button', { name: '検索' }))

    await waitFor(() => {
      // エラーメッセージが表示されることを確認（APIが呼ばれたことの証明）
      expect(screen.getByText(/ネットワークに接続できませんでした/)).toBeInTheDocument()
    })
    expect(captureEvent).not.toHaveBeenCalledWith('search_performed', expect.anything())
  })

  it('ジャンル変更による再検索時にも search_performed が発火する', async () => {
    renderSearchPage()
    const user = userEvent.setup()

    // 最初の検索（handleSearch 経由）
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: '進撃の巨人',
              media_type: 'anime',
              description: 'アニメ',
              cover_image_url: null,
              total_episodes: 25,
              external_api_id: '1',
              external_api_source: 'anilist',
              metadata: {},
            },
            {
              title: '進撃の巨人 劇場版',
              media_type: 'movie',
              description: '映画',
              cover_image_url: null,
              total_episodes: null,
              external_api_id: '2',
              external_api_source: 'tmdb',
              metadata: {},
            },
          ],
        }),
    })

    const input = await screen.findByPlaceholderText('作品を検索...')
    await user.type(input, '進撃')
    await user.click(screen.getByRole('button', { name: '検索' }))

    await waitFor(() => {
      expect(captureEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.SEARCH_PERFORMED,
        expect.objectContaining({ genre_filter: 'all' }),
      )
    })

    // ジャンル変更による再検索: captureEvent をリセットしてから確認
    vi.mocked(captureEvent).mockClear()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: '進撃の巨人',
              media_type: 'anime',
              description: 'アニメ',
              cover_image_url: null,
              total_episodes: 25,
              external_api_id: '1',
              external_api_source: 'anilist',
              metadata: {},
            },
          ],
        }),
    })

    // PC用のジャンルフィルタボタン「アニメ」をクリック（既存テストと同パターン）
    const animeButtons = screen.getAllByText('アニメ')
    await user.click(animeButtons[0])

    await waitFor(() => {
      expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.SEARCH_PERFORMED, {
        query_length: 2,
        genre_filter: 'anime',
        result_count: 1,
      })
    })
  })

  it('検索結果から記録を作成したら record_created を media_type 付きで発火する', async () => {
    renderSearchPage()
    const user = userEvent.setup()

    // 検索API: アニメ作品 1 件を返す
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: 'テストアニメ',
              media_type: 'anime',
              description: 'アニメ説明',
              cover_image_url: null,
              total_episodes: 12,
              external_api_id: '1',
              external_api_source: 'anilist',
              metadata: {},
            },
          ],
        }),
    })

    // 検索実行
    const searchInput = await screen.findByPlaceholderText('作品を検索...')
    await user.type(searchInput, 'テスト')
    await user.click(screen.getByRole('button', { name: '検索' }))

    await waitFor(() => {
      expect(screen.getByText('テストアニメ')).toBeInTheDocument()
    })

    // 記録モーダルを開く
    const recordButtons = screen.getAllByRole('button', { name: '記録する' })
    await user.click(recordButtons[0])

    await waitFor(() => {
      expect(screen.getByText('テストアニメを記録')).toBeInTheDocument()
    })

    // 記録 API: 成功を返す
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          record: { id: 1, status: 'watching', rating: null },
        }),
    })

    // モーダル内の「記録する」をクリック
    const confirmButtons = screen.getAllByRole('button', { name: '記録する' })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => {
      expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.RECORD_CREATED, {
        media_type: 'anime',
      })
    })
    // ジャンル横断率 Insight (#3) の User Property を最新化する
    await waitFor(() => {
      expect(updateMediaTypesCount).toHaveBeenCalledTimes(1)
    })
  })
})
