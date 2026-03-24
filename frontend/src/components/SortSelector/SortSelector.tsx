import type { SortOption } from './sortOptions'
import { SORT_OPTIONS } from './sortOptions'
import styles from './SortSelector.module.css'

type SortSelectorProps = {
  value: SortOption
  onChange: (sort: SortOption) => void
}

export function SortSelector({ value, onChange }: SortSelectorProps) {
  return (
    <div className={styles.container}>
      <span className={styles.label}>並び替え</span>
      {SORT_OPTIONS.map((option) => (
        <button
          key={option.value}
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
