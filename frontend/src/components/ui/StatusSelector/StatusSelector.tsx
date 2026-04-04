import type { MediaType, RecordStatus } from '../../../lib/types'
import { getStatusLabel } from '../../../lib/mediaTypeUtils'
import styles from './StatusSelector.module.css'

type StatusSelectorProps = {
  value: RecordStatus
  onChange: (status: RecordStatus) => void
  mediaType?: MediaType
}

const STATUS_VALUES: RecordStatus[] = [
  'watching',
  'completed',
  'on_hold',
  'dropped',
  'plan_to_watch',
]

export function StatusSelector({ value, onChange, mediaType }: StatusSelectorProps) {
  return (
    <div className={styles.container}>
      {STATUS_VALUES.map((status) => {
        const label = getStatusLabel(status, mediaType)
        return (
          <button
            key={status}
            type="button"
            className={`${styles.tab} ${value === status ? styles.active : ''}`}
            onClick={() => onChange(status)}
            aria-label={label}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
