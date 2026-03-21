import { Button } from '../ui/Button/Button'
import styles from './RecordDeleteDialog.module.css'

type RecordDeleteDialogProps = {
  isOpen: boolean
  workTitle: string
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

export function RecordDeleteDialog({
  isOpen,
  workTitle,
  onConfirm,
  onCancel,
  isLoading,
}: RecordDeleteDialogProps) {
  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  )
}
