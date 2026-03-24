import styles from './SortSelector.module.css'

export type SortOption = 'updated_at' | 'rating' | 'title_asc'

type SortSelectorProps = {
  value: SortOption
  onChange: (sort: SortOption) => void
}

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'updated_at', label: '更新日' },
  { value: 'rating', label: '評価' },
  { value: 'title_asc', label: 'タイトル' },
]

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
