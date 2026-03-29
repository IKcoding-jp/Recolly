import { useEffect, useState } from 'react'
import type { UserProfile, UserStatistics } from '../lib/types'
import { usersApi } from '../lib/usersApi'

export function useUserProfile(userId: number) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [statistics, setStatistics] = useState<UserStatistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const fetchProfile = async () => {
      try {
        const res = await usersApi.getProfile(userId)
        if (!cancelled) {
          setProfile(res.user)
          setStatistics(res.statistics)
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

    void fetchProfile()
    return () => {
      cancelled = true
    }
  }, [userId])

  return { profile, statistics, isLoading, error }
}
