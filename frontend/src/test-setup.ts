import '@testing-library/jest-dom'
import { vi } from 'vitest'
import type React from 'react'

/**
 * motion ライブラリをテスト環境用にモックする。
 *
 * AnimatePresence をパススルー（子要素を素通し）にすることで、
 * 既存テストが「閉じるボタン押下後、即座にダイアログが消える」前提で
 * 動き続けられるようにする。
 *
 * アニメーション自体の見た目はテスト対象ではないので、
 * motion.div 等は通常の div として扱われれば十分。
 */
vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  }
})
