import type { ChangeEvent } from 'react'
import type { MediaType } from '../../../lib/types'
import { UNIT_LABELS } from '../../../lib/mediaTypeUtils'
import styles from './ProgressControl.module.css'

type ProgressControlProps = {
  current: number
  total: number | null
  onChange: (episode: number) => void
  showFullControls?: boolean
  mediaType?: MediaType
}

export function ProgressControl({
  current,
  total,
  onChange,
  showFullControls = false,
  mediaType,
}: ProgressControlProps) {
  const unit = (mediaType && UNIT_LABELS[mediaType]) ?? '話'
  const canIncrement = total === null || current < total
  const canDecrement = current > 0
  const percentage = total ? Math.round((current / total) * 100) : null

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 0 && (total === null || value <= total)) {
      onChange(value)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        {showFullControls && (
          <button
            type="button"
            className={styles.button}
            onClick={() => onChange(current - 1)}
            disabled={!canDecrement}
            aria-label="-1"
          >
            -
          </button>
        )}
        <span className={styles.display}>
          {total !== null ? `${current} / ${total}${unit}` : `${current}${unit}`}
        </span>
        <button
          type="button"
          className={`${styles.button} ${styles.increment}`}
          onClick={() => onChange(current + 1)}
          disabled={!canIncrement}
          aria-label="+1"
        >
          +
        </button>
        {showFullControls && (
          <input
            type="number"
            className={styles.input}
            value={current}
            onChange={handleInputChange}
            min={0}
            max={total ?? undefined}
            aria-label="話数入力"
          />
        )}
      </div>
      {total !== null && percentage !== null && (
        <div className={styles.bar}>
          <div className={styles.fill} style={{ width: `${percentage}%` }} />
        </div>
      )}
    </div>
  )
}
