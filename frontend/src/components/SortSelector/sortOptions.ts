// 並び替えの型定義と選択肢定数

export type SortOption = 'updated_at' | 'rating' | 'title_asc'

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'updated_at', label: '更新日' },
  { value: 'rating', label: '評価' },
  { value: 'title_asc', label: 'タイトル' },
]
