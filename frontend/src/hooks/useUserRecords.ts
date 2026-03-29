import { useCallback, useEffect, useState } from 'react'
import type { MediaType, PaginationMeta, PublicRecord } from '../lib/types'
import { usersApi } from '../lib/usersApi'

/** 1ページあたりの表示件数 */
const PER_PAGE = 20

export function useUserRecords(userId: number) {
  const [records, setRecords] = useState<PublicRecord[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [mediaType, setMediaTypeState] = useState<MediaType | null>(null)
  const [sort, setSortState] = useState('updated_at')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const fetchRecords = async () => {
      try {
        const res = await usersApi.getRecords(userId, {
          mediaType: mediaType ?? undefined,
          sort,
          page,
          perPage: PER_PAGE,
        })
        if (!cancelled) {
          setRecords(res.records)
          setMeta(res.meta)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void fetchRecords()
    return () => {
      cancelled = true
    }
  }, [userId, mediaType, sort, page])

  /** ジャンルフィルター変更時はページを1に戻す */
  const setMediaType = useCallback((mt: MediaType | null) => {
    setMediaTypeState(mt)
    setPage(1)
  }, [])

  /** 並び替え変更時はページを1に戻す */
  const setSort = useCallback((s: string) => {
    setSortState(s)
    setPage(1)
  }, [])

  return {
    records,
    totalPages: meta?.total_pages ?? 1,
    isLoading,
    mediaType,
    sort,
    page,
    setMediaType,
    setSort,
    setPage,
  }
}
