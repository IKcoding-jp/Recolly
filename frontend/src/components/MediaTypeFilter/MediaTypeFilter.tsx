import type { MediaType } from '../../lib/types'
import { MEDIA_TYPE_OPTIONS } from './mediaTypeOptions'
import styles from './MediaTypeFilter.module.css'

type MediaTypeFilterProps = {
  value: MediaType | null
  onChange: (mediaType: MediaType | null) => void
}

export function MediaTypeFilter({ value, onChange }: MediaTypeFilterProps) {
  return (
    <div className={styles.container}>
      {MEDIA_TYPE_OPTIONS.map((option) => (
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
