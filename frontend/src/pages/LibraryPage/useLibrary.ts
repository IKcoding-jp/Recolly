import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { UserRecord, RecordStatus, MediaType, PaginationMeta } from '../../lib/types'
import { recordsApi } from '../../lib/recordsApi'
import type { SortOption } from '../../components/SortSelector/SortSelector'

const DEFAULT_SORT: SortOption = 'updated_at'
const PER_PAGE = 20

type LibraryState = {
  records: UserRecord[]
  meta: PaginationMeta | null
  isLoading: boolean
  error: string | null
}

export function useLibrary() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [state, setState] = useState<LibraryState>({
    records: [],
    meta: null,
    isLoading: true,
    error: null,
  })

  // 初回アクセス時にデフォルトの status=watching を設定
  useEffect(() => {
    if (!searchParams.has('status')) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('status', 'watching')
          return next
        },
        { replace: true },
      )
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // URLからフィルタ状態を読み取る
  const rawStatus = searchParams.get('status')
  const status: RecordStatus | null =
    rawStatus === 'all' || rawStatus === null ? null : (rawStatus as RecordStatus)
  const mediaType = searchParams.get('media_type') as MediaType | null
  const sort = (searchParams.get('sort') as SortOption) || DEFAULT_SORT
  const page = Number(searchParams.get('page')) || 1

  // API呼び出し（rawStatusがnullの場合はリダイレクト中なのでスキップ）
  useEffect(() => {
    if (rawStatus === null) return

    let cancelled = false

    const fetchRecords = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))
      try {
        const res = await recordsApi.getAll({
          status: status ?? undefined,
          mediaType: mediaType ?? undefined,
          sort,
          page,
          perPage: PER_PAGE,
        })
        if (!cancelled) {
          setState({
            records: res.records,
            meta: res.meta ?? null,
            isLoading: false,
            error: null,
          })
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'エラーが発生しました'
          setState((prev) => ({ ...prev, isLoading: false, error: message }))
        }
      }
    }
    void fetchRecords()
    return () => {
      cancelled = true
    }
  }, [status, mediaType, sort, page, rawStatus])

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, val] of Object.entries(updates)) {
          if (val === null) {
            next.delete(key)
          } else {
            next.set(key, val)
          }
        }
        // フィルタ変更時はページをリセット（ページ変更以外の場合）
        if (!('page' in updates)) {
          next.delete('page')
        }
        return next
      })
    },
    [setSearchParams],
  )

  const setStatus = useCallback(
    (newStatus: RecordStatus | null) => {
      updateParams({ status: newStatus ?? 'all' })
    },
    [updateParams],
  )

  const setMediaType = useCallback(
    (newMediaType: MediaType | null) => {
      updateParams({ media_type: newMediaType })
    },
    [updateParams],
  )

  const setSort = useCallback(
    (newSort: SortOption) => {
      updateParams({ sort: newSort })
    },
    [updateParams],
  )

  const setPage = useCallback(
    (newPage: number) => {
      updateParams({ page: String(newPage) })
    },
    [updateParams],
  )

  return {
    records: state.records,
    totalPages: state.meta?.total_pages ?? 1,
    isLoading: state.isLoading,
    error: state.error,
    status,
    mediaType,
    sort,
    page,
    setStatus,
    setMediaType,
    setSort,
    setPage,
  }
}
