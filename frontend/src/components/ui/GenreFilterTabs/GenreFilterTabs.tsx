import type { GenreFilter } from '../../../lib/genreFilters'
import { GENRE_FILTERS } from '../../../lib/genreFilters'
import styles from './GenreFilterTabs.module.css'

type GenreFilterTabsProps = {
  value: GenreFilter
  onChange: (value: GenreFilter) => void
}

// 検索・ライブラリ・コミュニティ・作品選択モーダルで共通の
// ジャンル絞り込みタブ（下線タブスタイル）
export function GenreFilterTabs({ value, onChange }: GenreFilterTabsProps) {
  return (
    <div className={styles.tabs}>
      {GENRE_FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          aria-pressed={value === filter.value}
          className={`${styles.filterButton} ${value === filter.value ? styles.filterActive : ''}`}
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}
