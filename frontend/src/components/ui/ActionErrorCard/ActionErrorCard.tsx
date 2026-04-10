import { Button } from '../Button/Button'
import styles from './ActionErrorCard.module.css'

type ActionErrorCardProps = {
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export function ActionErrorCard({ title, message, actionLabel, onAction }: ActionErrorCardProps) {
  return (
    <div className={styles.card} role="alert">
      <p className={styles.title}>{title}</p>
      <p className={styles.message}>{message}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
