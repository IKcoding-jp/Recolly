import { useRef, useEffect, useCallback } from 'react'
import type { UserRecord } from '../lib/types'
import { recordsApi } from '../lib/recordsApi'

type DebouncedFields = Partial<Pick<UserRecord, 'rating' | 'current_episode' | 'rewatch_count'>>

type WorkDetailState = {
  record: UserRecord | null
  isLoading: boolean
  isDeleting: boolean
  showDeleteDialog: boolean
}

type UseDebouncedRecordUpdateParams = {
  record: UserRecord | null
  setState: React.Dispatch<React.SetStateAction<WorkDetailState>>
  delayMs?: number
}

const DEBOUNCE_DELAY_MS = 300

export function useDebouncedRecordUpdate({
  record,
  setState,
  delayMs = DEBOUNCE_DELAY_MS,
}: UseDebouncedRecordUpdateParams): (params: DebouncedFields) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotRef = useRef<UserRecord | null>(null)
  // 世代カウンター: 新しい操作が来たらインクリメント。
  // API応答時にカウンターが変わっていたら、古いレスポンスとして無視する。
  const generationRef = useRef(0)

  // アンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const debouncedUpdate = useCallback(
    (params: DebouncedFields) => {
      if (!record) return

      // 初回呼び出し時にスナップショットを保存（連続操作の「操作前の値」）
      if (snapshotRef.current === null) {
        snapshotRef.current = record
      }

      // 世代を進める（新しい操作サイクルの開始を記録）
      generationRef.current += 1

      // 楽観的更新: UIを即座に更新
      setState((prev) => {
        if (!prev.record) return prev
        return {
          ...prev,
          record: { ...prev.record, ...params },
        }
      })

      // 既存タイマーをキャンセル（デバウンスのリセット）
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }

      // 新しいタイマーをセット
      const snapshot = snapshotRef.current
      const generation = generationRef.current
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        snapshotRef.current = null

        recordsApi
          .update(record.id, params)
          .then((res) => {
            // 新しい操作が始まっていたら、この古いレスポンスは無視
            if (generationRef.current !== generation) return
            // API成功: サーバーレスポンスでstateを確定
            setState((prev) => {
              if (!prev.record) return prev
              return { ...prev, record: res.record }
            })
          })
          .catch(() => {
            // 新しい操作が始まっていたら、ロールバックも不要
            if (generationRef.current !== generation) return
            // API失敗: スナップショットにロールバック
            setState((prev) => {
              if (!prev.record || !snapshot) return prev
              return { ...prev, record: snapshot }
            })
          })
      }, delayMs)
    },
    [record, setState, delayMs],
  )

  return debouncedUpdate
}
