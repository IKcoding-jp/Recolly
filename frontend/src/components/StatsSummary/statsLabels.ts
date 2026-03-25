// ジャンル・ステータスの表示ラベルを一元管理
export const GENRE_LABELS: Record<string, string> = {
  anime: 'アニメ',
  movie: '映画',
  drama: 'ドラマ',
  book: '本',
  manga: '漫画',
  game: 'ゲーム',
}

export const STATUS_LABELS: Record<string, string> = {
  watching: '視聴中',
  completed: '完了',
  on_hold: '保留',
  dropped: '中断',
  plan_to_watch: '予定',
}
