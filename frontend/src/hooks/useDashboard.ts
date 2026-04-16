import { useState, useEffect, useCallback } from 'react'
import type { MediaType, UserRecord } from '../lib/types'
import { recordsApi } from '../lib/recordsApi'
import { hasEpisodes } from '../lib/mediaTypeUtils'
import { captureEvent } from '../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../lib/analytics/events'

// manga は巻、それ以外の episode 系（anime / drama）は話としてカウント
const EPISODE_INCREMENT_TYPE: Record<MediaType, 'episode' | 'volume'> = {
  anime: 'episode',
  drama: 'episode',
  manga: 'volume',
  book: 'episode',
  movie: 'episode',
  game: 'episode',
}

export function useDashboard() {
  const [records, setRecords] = useState<UserRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRecords = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await recordsApi.getAll({ status: 'watching' })
      setRecords(data.records)
    } catch {
      setError('記録の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRecords()
  }, [fetchRecords])

  const handleAction = useCallback(async (record: UserRecord) => {
    const mediaType = record.work.media_type

    if (hasEpisodes(mediaType)) {
      // 上限に達している場合は何もしない（連打で超過するのを防止）
      const totalEpisodes = record.work.total_episodes
      if (totalEpisodes !== null && record.current_episode >= totalEpisodes) {
        return
      }

      const newEpisode = record.current_episode + 1
      setRecords((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, current_episode: newEpisode } : r)),
      )
      try {
        const { record: updated } = await recordsApi.update(record.id, {
          current_episode: newEpisode,
        })
        // 進捗更新イベント（+1 話 / +1 巻）
        captureEvent(ANALYTICS_EVENTS.EPISODE_PROGRESS_UPDATED, {
          media_type: mediaType,
          increment_type: EPISODE_INCREMENT_TYPE[mediaType],
          new_value: newEpisode,
        })
        if (updated.status === 'completed') {
          // 自動で completed に遷移した場合はステータス変更イベントも発火
          captureEvent(ANALYTICS_EVENTS.RECORD_STATUS_CHANGED, {
            media_type: mediaType,
            from_status: record.status,
            to_status: 'completed',
          })
          setRecords((prev) => prev.filter((r) => r.id !== record.id))
        }
      } catch {
        setRecords((prev) =>
          prev.map((r) =>
            r.id === record.id ? { ...r, current_episode: record.current_episode } : r,
          ),
        )
        setError('進捗の更新に失敗しました')
      }
    } else {
      try {
        await recordsApi.update(record.id, { status: 'completed' })
        // 話数なしメディア: ステータス遷移イベントのみ発火（spec §2.2）
        captureEvent(ANALYTICS_EVENTS.RECORD_STATUS_CHANGED, {
          media_type: mediaType,
          from_status: record.status,
          to_status: 'completed',
        })
        setRecords((prev) => prev.filter((r) => r.id !== record.id))
      } catch {
        setError('ステータスの更新に失敗しました')
      }
    }
  }, [])

  return { records, isLoading, error, handleAction }
}
