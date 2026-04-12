import { beforeEach, describe, expect, it, vi } from 'vitest'

// posthog-js をモック化。import より前に vi.mock を呼ぶ必要がある
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  },
}))

import posthog from 'posthog-js'
import {
  initAnalytics,
  identifyUser,
  resetAnalytics,
  captureEvent,
  capturePageview,
  __resetForTest,
} from './posthog'

describe('analytics/posthog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetForTest()
  })

  describe('initAnalytics', () => {
    it('key と host が両方指定されたとき posthog.init を呼ぶ', () => {
      initAnalytics({ key: 'phc_test', host: 'https://us.i.posthog.com' })
      expect(posthog.init).toHaveBeenCalledWith('phc_test', {
        api_host: 'https://us.i.posthog.com',
        capture_pageview: false,
        persistence: 'localStorage+cookie',
      })
    })

    it('key が未設定なら posthog.init を呼ばない', () => {
      initAnalytics({ key: '', host: 'https://us.i.posthog.com' })
      expect(posthog.init).not.toHaveBeenCalled()
    })

    it('host が未設定なら posthog.init を呼ばない', () => {
      initAnalytics({ key: 'phc_test', host: '' })
      expect(posthog.init).not.toHaveBeenCalled()
    })

    it('key と host が undefined でも例外を投げない', () => {
      expect(() => initAnalytics({ key: undefined, host: undefined })).not.toThrow()
      expect(posthog.init).not.toHaveBeenCalled()
    })
  })

  describe('identifyUser', () => {
    it('未 init 状態では posthog.identify を呼ばない（例外も投げない）', () => {
      expect(() =>
        identifyUser({
          id: 1,
          signup_method: 'email',
          signup_date: '2026-04-13T00:00:00Z',
        }),
      ).not.toThrow()
      expect(posthog.identify).not.toHaveBeenCalled()
    })

    it('init 済みなら posthog.identify を distinct_id と $set プロパティ付きで呼ぶ', () => {
      initAnalytics({ key: 'phc_test', host: 'https://us.i.posthog.com' })
      identifyUser({
        id: 42,
        signup_method: 'google',
        signup_date: '2026-04-13T00:00:00Z',
      })
      expect(posthog.identify).toHaveBeenCalledWith('42', {
        signup_method: 'google',
        signup_date: '2026-04-13T00:00:00Z',
      })
    })
  })

  describe('resetAnalytics', () => {
    it('init 済みなら posthog.reset を呼ぶ', () => {
      initAnalytics({ key: 'phc_test', host: 'https://us.i.posthog.com' })
      resetAnalytics()
      expect(posthog.reset).toHaveBeenCalled()
    })

    it('未 init 状態では posthog.reset を呼ばない（例外も投げない）', () => {
      expect(() => resetAnalytics()).not.toThrow()
      expect(posthog.reset).not.toHaveBeenCalled()
    })
  })

  describe('captureEvent', () => {
    it('init 済みなら posthog.capture にイベント名とプロパティを渡す', () => {
      initAnalytics({ key: 'phc_test', host: 'https://us.i.posthog.com' })
      captureEvent('signup_completed', { method: 'email' })
      expect(posthog.capture).toHaveBeenCalledWith('signup_completed', { method: 'email' })
    })

    it('未 init 状態では posthog.capture を呼ばない（例外も投げない）', () => {
      expect(() => captureEvent('signup_completed', { method: 'email' })).not.toThrow()
      expect(posthog.capture).not.toHaveBeenCalled()
    })
  })

  describe('capturePageview', () => {
    it('init 済みなら $pageview を $current_url 付きで posthog.capture に渡す', () => {
      initAnalytics({ key: 'phc_test', host: 'https://us.i.posthog.com' })
      capturePageview('/dashboard')
      expect(posthog.capture).toHaveBeenCalledWith('$pageview', {
        $current_url: '/dashboard',
      })
    })

    it('未 init 状態では posthog.capture を呼ばない（例外も投げない）', () => {
      expect(() => capturePageview('/dashboard')).not.toThrow()
      expect(posthog.capture).not.toHaveBeenCalled()
    })
  })
})
