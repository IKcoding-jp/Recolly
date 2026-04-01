import { useState, useRef } from 'react'
import type { UserProfile } from '../../lib/types'
import { profileApi } from '../../lib/profileApi'
import { imagesApi } from '../../lib/imagesApi'
import { Button } from '../ui/Button/Button'
import { useBioEdit, BIO_MAX_LENGTH } from './useBioEdit'
import styles from './UserProfileHeader.module.css'

type UserProfileHeaderProps = {
  profile: UserProfile
  isOwner: boolean
  onProfileUpdate?: (updates: Partial<UserProfile>) => void
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function formatJoinDate(createdAt: string): string {
  const date = new Date(createdAt)
  const formatted = date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
  })
  return `${formatted}から利用`
}

export function UserProfileHeader({ profile, isOwner, onProfileUpdate }: UserProfileHeaderProps) {
  const initial = profile.username.charAt(0).toUpperCase()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bio = useBioEdit(profile, onProfileUpdate)

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const handleAvatarClick = () => {
    if (!isOwner || isUploadingAvatar) return
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!ALLOWED_TYPES.includes(file.type)) {
      setAvatarError('JPEG, PNG, GIF, WebPのみ対応しています')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setAvatarError('ファイルサイズは10MB以下にしてください')
      return
    }

    setAvatarError(null)
    setIsUploadingAvatar(true)

    try {
      const { presigned_url, s3_key } = await profileApi.presignAvatar(
        file.name,
        file.type,
        file.size,
      )
      await imagesApi.uploadToS3(presigned_url, file)
      await profileApi.update({ avatar_url: s3_key })
      onProfileUpdate?.({ avatar_url: presigned_url })
    } catch {
      setAvatarError('アップロードに失敗しました')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  return (
    <header className={styles.header}>
      <div
        className={`${styles.avatar} ${isOwner ? styles.avatarEditable : ''}`}
        onClick={handleAvatarClick}
        role={isOwner ? 'button' : undefined}
        tabIndex={isOwner ? 0 : undefined}
        aria-label={isOwner ? 'アバター画像を変更' : undefined}
        onKeyDown={
          isOwner
            ? (e) => {
                if (e.key === 'Enter') handleAvatarClick()
              }
            : undefined
        }
      >
        {profile.avatar_url ? (
          <img
            className={styles.avatarImage}
            src={profile.avatar_url}
            alt={`${profile.username}のアバター`}
          />
        ) : (
          <span className={styles.avatarInitial}>{initial}</span>
        )}
        {isOwner && !isUploadingAvatar && (
          <div className={styles.avatarOverlay}>
            <span className={styles.cameraIcon}>📷</span>
          </div>
        )}
        {isUploadingAvatar && (
          <div className={`${styles.avatarOverlay} ${styles.avatarOverlayVisible}`}>
            <span className={styles.uploadingText}>...</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className={styles.fileInput}
          onChange={(e) => void handleFileSelect(e)}
        />
      </div>

      <div className={styles.info}>
        <h1 className={styles.username}>{profile.username}</h1>

        {bio.isEditing ? (
          <div className={styles.bioEdit}>
            <textarea
              className={styles.bioTextarea}
              value={bio.value}
              onChange={(e) => bio.setValue(e.target.value)}
              maxLength={BIO_MAX_LENGTH}
              rows={2}
              autoFocus
            />
            <div className={styles.bioEditFooter}>
              <span className={styles.charCount}>
                {bio.value.length} / {BIO_MAX_LENGTH}
              </span>
              <div className={styles.bioEditActions}>
                <Button variant="secondary" size="sm" onClick={bio.cancel} disabled={bio.isSaving}>
                  キャンセル
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void bio.save()}
                  disabled={bio.isSaving}
                >
                  {bio.isSaving ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
            {bio.error && <p className={styles.error}>{bio.error}</p>}
          </div>
        ) : (
          <>
            {profile.bio ? (
              <p className={styles.bio}>
                {profile.bio}
                {isOwner && (
                  <button
                    type="button"
                    className={styles.editBioButton}
                    onClick={bio.startEdit}
                    aria-label="自己紹介を編集"
                  >
                    ✏️
                  </button>
                )}
              </p>
            ) : isOwner ? (
              <button type="button" className={styles.addBioButton} onClick={bio.startEdit}>
                ＋ 自己紹介を追加
              </button>
            ) : null}
          </>
        )}

        <span className={styles.joinDate}>{formatJoinDate(profile.created_at)}</span>
      </div>

      {avatarError && <p className={styles.avatarError}>{avatarError}</p>}
    </header>
  )
}
