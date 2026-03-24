import type { GenreFilter } from './genreFilters'
import { GENRE_FILTERS } from './genreFilters'
import styles from './GenreDropdown.module.css'

type GenreDropdownProps = {
  value: GenreFilter
  onChange: (genre: GenreFilter) => void
}

export function GenreDropdown({ value, onChange }: GenreDropdownProps) {
  return (
    <div className={styles.genreSelect}>
      <span className={styles.genreSelectLabel}>ジャンル</span>
      <select
        className={styles.genreSelectInput}
        value={value}
        onChange={(e) => onChange(e.target.value as GenreFilter)}
      >
        {GENRE_FILTERS.map((filter) => (
          <option key={filter.value} value={filter.value}>
            {filter.label}
          </option>
        ))}
      </select>
    </div>
  )
}
