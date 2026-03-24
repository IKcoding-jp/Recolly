import styles from './UpdatePrompt.module.css'

type UpdatePromptProps = {
  needRefresh: boolean
  onRefresh: () => void
  onClose: () => void
}

export function UpdatePrompt({ needRefresh, onRefresh, onClose }: UpdatePromptProps) {
  if (!needRefresh) return null

  return (
    <div className={styles.toast}>
      <span className={styles.message}>新しいバージョンがあります</span>
      <button className={styles.refreshButton} onClick={onRefresh}>
        更新する
      </button>
      <button className={styles.closeButton} onClick={onClose} aria-label="閉じる">
        ✕
      </button>
    </div>
  )
}
