import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { UserRecord, RecordStatus, MediaType, PaginationMeta, Tag } from '../../lib/types'
import { recordsApi } from '../../lib/recordsApi'
import { tagsApi } from '../../lib/tagsApi'
import type { SortOption } from '../../components/SortSelector/sortOptions'

const DEFAULT_SORT: SortOption = 'updated_at'
const DEFAULT_PER_PAGE = 20

type LibraryState = {
  records: UserRecord[]
  meta: PaginationMeta | null
  isLoading: boolean
  error: string | null
}

export function useLibrary(perPage: number = DEFAULT_PER_PAGE) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [state, setState] = useState<LibraryState>({
    records: [],
    meta: null,
    isLoading: true,
    error: null,
  })

  // ユーザーの全タグを取得
  useEffect(() => {
    let cancelled = false
    const fetchTags = async () => {
      try {
        const res = await tagsApi.getAll()
        if (!cancelled) setAllTags(res.tags)
      } catch {
        // タグ取得失敗は致命的ではないため無視
      }
    }
    void fetchTags()
    return () => {
      cancelled = true
    }
  }, [])

  // 初回アクセス時にデフォルトの status=all を設定
  useEffect(() => {
    if (!searchParams.has('status')) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('status', 'all')
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
  const selectedTags = searchParams.getAll('tag[]')
  // useEffectの依存配列に配列を直接入れると毎回再実行されるため文字列化して比較
  const selectedTagsKey = selectedTags.join(',')

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
          perPage,
          tags: selectedTagsKey ? selectedTagsKey.split(',') : undefined,
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
  }, [status, mediaType, sort, page, perPage, rawStatus, selectedTagsKey])

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

  const setTags = useCallback(
    (newTags: string[]) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('tag[]')
        newTags.forEach((tag) => next.append('tag[]', tag))
        // タグ変更時はページをリセット
        next.delete('page')
        return next
      })
    },
    [setSearchParams],
  )

  return {
    records: state.records,
    totalPages: state.meta?.total_pages ?? 1,
    totalCount: state.meta?.total_count ?? 0,
    isLoading: state.isLoading,
    error: state.error,
    status,
    mediaType,
    sort,
    page,
    allTags,
    selectedTags,
    setStatus,
    setMediaType,
    setSort,
    setPage,
    setTags,
  }
}
