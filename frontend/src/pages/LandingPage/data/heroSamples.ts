/**
 * ヒーロー右側に浮遊表示する作品カードのサンプルデータ。
 * 実 API からは取得せず、装飾として静的に描画する。
 *
 * NOTE: 作品名は外部作品の商標である可能性があるため、公開前に
 * 架空作品名に差し替えるか、ジャンル表示のみにするかを再判断すること。
 * Spec: docs/superpowers/specs/2026-04-14-landing-page-design.md §4.6
 */

export type HeroCardMediaType = 'anime' | 'movie' | 'drama' | 'book' | 'manga' | 'game'

export type HeroCardSample = {
  mediaType: HeroCardMediaType
  mediaLabel: string
  title: string
  serial: string
  rating: number
  progressPercent: number
}

export const HERO_CARD_SAMPLES: readonly HeroCardSample[] = [
  {
    mediaType: 'anime',
    mediaLabel: 'アニメ',
    title: '葬送のフリーレン',
    serial: '#023',
    rating: 9.2,
    progressPercent: 74,
  },
  {
    mediaType: 'book',
    mediaLabel: '本',
    title: 'コンビニ人間',
    serial: '#058',
    rating: 8.6,
    progressPercent: 100,
  },
  {
    mediaType: 'game',
    mediaLabel: 'ゲーム',
    title: 'Outer Wilds',
    serial: '#091',
    rating: 9.8,
    progressPercent: 55,
  },
] as const
