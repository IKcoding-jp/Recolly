import type { RecordStatus } from '../../lib/types'
import styles from './StatusFilter.module.css'

type StatusFilterProps = {
  value: RecordStatus | null
  onChange: (status: RecordStatus | null) => void
}

export const STATUS_OPTIONS: { value: RecordStatus | null; label: string }[] = [
  { value: null, label: 'すべて' },
  { value: 'watching', label: '視聴中' },
  { value: 'completed', label: '視聴完了' },
  { value: 'on_hold', label: '一時停止' },
  { value: 'dropped', label: '中断' },
  { value: 'plan_to_watch', label: '視聴予定' },
]

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <div className={styles.container}>
      {STATUS_OPTIONS.map((option) => (
        <button
          key={option.value ?? 'all'}
          type="button"
          className={`${styles.pill} ${value === option.value ? styles.active : ''}`}
          onClick={() => onChange(option.value)}
          aria-label={option.label}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
