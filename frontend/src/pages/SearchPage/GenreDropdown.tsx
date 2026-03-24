import type { MediaType } from '../../lib/types'
import styles from './GenreDropdown.module.css'

export type GenreFilter = MediaType | 'all'

export const GENRE_FILTERS: { value: GenreFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'anime', label: 'アニメ' },
  { value: 'movie', label: '映画' },
  { value: 'drama', label: 'ドラマ' },
  { value: 'book', label: '本' },
  { value: 'manga', label: '漫画' },
  { value: 'game', label: 'ゲーム' },
]

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
