import { motion } from 'motion/react'
import { useRecollyMotion } from '../../../lib/motion'
import styles from './UpdatePrompt.module.css'

type UpdatePromptProps = {
  onRefresh: () => void
  onClose: () => void
}

export function UpdatePrompt({ onRefresh, onClose }: UpdatePromptProps) {
  const m = useRecollyMotion()

  return (
    <motion.div
      className={styles.toast}
      variants={m.toast}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <span className={styles.message}>新しいバージョンがあります</span>
      <button className={styles.refreshButton} onClick={onRefresh}>
        更新する
      </button>
      <button className={styles.closeButton} onClick={onClose} aria-label="閉じる">
        ✕
      </button>
    </motion.div>
  )
}
