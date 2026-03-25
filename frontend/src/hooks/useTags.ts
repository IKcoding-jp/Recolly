import { useState, useEffect, useCallback } from 'react'
import { tagsApi } from '../lib/tagsApi'
import type { Tag } from '../lib/types'

export function useTags(recordId: number, initialTags: Tag[] = []) {
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchTags = async () => {
      try {
        const res = await tagsApi.getAll()
        if (!cancelled) setAllTags(res.tags)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void fetchTags()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setTags(initialTags)
  }, [initialTags])

  const addTag = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const res = await tagsApi.addToRecord(recordId, trimmed)
      setTags((prev) => [...prev, res.tag])
      // allTagsにも追加（まだ無ければ）
      setAllTags((prev) => (prev.some((t) => t.id === res.tag.id) ? prev : [...prev, res.tag]))
    },
    [recordId],
  )

  const removeTag = useCallback(
    async (tagId: number) => {
      await tagsApi.removeFromRecord(recordId, tagId)
      setTags((prev) => prev.filter((t) => t.id !== tagId))
    },
    [recordId],
  )

  return { tags, allTags, isLoading, addTag, removeTag }
}
