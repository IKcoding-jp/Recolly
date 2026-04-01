import { useState } from 'react'
import type { FavoriteWorkItem, FavoriteDisplayMode } from '../../lib/types'
import { profileApi } from '../../lib/profileApi'
import { ToggleSwitch } from '../ui/ToggleSwitch/ToggleSwitch'
import { Button } from '../ui/Button/Button'
import styles from './FavoriteWorks.module.css'

type FavoriteWorksProps = {
  favoriteWorks: FavoriteWorkItem[]
  displayMode: FavoriteDisplayMode
  isOwner: boolean
  onOpenSelector: () => void
  onRemove: (workId: number) => void
  onDisplayModeChange: (mode: FavoriteDisplayMode) => void
}

const RANK_CLASSES = ['rankGold', 'rankSilver', 'rankBronze', 'rankDefault', 'rankDefault'] as const

export function FavoriteWorks({
  favoriteWorks,
  displayMode,
  isOwner,
  onOpenSelector,
  onRemove,
  onDisplayModeChange,
}: FavoriteWorksProps) {
  const [isSwitching, setIsSwitching] = useState(false)

  if (!isOwner && favoriteWorks.length === 0) {
    return null
  }

  const handleModeToggle = async (isRight: boolean) => {
    const newMode: FavoriteDisplayMode = isRight ? 'favorites' : 'ranking'
    setIsSwitching(true)
    try {
      await profileApi.update({ favorite_display_mode: newMode })
      onDisplayModeChange(newMode)
    } catch {
      // 失敗時はUIを戻さない
    } finally {
      setIsSwitching(false)
    }
  }

  const isRanking = displayMode === 'ranking'
  const sectionTitle = isRanking ? 'マイベスト5' : 'お気に入り'
  const emptySlots = 5 - favoriteWorks.length

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>{sectionTitle}</h2>
        {isOwner && (
          <ToggleSwitch
            leftLabel="ランキング"
            rightLabel="お気に入り"
            isRight={displayMode === 'favorites'}
            onChange={(isRight) => void handleModeToggle(isRight)}
            disabled={isSwitching}
          />
        )}
      </div>

      {favoriteWorks.length === 0 && isOwner ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>お気に入りの作品をライブラリから選んで表示しましょう</p>
          <Button variant="primary" size="sm" onClick={onOpenSelector}>
            + 作品を追加
          </Button>
        </div>
      ) : (
        <div className={styles.grid}>
          {favoriteWorks.map((fw, index) => (
            <div key={fw.id} className={styles.workItem}>
              {isRanking && (
                <span className={`${styles.rankBadge} ${styles[RANK_CLASSES[index]]}`}>
                  {fw.position}
                </span>
              )}
              <div
                className={`${styles.coverWrapper} ${isRanking && index === 0 ? styles.coverGold : ''}`}
              >
                {fw.work.cover_image_url ? (
                  <img
                    className={styles.coverImage}
                    src={fw.work.cover_image_url}
                    alt={fw.work.title}
                  />
                ) : (
                  <div className={styles.coverPlaceholder}>{fw.work.title.charAt(0)}</div>
                )}
                {isOwner && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => onRemove(fw.work.id)}
                    aria-label={`${fw.work.title}を削除`}
                  >
                    x
                  </button>
                )}
              </div>
              <span className={styles.workTitle}>{fw.work.title}</span>
            </div>
          ))}
          {isOwner && emptySlots > 0 && (
            <div className={styles.workItem}>
              <button
                type="button"
                className={styles.addSlot}
                onClick={onOpenSelector}
                aria-label="作品を追加"
              >
                +
              </button>
              <span className={styles.workTitle}>追加</span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
