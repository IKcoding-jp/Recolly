import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { UserRecord, RecordStatus } from '../../lib/types'
import { recordsApi } from '../../lib/recordsApi'
import { worksApi } from '../../lib/worksApi'
import { useDebouncedRecordUpdate } from '../../hooks/useDebouncedRecordUpdate'
import { captureEvent } from '../../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'
import { getEpisodeIncrementType } from '../../lib/mediaTypeUtils'

export type WorkDetailState = {
  record: UserRecord | null
  isLoading: boolean
  isDeleting: boolean
  showDeleteDialog: boolean
}

export function useWorkDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  // 有効なworkIdがある場合のみローディング状態で開始
  const hasValidId = !isNaN(Number(id))
  const [state, setState] = useState<WorkDetailState>({
    record: null,
    isLoading: hasValidId,
    isDeleting: false,
    showDeleteDialog: false,
  })

  useEffect(() => {
    const workId = Number(id)
    if (isNaN(workId)) return

    let cancelled = false
    const fetchRecord = async () => {
      try {
        const res = await recordsApi.getAll({ workId })
        if (!cancelled) {
          const record = res.records[0] ?? null
          setState((prev) => ({
            ...prev,
            record,
            isLoading: false,
          }))
          // 作品データの同期（AniListソースの場合）
          if (record?.work.external_api_source === 'anilist') {
            try {
              const syncRes = await worksApi.sync(record.work.id)
              if (!cancelled && syncRes.work) {
                setState((prev) => {
                  if (!prev.record) return prev
                  return {
                    ...prev,
                    record: { ...prev.record, work: syncRes.work },
                  }
                })
              }
            } catch {
              // sync失敗は無視（データ表示に影響しない）
            }
          }
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, isLoading: false }))
        }
      }
    }
    void fetchRecord()
    return () => {
      cancelled = true
    }
  }, [id])

  const updateRecord = useCallback(
    async (params: {
      status?: RecordStatus
      rating?: number | null
      current_episode?: number
      review_text?: string | null
      rewatch_count?: number
    }): Promise<UserRecord | null> => {
      if (!state.record) return null
      try {
        const res = await recordsApi.update(state.record.id, params)
        setState((prev) => ({ ...prev, record: res.record }))
        return res.record
      } catch {
        return null
      }
    },
    [state.record],
  )

  const handleStatusChange = useCallback(
    (status: RecordStatus) => {
      if (!state.record) return
      const fromStatus = state.record.status
      const mediaType = state.record.work.media_type
      void updateRecord({ status }).then((updated) => {
        if (updated) {
          captureEvent(ANALYTICS_EVENTS.RECORD_STATUS_CHANGED, {
            media_type: mediaType,
            from_status: fromStatus,
            to_status: status,
          })
        }
      })
    },
    [state.record, updateRecord],
  )

  // デバウンス付きハンドラー用（スライダー・エピソード・再視聴回数）
  const debouncedUpdate = useDebouncedRecordUpdate({
    record: state.record,
    setState,
    onSuccess: (updated, params) => {
      // current_episode の更新のみ analytics 対象（rating や rewatch_count は対象外）
      if (params.current_episode !== undefined) {
        captureEvent(ANALYTICS_EVENTS.EPISODE_PROGRESS_UPDATED, {
          media_type: updated.work.media_type,
          increment_type: getEpisodeIncrementType(updated.work.media_type),
          new_value: params.current_episode,
        })
      }
    },
  })

  const handleRatingChange = useCallback(
    (rating: number | null) => {
      debouncedUpdate({ rating })
    },
    [debouncedUpdate],
  )

  const handleEpisodeChange = useCallback(
    (episode: number) => {
      debouncedUpdate({ current_episode: episode })
    },
    [debouncedUpdate],
  )

  const handleReviewTextSave = useCallback(
    async (text: string) => {
      if (!state.record) return
      // 注意: updateRecord を経由するとエラーが握りつぶされるので、
      // ReviewSection 側でエラー表示できるように直接呼び出して例外を伝播させる
      const res = await recordsApi.update(state.record.id, { review_text: text })
      setState((prev) => ({ ...prev, record: res.record }))
    },
    [state.record],
  )

  const handleRewatchCountChange = useCallback(
    (count: number) => {
      debouncedUpdate({ rewatch_count: count })
    },
    [debouncedUpdate],
  )

  const openDeleteDialog = useCallback(() => {
    setState((prev) => ({ ...prev, showDeleteDialog: true }))
  }, [])

  const closeDeleteDialog = useCallback(() => {
    setState((prev) => ({ ...prev, showDeleteDialog: false }))
  }, [])

  const handleDelete = useCallback(async () => {
    if (!state.record) return
    setState((prev) => ({ ...prev, isDeleting: true }))
    try {
      await recordsApi.remove(state.record.id)
      // 履歴がある場合は前のページへ、なければ/searchへフォールバック
      if (window.history.length > 1) {
        navigate(-1)
      } else {
        navigate('/search')
      }
    } catch {
      setState((prev) => ({ ...prev, isDeleting: false }))
    }
  }, [state.record, navigate])

  const confirmDelete = useCallback(() => {
    void handleDelete()
  }, [handleDelete])

  return {
    record: state.record,
    isLoading: state.isLoading,
    isDeleting: state.isDeleting,
    showDeleteDialog: state.showDeleteDialog,
    handleStatusChange,
    handleRatingChange,
    handleEpisodeChange,
    handleReviewTextSave,
    handleRewatchCountChange,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
  }
}
