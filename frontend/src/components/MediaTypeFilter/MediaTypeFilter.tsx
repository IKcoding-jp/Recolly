import type { MediaType } from '../../lib/types'
import styles from './MediaTypeFilter.module.css'

type MediaTypeFilterProps = {
  value: MediaType | null
  onChange: (mediaType: MediaType | null) => void
}

export const MEDIA_TYPE_OPTIONS: { value: MediaType | null; label: string }[] = [
  { value: null, label: '全ジャンル' },
  { value: 'anime', label: 'アニメ' },
  { value: 'movie', label: '映画' },
  { value: 'drama', label: 'ドラマ' },
  { value: 'book', label: '本' },
  { value: 'manga', label: '漫画' },
  { value: 'game', label: 'ゲーム' },
]

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
