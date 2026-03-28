import type { MediaType, RecordStatus } from './types'

// ジャンル別のアクションボタンラベル
const ACTION_LABELS: Record<MediaType, string> = {
  anime: '+1話',
  drama: '+1話',
  manga: '+1巻',
  book: '読了',
  movie: '観た',
  game: 'クリア',
}

// 話数・巻数の概念があるメディアタイプ
const EPISODE_MEDIA_TYPES: ReadonlySet<MediaType> = new Set(['anime', 'drama', 'manga'])

// 話数・巻数の単位ラベル
const UNIT_LABELS: Partial<Record<MediaType, string>> = {
  anime: '話',
  drama: '話',
  manga: '巻',
}

// 話数の概念がないメディアタイプの進捗テキスト
const FALLBACK_PROGRESS: Partial<Record<MediaType, string>> = {
  movie: '—',
  game: 'プレイ中',
  book: '読書中',
}

// ジャンル名の日本語ラベル
const GENRE_LABELS: Record<MediaType, string> = {
  anime: 'アニメ',
  movie: '映画',
  drama: 'ドラマ',
  book: '本',
  manga: '漫画',
  game: 'ゲーム',
}

/** ジャンルに応じたアクションボタンのラベルを返す */
export function getActionLabel(mediaType: MediaType): string {
  return ACTION_LABELS[mediaType]
}

/** ジャンルの日本語ラベルを返す */
export function getGenreLabel(mediaType: MediaType): string {
  return GENRE_LABELS[mediaType]
}

/** そのジャンルに話数・巻数の概念があるかを返す */
export function hasEpisodes(mediaType: MediaType): boolean {
  return EPISODE_MEDIA_TYPES.has(mediaType)
}

// ジャンル別ステータスラベル定義
const STATUS_LABELS: Record<
  RecordStatus,
  { video: string; reading: string; game: string; generic: string }
> = {
  watching: { video: '視聴中', reading: '読書中', game: 'プレイ中', generic: '進行中' },
  completed: { video: '視聴完了', reading: '読了', game: 'プレイ完了', generic: '完了' },
  plan_to_watch: { video: '視聴予定', reading: '読書予定', game: 'プレイ予定', generic: '予定' },
  on_hold: { video: '一時停止', reading: '一時停止', game: '一時停止', generic: '一時停止' },
  dropped: { video: '中断', reading: '中断', game: '中断', generic: '中断' },
}

const MEDIA_TYPE_GROUP: Record<MediaType, 'video' | 'reading' | 'game'> = {
  anime: 'video',
  movie: 'video',
  drama: 'video',
  book: 'reading',
  manga: 'reading',
  game: 'game',
}

const STATUS_ORDER: RecordStatus[] = [
  'watching',
  'completed',
  'on_hold',
  'dropped',
  'plan_to_watch',
]

/** ジャンルに応じたステータスラベルを返す。mediaType 未指定時は汎用ラベル */
export function getStatusLabel(status: RecordStatus, mediaType?: MediaType | null): string {
  const group = mediaType ? MEDIA_TYPE_GROUP[mediaType] : null
  return STATUS_LABELS[status][group ?? 'generic']
}

/** ステータスフィルター用のオプション配列を返す（「すべて」付き） */
export function getStatusOptions(
  mediaType?: MediaType | null,
): { value: RecordStatus | null; label: string }[] {
  return [
    { value: null, label: 'すべて' },
    ...STATUS_ORDER.map((status) => ({
      value: status,
      label: getStatusLabel(status, mediaType),
    })),
  ]
}

// 再視聴/再読/リプレイのラベル
const REWATCH_LABELS: Record<'video' | 'reading' | 'game', string> = {
  video: '再視聴回数',
  reading: '再読回数',
  game: 'リプレイ回数',
}

/** メディアタイプに応じた再視聴ラベルを返す */
export function getRewatchLabel(mediaType: MediaType): string {
  return REWATCH_LABELS[MEDIA_TYPE_GROUP[mediaType]]
}

/** 現在の進捗をテキストで返す（例: 「12 / 25話」「プレイ中」） */
export function getProgressText(
  mediaType: MediaType,
  currentEpisode: number,
  totalEpisodes: number | null,
): string {
  if (!EPISODE_MEDIA_TYPES.has(mediaType)) {
    return FALLBACK_PROGRESS[mediaType] ?? '—'
  }
  const unit = UNIT_LABELS[mediaType] ?? '話'
  if (totalEpisodes) {
    return `${currentEpisode} / ${totalEpisodes}${unit}`
  }
  return `${currentEpisode}${unit}`
}
