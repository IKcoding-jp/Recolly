import { usersApi } from '../usersApi'
import { setUserProperty } from './posthog'

/**
 * バックエンドから自分の distinct media_types を取得し、
 * PostHog の User Property distinct_media_types_count を更新する。
 *
 * 呼び出しタイミング: record_created 発火直後。ジャンル横断率 Insight
 * （spec §4.3）の User Property 方式で使う。
 *
 * 失敗時はサイレント（Phase 1 の既存方針と同じ）。記録作成自体の成功体験を阻害しない。
 */
export async function updateMediaTypesCount(): Promise<void> {
  try {
    const { media_types } = await usersApi.getMyMediaTypes()
    setUserProperty({ distinct_media_types_count: media_types.length })
  } catch (error) {
    console.warn('[analytics] updateMediaTypesCount failed:', error)
  }
}
