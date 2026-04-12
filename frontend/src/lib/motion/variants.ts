// frontend/src/lib/motion/variants.ts
import type { Variants } from 'motion/react'
import { duration, easing } from './tokens'

/**
 * 子要素を staggered fade-in させるリストコンテナ用 variants。
 * staggerChildren で子要素を順次表示する時間差を制御する。
 */
export const listContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1, // 100ms間隔で子要素を順次表示
      delayChildren: 0.05,
    },
  },
}

/**
 * リストアイテム（カード等）の登場：下から16pxふわっと上昇しながらフェードイン
 */
export const fadeInUpVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease: easing.calm },
  },
}

/**
 * モーダル本体（ダイアログのコンテンツ）の出現/消失
 * scale と y のわずかな変化で「奥から手前に出てくる」感覚を演出
 */
export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: duration.slow, ease: easing.calm },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 4,
    transition: { duration: duration.base, ease: easing.exit },
  },
}

/**
 * モーダル背景オーバーレイ（半透明黒）のフェード
 */
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.base } },
  exit: { opacity: 0, transition: { duration: duration.fast } },
}

/**
 * ドロップダウン等の小さなフロート要素
 * 上から少しスライドダウンしながら出現
 */
export const dropdownVariants: Variants = {
  hidden: { opacity: 0, y: -4, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: duration.base, ease: easing.calm },
  },
  exit: {
    opacity: 0,
    y: -2,
    scale: 0.99,
    transition: { duration: duration.fast, ease: easing.exit },
  },
}

/**
 * トースト通知（画面下からスライドイン）
 * UpdatePrompt 等で使用
 */
export const toastVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease: easing.calm },
  },
  exit: {
    opacity: 0,
    y: 16,
    transition: { duration: duration.base, ease: easing.exit },
  },
}

/**
 * バナー（ヘッダー下からスライドイン、height 含む例外）
 * EmailPromptBanner 等で使用
 *
 * 注: 制約「transform と opacity のみ」の唯一の例外として height を使う。
 * 理由: バナーが閉じた時にレイアウト上のスペースも消す必要があるため。
 */
export const bannerVariants: Variants = {
  hidden: { opacity: 0, y: -16, height: 0 },
  visible: {
    opacity: 1,
    y: 0,
    height: 'auto',
    transition: { duration: duration.slow, ease: easing.calm },
  },
  exit: {
    opacity: 0,
    y: -8,
    height: 0,
    transition: { duration: duration.base, ease: easing.exit },
  },
}
