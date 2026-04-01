import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useUserProfile } from '../../hooks/useUserProfile'
import { useAuth } from '../../contexts/useAuth'
import { profileApi } from '../../lib/profileApi'
import { UserProfileHeader } from '../../components/UserProfileHeader/UserProfileHeader'
import { UserStats } from '../../components/UserStats/UserStats'
import { PublicLibrary } from '../../components/PublicLibrary/PublicLibrary'
import { FavoriteWorks } from '../../components/FavoriteWorks/FavoriteWorks'
import { FavoriteWorkSelector } from '../../components/FavoriteWorkSelector/FavoriteWorkSelector'
import type { FavoriteDisplayMode, WorkSummary } from '../../lib/types'
import styles from './UserProfilePage.module.css'

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>()
  const userId = Number(id)
  const { user } = useAuth()
  const {
    profile,
    statistics,
    favoriteWorks,
    setFavoriteWorks,
    displayMode,
    setDisplayMode,
    isLoading,
    error,
    updateProfile,
  } = useUserProfile(userId)

  const [isSelectorOpen, setIsSelectorOpen] = useState(false)

  const isOwner = user?.id === userId

  if (isLoading) {
    return <div className={styles.loading}>読み込み中...</div>
  }

  if (error || !profile || !statistics) {
    return <div className={styles.error}>{error ?? 'ユーザーが見つかりません'}</div>
  }

  const handleSelectWork = async (work: WorkSummary) => {
    setIsSelectorOpen(false)
    const nextPosition = favoriteWorks.length + 1
    const newItems = [
      ...favoriteWorks.map((fw) => ({ work_id: fw.work.id, position: fw.position })),
      { work_id: work.id, position: nextPosition },
    ]

    try {
      const res = await profileApi.updateFavoriteWorks(newItems)
      setFavoriteWorks(res.favorite_works)
    } catch {
      // エラー時は何もしない
    }
  }

  const handleRemoveWork = async (workId: number) => {
    const remaining = favoriteWorks
      .filter((fw) => fw.work.id !== workId)
      .map((fw, i) => ({ work_id: fw.work.id, position: i + 1 }))

    try {
      const res = await profileApi.updateFavoriteWorks(remaining)
      setFavoriteWorks(res.favorite_works)
    } catch {
      // エラー時は何もしない
    }
  }

  const handleDisplayModeChange = (mode: FavoriteDisplayMode) => {
    setDisplayMode(mode)
  }

  return (
    <div className={styles.page}>
      <UserProfileHeader profile={profile} isOwner={isOwner} onProfileUpdate={updateProfile} />
      <FavoriteWorks
        favoriteWorks={favoriteWorks}
        displayMode={displayMode}
        isOwner={isOwner}
        onOpenSelector={() => setIsSelectorOpen(true)}
        onRemove={(workId) => void handleRemoveWork(workId)}
        onDisplayModeChange={handleDisplayModeChange}
      />
      <UserStats statistics={statistics} />
      <PublicLibrary userId={userId} />

      <FavoriteWorkSelector
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        onSelect={(work) => void handleSelectWork(work)}
        excludeWorkIds={favoriteWorks.map((fw) => fw.work.id)}
      />
    </div>
  )
}
