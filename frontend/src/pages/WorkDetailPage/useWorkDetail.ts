import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { UserRecord, RecordStatus } from '../../lib/types'
import { recordsApi } from '../../lib/recordsApi'

type WorkDetailState = {
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
          setState((prev) => ({
            ...prev,
            record: res.records[0] ?? null,
            isLoading: false,
          }))
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
    }) => {
      if (!state.record) return
      try {
        const res = await recordsApi.update(state.record.id, params)
        setState((prev) => ({ ...prev, record: res.record }))
      } catch {
        // エラー時は状態を変更しない
      }
    },
    [state.record],
  )

  const handleStatusChange = useCallback(
    (status: RecordStatus) => {
      void updateRecord({ status })
    },
    [updateRecord],
  )

  const handleRatingChange = useCallback(
    (rating: number | null) => {
      void updateRecord({ rating })
    },
    [updateRecord],
  )

  const handleEpisodeChange = useCallback(
    (episode: number) => {
      void updateRecord({ current_episode: episode })
    },
    [updateRecord],
  )

  const handleReviewTextSave = useCallback(
    async (text: string) => {
      await updateRecord({ review_text: text })
    },
    [updateRecord],
  )

  const handleRewatchCountChange = useCallback(
    (count: number) => {
      void updateRecord({ rewatch_count: count })
    },
    [updateRecord],
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
      navigate('/search')
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
