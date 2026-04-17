import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, type AnalyticsEventName } from './events'

/**
 * PostHog のラッパー。
 *
 * 設計:
 * - 環境変数が未設定ならサイレントに no-op（ローカル開発で .env.local が空でも壊さない）
 * - init / capture が失敗しても例外は握りつぶして console.warn のみ（Recolly 本体の動作を止めない）
 * - SDK の自動 pageview は無効化し、React Router の location 変化時に手動発火する
 *
 * Spec: docs/superpowers/specs/2026-04-13-analytics-tracking-design.md 3.4 節
 */

let initialized = false

type InitOptions = {
  key: string | undefined
  host: string | undefined
}

export function initAnalytics({ key, host }: InitOptions): void {
  if (!key || !host) {
    // 環境変数未設定時は何もしない
    return
  }
  try {
    posthog.init(key, {
      api_host: host,
      // SDK の自動 pageview を無効化。SPA 遷移と初回ロードの両方を手動制御するため
      capture_pageview: false,
      persistence: 'localStorage+cookie',
    })
    initialized = true
  } catch (error) {
    console.warn('[analytics] PostHog init failed:', error)
  }
}

export type IdentifyPayload = {
  id: number
  signup_method: 'email' | 'google'
  signup_date: string
}

export function identifyUser(payload: IdentifyPayload): void {
  if (!initialized) return
  try {
    posthog.identify(String(payload.id), {
      signup_method: payload.signup_method,
      signup_date: payload.signup_date,
    })
  } catch (error) {
    console.warn('[analytics] identify failed:', error)
  }
}

export function resetAnalytics(): void {
  if (!initialized) return
  try {
    posthog.reset()
  } catch (error) {
    console.warn('[analytics] reset failed:', error)
  }
}

export function captureEvent<P extends Record<string, unknown>>(
  eventName: AnalyticsEventName,
  properties: P,
): void {
  if (!initialized) return
  try {
    posthog.capture(eventName, properties)
  } catch (error) {
    console.warn('[analytics] capture failed:', error)
  }
}

export function capturePageview(currentUrl: string): void {
  if (!initialized) return
  try {
    posthog.capture(ANALYTICS_EVENTS.PAGEVIEW, { $current_url: currentUrl })
  } catch (error) {
    console.warn('[analytics] pageview capture failed:', error)
  }
}

export function setUserProperty(properties: Record<string, unknown>): void {
  if (!initialized) return
  try {
    posthog.people.set(properties)
  } catch (error) {
    console.warn('[analytics] setUserProperty failed:', error)
  }
}

/** テスト用: 内部状態をリセットする（プロダクションコードからは呼ばない） */
export function __resetForTest(): void {
  initialized = false
}
