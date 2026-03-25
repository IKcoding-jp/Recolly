import { useState, useEffect } from 'react'
import { statisticsApi } from '../lib/statisticsApi'
import type { Statistics } from '../lib/types'

export function useStatistics() {
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchStats = async () => {
      try {
        const data = await statisticsApi.get()
        if (!cancelled) setStatistics(data)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void fetchStats()
    return () => {
      cancelled = true
    }
  }, [])

  return { statistics, isLoading }
}
