import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Discussion, MediaType, PaginationMeta } from '../lib/types'
import { discussionsApi } from '../lib/discussionsApi'

export type DiscussionSort = 'newest' | 'most_comments'

const PER_PAGE = 20

export function useDiscussions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // URLパラメータからフィルタ状態を読み取る
  const mediaType = (searchParams.get('media_type') as MediaType | null) ?? null
  const sort: DiscussionSort = (searchParams.get('sort') as DiscussionSort) || 'newest'
  const page = Number(searchParams.get('page')) || 1
  const workId = searchParams.get('work_id') ? Number(searchParams.get('work_id')) : undefined

  // ディスカッション一覧を取得
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const fetchData = async () => {
      try {
        const res = await discussionsApi.getAll({
          workId,
          mediaType: mediaType ?? undefined,
          sort,
          page,
          perPage: PER_PAGE,
        })
        if (!cancelled) {
          setDiscussions(res.discussions)
          setMeta(res.meta)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'エラーが発生しました')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }
    void fetchData()
    return () => {
      cancelled = true
    }
  }, [mediaType, sort, page, workId])

  // URLパラメータを更新する共通関数（フィルタ変更時はページをリセット）
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
        // ページ変更以外の場合はページをリセット
        if (!('page' in updates)) {
          next.delete('page')
        }
        return next
      })
    },
    [setSearchParams],
  )

  return {
    discussions,
    totalPages: meta?.total_pages ?? 1,
    isLoading,
    error,
    mediaType,
    sort,
    page,
    setMediaType: useCallback(
      (mt: MediaType | null) => updateParams({ media_type: mt }),
      [updateParams],
    ),
    setSort: useCallback((s: DiscussionSort) => updateParams({ sort: s }), [updateParams]),
    setPage: useCallback((p: number) => updateParams({ page: String(p) }), [updateParams]),
  }
}
