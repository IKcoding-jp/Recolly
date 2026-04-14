import { vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// vite-plugin-pwaの仮想モジュールはテスト環境で利用できないためモック
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

import App from './App'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// LandingPage の useScrollReveal が IntersectionObserver を使うため、
// JSDOM 環境にスタブを提供する
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(function (this: IntersectionObserver) {
      this.observe = vi.fn()
      this.unobserve = vi.fn()
      this.disconnect = vi.fn()
      this.takeRecords = vi.fn()
      this.root = null
      this.rootMargin = ''
      this.thresholds = []
      return this
    }),
  )
})

beforeEach(() => {
  mockFetch.mockReset()
  // 初回セッション確認: 未認証
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 401,
    json: () => Promise.resolve({ error: 'ログインが必要です' }),
  })
})

describe('App', () => {
  it('ロード中は読み込み中テキストを表示する', () => {
    mockFetch.mockReset()
    // fetchを未解決のまま保留してisLoading状態を維持
    mockFetch.mockReturnValueOnce(new Promise(() => {}))

    render(<App />)

    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('未認証時にランディングページが表示される', async () => {
    render(<App />)
    // LP のヒーロー見出しで確認 (lazy load を待つため findBy)
    expect(
      await screen.findByRole('heading', { level: 1, name: /観たもの、読んだもの/ }),
    ).toBeInTheDocument()
  })
})
