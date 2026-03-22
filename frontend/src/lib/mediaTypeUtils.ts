import type { MediaType } from './types'

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
