import { useCallback, useEffect, useState } from 'react'
import type {
  FavoriteDisplayMode,
  FavoriteWorkItem,
  UserProfile,
  UserStatistics,
} from '../lib/types'
import { usersApi } from '../lib/usersApi'
import { profileApi } from '../lib/profileApi'

export function useUserProfile(userId: number) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [statistics, setStatistics] = useState<UserStatistics | null>(null)
  const [favoriteWorks, setFavoriteWorks] = useState<FavoriteWorkItem[]>([])
  const [displayMode, setDisplayMode] = useState<FavoriteDisplayMode>('ranking')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const fetchData = async () => {
      try {
        const [profileRes, favRes] = await Promise.all([
          usersApi.getProfile(userId),
          profileApi.getFavoriteWorks(userId),
        ])
        if (!cancelled) {
          setProfile(profileRes.user)
          setStatistics(profileRes.statistics)
          setFavoriteWorks(favRes.favorite_works)
          setDisplayMode(favRes.display_mode)
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
  }, [userId])

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => (prev ? { ...prev, ...updates } : prev))
  }, [])

  return {
    profile,
    statistics,
    favoriteWorks,
    setFavoriteWorks,
    displayMode,
    setDisplayMode,
    isLoading,
    error,
    updateProfile,
  }
}
