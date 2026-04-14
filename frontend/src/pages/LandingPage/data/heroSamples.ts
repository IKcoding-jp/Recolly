/**
 * ヒーロー右側に浮遊表示する作品カードのサンプルデータ。
 * 実 API からは取得せず、装飾として静的に描画する。
 *
 * 作品名は全て架空。商標リスク・景品表示法リスク(実在作品に架空スコアが
 * 付いているように見えること)を回避するため、実在作品は使わない。
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
    title: '月光回廊',
    serial: '#023',
    rating: 9.2,
    progressPercent: 74,
  },
  {
    mediaType: 'book',
    mediaLabel: '本',
    title: '静かな庭',
    serial: '#058',
    rating: 8.6,
    progressPercent: 100,
  },
  {
    mediaType: 'game',
    mediaLabel: 'ゲーム',
    title: '時を渡る島',
    serial: '#091',
    rating: 9.8,
    progressPercent: 55,
  },
] as const
