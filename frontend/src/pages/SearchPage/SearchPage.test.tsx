import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { SearchPage } from './SearchPage'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  // 初回セッション確認: 認証済み
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ user: { id: 1, username: 'test', email: 'test@example.com' } }),
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
})
