import type { UserProfile } from '../../lib/types'
import styles from './UserProfileHeader.module.css'

type UserProfileHeaderProps = {
  profile: UserProfile
}

/** 参加年月を「2026年3月から利用」形式で返す */
function formatJoinDate(createdAt: string): string {
  const date = new Date(createdAt)
  const formatted = date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
  })
  return `${formatted}から利用`
}

export function UserProfileHeader({ profile }: UserProfileHeaderProps) {
  // アバターがない場合はユーザー名の頭文字を表示する
  const initial = profile.username.charAt(0).toUpperCase()

  return (
    <header className={styles.header}>
      <div className={styles.avatar}>
        {profile.avatar_url ? (
          <img
            className={styles.avatarImage}
            src={profile.avatar_url}
            alt={`${profile.username}のアバター`}
          />
        ) : (
          <span className={styles.avatarInitial}>{initial}</span>
        )}
      </div>
      <div className={styles.info}>
        <h1 className={styles.username}>{profile.username}</h1>
        {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
        <span className={styles.joinDate}>{formatJoinDate(profile.created_at)}</span>
      </div>
    </header>
  )
}
