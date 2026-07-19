import { useState, useCallback, useEffect, useRef } from 'react'
import { recommendationsApi } from '../lib/recommendationsApi'
import type { RecommendationData, RecommendationStatus } from '../types/recommendation'

const POLL_INTERVAL_MS = 5000
// 分析ジョブは通常1〜2分で完了する。ジョブ失敗時にポーリングが無限に続かないよう上限を設ける（5分）
const MAX_POLL_ATTEMPTS = 60

export function useRecommendations() {
  const [data, setData] = useState<RecommendationData | null>(null)
  const [status, setStatus] = useState<RecommendationStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 既存データがある状態で更新すると、ジョブ完了前もAPIは旧データをreadyで返す。
  // 更新開始時点のanalyzed_atを控え、これが変わるまでを「生成中」として扱う
  const baselineAnalyzedAtRef = useRef<string | null>(null)
  const latestAnalyzedAtRef = useRef<string | null>(null)
  const pollAttemptsRef = useRef(0)

  useEffect(() => {
    latestAnalyzedAtRef.current = data?.analyzed_at ?? null
  }, [data])

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
      baselineAnalyzedAtRef.current = latestAnalyzedAtRef.current
      pollAttemptsRef.current = 0
      setStatus('generating')
    } catch {
      setError('分析の更新に失敗しました')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  const pollForResult = useCallback(async () => {
    if (status !== 'generating') return

    pollAttemptsRef.current += 1
    try {
      const response = await recommendationsApi.get()
      const analyzedAt = response.recommendation?.analyzed_at ?? null
      if (response.status === 'ready' && analyzedAt !== baselineAnalyzedAtRef.current) {
        setData(response.recommendation)
        setStatus('ready')
        return
      }
    } catch {
      // ポーリング中のエラーは無視（次回ポーリングで再試行される）
    }

    if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
      // ジョブ失敗等で完了を検知できない場合の打ち切り。旧データの表示に戻す
      setStatus('ready')
      setError('分析の完了を確認できませんでした。時間をおいて再度お試しください')
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
