import { Suspense } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// vite-plugin-pwa の仮想モジュールはテスト環境で利用できないためモック
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

// LandingPage をモック（LP 内部の重いツリーをテストの範囲外にする）
vi.mock('./pages/LandingPage/LandingPage', () => ({
  LandingPage: () => <div data-testid="landing-page-mock">LP</div>,
}))

// useAuth をモック
vi.mock('./contexts/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from './contexts/useAuth'
import { RootRoute } from './App'

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

describe('RootRoute', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset()
  })

  // RootRoute は未認証時に lazy() 化された LandingPage を返す。
  // 現状 vi.mock が同期解決するため Suspense 無しでもテストは通るが、
  // React/Vitest のバージョンアップで挙動が変わった際のフラキネスを防ぐため
  // Suspense バウンダリで明示的にラップしておく。
  function renderAtRoot() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <Suspense fallback={<div>suspense-fallback</div>}>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/dashboard" element={<div data-testid="dashboard">dashboard</div>} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    )
  }

  it('ロード中は「読み込み中...」を表示する', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    } as unknown as ReturnType<typeof useAuth>)

    renderAtRoot()
    expect(screen.getByText(/読み込み中/)).toBeInTheDocument()
  })

  it('未ログインなら LandingPage を描画する', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>)

    renderAtRoot()
    await waitFor(() => {
      expect(screen.getByTestId('landing-page-mock')).toBeInTheDocument()
    })
  })

  it('ログイン済みなら /dashboard にリダイレクトする', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, username: 'test' },
      isAuthenticated: true,
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>)

    renderAtRoot()
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })
  })
})
