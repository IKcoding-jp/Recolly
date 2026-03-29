import { useCallback, useEffect, useState } from 'react'
import type { DiscussionComment, PaginationMeta } from '../lib/types'
import { commentsApi } from '../lib/commentsApi'

export function useComments(discussionId: number) {
  const [comments, setComments] = useState<DiscussionComment[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    const fetchData = async () => {
      try {
        const res = await commentsApi.getAll(discussionId, page)
        if (!cancelled) {
          setComments(res.comments)
          setMeta(res.meta)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void fetchData()
    return () => {
      cancelled = true
    }
  }, [discussionId, page])

  const addComment = useCallback(
    async (body: string) => {
      const res = await commentsApi.create(discussionId, body)
      setComments((prev) => [...prev, res.comment])
      setMeta((prev) => (prev ? { ...prev, total_count: prev.total_count + 1 } : prev))
    },
    [discussionId],
  )

  const updateComment = useCallback(async (commentId: number, body: string) => {
    const res = await commentsApi.update(commentId, body)
    setComments((prev) => prev.map((c) => (c.id === commentId ? res.comment : c)))
  }, [])

  const deleteComment = useCallback(async (commentId: number) => {
    await commentsApi.delete(commentId)
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    setMeta((prev) => (prev ? { ...prev, total_count: prev.total_count - 1 } : prev))
  }, [])

  return {
    comments,
    totalPages: meta?.total_pages ?? 1,
    totalCount: meta?.total_count ?? 0,
    page,
    isLoading,
    setPage,
    addComment,
    updateComment,
    deleteComment,
  }
}
