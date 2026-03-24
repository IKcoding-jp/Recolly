// ジャンルフィルタの型定義と定数
import type { MediaType } from '../../lib/types'

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
