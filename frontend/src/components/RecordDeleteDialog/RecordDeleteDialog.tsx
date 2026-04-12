import { motion } from 'motion/react'
import { Button } from '../ui/Button/Button'
import { useRecollyMotion } from '../../lib/motion'
import styles from './RecordDeleteDialog.module.css'

type RecordDeleteDialogProps = {
  workTitle: string
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

export function RecordDeleteDialog({
  workTitle,
  onConfirm,
  onCancel,
  isLoading,
}: RecordDeleteDialogProps) {
  const m = useRecollyMotion()

  return (
    <motion.div
      className={styles.overlay}
      onClick={onCancel}
      variants={m.overlay}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div className={styles.dialog} onClick={(e) => e.stopPropagation()} variants={m.modal}>
        <h3 className={styles.title}>記録を削除</h3>
        <p className={styles.message}>
          「{workTitle}」の記録を削除しますか？この操作は取り消せません。
        </p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? '削除中...' : '削除する'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
