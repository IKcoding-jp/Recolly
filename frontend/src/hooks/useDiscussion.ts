import { useCallback, useEffect, useState } from 'react'
import type { Discussion } from '../lib/types'
import { discussionsApi } from '../lib/discussionsApi'

export function useDiscussion(id: number) {
  const [discussion, setDiscussion] = useState<Discussion | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    const fetchData = async () => {
      try {
        const res = await discussionsApi.getById(id)
        if (!cancelled) setDiscussion(res.discussion)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'エラーが発生しました')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void fetchData()
    return () => {
      cancelled = true
    }
  }, [id])

  const updateDiscussion = useCallback(
    async (params: { title?: string; body?: string; has_spoiler?: boolean }) => {
      const res = await discussionsApi.update(id, params)
      setDiscussion(res.discussion)
    },
    [id],
  )

  const deleteDiscussion = useCallback(async () => {
    await discussionsApi.delete(id)
  }, [id])

  return { discussion, isLoading, error, updateDiscussion, deleteDiscussion }
}
