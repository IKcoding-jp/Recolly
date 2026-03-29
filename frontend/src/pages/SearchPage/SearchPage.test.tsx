import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
