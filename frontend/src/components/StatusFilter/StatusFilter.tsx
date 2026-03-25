import type { MediaType, RecordStatus } from '../../lib/types'
import { getStatusOptions } from './statusOptions'
import styles from './StatusFilter.module.css'

type StatusFilterProps = {
  value: RecordStatus | null
  onChange: (status: RecordStatus | null) => void
  mediaType?: MediaType | null
}

export function StatusFilter({ value, onChange, mediaType }: StatusFilterProps) {
  const options = getStatusOptions(mediaType)

  return (
    <div className={styles.container}>
      {options.map((option) => (
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
