/**
 * PostHog に送信するイベント名の定数定義。
 * 文字列リテラルの typo を防ぐため、発火側は必ずこの定数経由で指定する。
 * Spec: docs/superpowers/specs/2026-04-13-analytics-tracking-design.md 2.1 節
 */
export const ANALYTICS_EVENTS = {
  PAGEVIEW: '$pageview',
  SIGNUP_COMPLETED: 'signup_completed',
  RECORD_CREATED: 'record_created',
} as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

/** signup_completed のプロパティ */
export type SignupCompletedProps = {
  method: 'email' | 'google'
}

/** record_created のプロパティ */
export type RecordCreatedProps = {
  media_type: 'anime' | 'movie' | 'drama' | 'book' | 'manga' | 'game'
}
