// frontend/src/lib/motion/tokens.ts

/**
 * アニメーションの時間（秒単位、motion ライブラリの形式）
 *
 * Editorial Calm × Snappy Modern ハイブリッドのキャラクターに基づく値:
 * - fast/base は Snappy Modern 側（即応的フィードバック）
 * - slow/slower は Editorial Calm 側（主要な登場・遷移）
 */
export const duration = {
  /** ホバー、フォーカスなどの即応的フィードバック */
  fast: 0.16, // 160ms
  /** ボタンクリック、トグルなどの状態変化 */
  base: 0.24, // 240ms
  /** カード登場、モーダル開閉などの主要な動き */
  slow: 0.38, // 380ms
  /** ページ遷移、大きな構造変化（フェーズ2用に予約） */
  slower: 0.52, // 520ms
} as const

/**
 * アニメーションのイージング曲線（cubic-bezier 4点形式）
 *
 * cubic-bezier(x1, y1, x2, y2) は加速減速のカーブを定義する。
 * https://cubic-bezier.com/ で視覚的に確認できる。
 */
export const easing = {
  /** Snappy Modern用：素早く立ち上がってスッと止まる */
  snap: [0.32, 0.72, 0, 1] as const,
  /** Editorial Calm用：ゆったり減速。最も使う */
  calm: [0.16, 1, 0.3, 1] as const,
  /** 退場用：最初は緩やかで途中で加速 */
  exit: [0.7, 0, 0.84, 0] as const,
} as const
