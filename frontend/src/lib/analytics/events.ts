/**
 * PostHog に送信するイベント名の定数定義。
 * 文字列リテラルの typo を防ぐため、発火側は必ずこの定数経由で指定する。
 * Spec: docs/superpowers/specs/2026-04-17-analytics-phase2-dashboard-design.md §2.1
 */
import type { MediaType } from '../types'

export const ANALYTICS_EVENTS = {
  PAGEVIEW: '$pageview',
  SIGNUP_COMPLETED: 'signup_completed',
  RECORD_CREATED: 'record_created',
  SEARCH_PERFORMED: 'search_performed',
  EPISODE_PROGRESS_UPDATED: 'episode_progress_updated',
  RECORD_STATUS_CHANGED: 'record_status_changed',
  RECOMMENDATION_CLICKED: 'recommendation_clicked',
} as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

/** signup_completed のプロパティ */
export type SignupCompletedProps = {
  method: 'email' | 'google'
}

/** record_created のプロパティ */
export type RecordCreatedProps = {
  media_type: MediaType
}

/** search_performed のプロパティ */
export type SearchPerformedProps = {
  query_length: number
  genre_filter: 'all' | MediaType
  result_count: number
}

/** episode_progress_updated のプロパティ */
export type EpisodeProgressUpdatedProps = {
  media_type: MediaType
  increment_type: 'episode' | 'volume' | 'watched' | 'read' | 'cleared'
  new_value: number
}

/** record_status_changed のプロパティ */
export type RecordStatusChangedProps = {
  media_type: MediaType
  from_status: string
  to_status: string
}

/** recommendation_clicked のプロパティ */
export type RecommendationClickedProps = {
  media_type: MediaType
  position: number
  has_reason: boolean
}
