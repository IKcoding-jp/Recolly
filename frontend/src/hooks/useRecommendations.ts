import { useState, useCallback, useEffect } from 'react'
import { recommendationsApi } from '../lib/recommendationsApi'
import type { RecommendationData, RecommendationStatus } from '../types/recommendation'

const POLL_INTERVAL_MS = 5000

export function useRecommendations() {
  const [data, setData] = useState<RecommendationData | null>(null)
  const [status, setStatus] = useState<RecommendationStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await recommendationsApi.get()
      setData(response.recommendation)
      setStatus(response.status)
    } catch {
      setError('おすすめの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRecommendations()
  }, [fetchRecommendations])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      await recommendationsApi.refresh()
      setStatus('generating')
    } catch {
      setError('分析の更新に失敗しました')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  const pollForResult = useCallback(async () => {
    if (status !== 'generating') return

    try {
      const response = await recommendationsApi.get()
      if (response.status === 'ready') {
        setData(response.recommendation)
        setStatus('ready')
      }
    } catch {
      // ポーリング中のエラーは無視（次回ポーリングで再試行される）
    }
  }, [status])

  useEffect(() => {
    if (status !== 'generating') return

    const interval = setInterval(() => {
      void pollForResult()
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [status, pollForResult])

  return { data, status, isLoading, isRefreshing, error, refresh, refetch: fetchRecommendations }
}
