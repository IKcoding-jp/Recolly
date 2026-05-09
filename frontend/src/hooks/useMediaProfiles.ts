import { useState, useCallback, useEffect } from 'react'
import { mediaPreferenceProfilesApi } from '../lib/mediaPreferenceProfilesApi'
import type { MediaPreferenceProfile } from '../types/mediaPreferenceProfile'

export function useMediaProfiles() {
  const [profiles, setProfiles] = useState<MediaPreferenceProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await mediaPreferenceProfilesApi.getAll()
      setProfiles(data)
    } catch {
      setError('メディア別プロファイルの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchProfiles()
  }, [fetchProfiles])

  const getProfileByMediaType = useCallback(
    (mediaType: string) => profiles.find((p) => p.media_type === mediaType) ?? null,
    [profiles],
  )

  return { profiles, isLoading, error, refetch: fetchProfiles, getProfileByMediaType }
}
