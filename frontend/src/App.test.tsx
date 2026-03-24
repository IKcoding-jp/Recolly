import { vi, beforeEach } from 'vitest'
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
  it('未認証時にログインページが表示される', async () => {
    render(<App />)
    // ログインページにある「アカウントを作成」リンクで確認
    expect(await screen.findByText('アカウントを作成')).toBeInTheDocument()
  })
})
