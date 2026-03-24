import type { RecordStatus } from '../../lib/types'
import { STATUS_OPTIONS } from './statusOptions'
import styles from './StatusFilter.module.css'

type StatusFilterProps = {
  value: RecordStatus | null
  onChange: (status: RecordStatus | null) => void
}

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
