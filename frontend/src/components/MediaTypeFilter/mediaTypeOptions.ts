// メディアタイプフィルタの選択肢定数
import type { MediaType } from '../../lib/types'

export const MEDIA_TYPE_OPTIONS: { value: MediaType | null; label: string }[] = [
  { value: null, label: '全ジャンル' },
  { value: 'anime', label: 'アニメ' },
  { value: 'movie', label: '映画' },
  { value: 'drama', label: 'ドラマ' },
  { value: 'book', label: '本' },
  { value: 'manga', label: '漫画' },
  { value: 'game', label: 'ゲーム' },
]
