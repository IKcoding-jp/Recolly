import { useParams } from 'react-router-dom'
import { useUserProfile } from '../../hooks/useUserProfile'
import { UserProfileHeader } from '../../components/UserProfileHeader/UserProfileHeader'
import { UserStats } from '../../components/UserStats/UserStats'
import { PublicLibrary } from '../../components/PublicLibrary/PublicLibrary'
import styles from './UserProfilePage.module.css'

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>()
  const userId = Number(id)
  const { profile, statistics, isLoading, error } = useUserProfile(userId)

  if (isLoading) {
    return <div className={styles.loading}>読み込み中...</div>
  }

  if (error || !profile || !statistics) {
    return <div className={styles.error}>{error ?? 'ユーザーが見つかりません'}</div>
  }

  return (
    <div className={styles.page}>
      <UserProfileHeader profile={profile} />
      <UserStats statistics={statistics} />
      <PublicLibrary userId={userId} />
    </div>
  )
}
