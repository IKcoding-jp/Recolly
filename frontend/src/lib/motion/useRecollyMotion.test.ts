// frontend/src/lib/motion/useRecollyMotion.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// useReducedMotion をモックする
vi.mock('motion/react', () => ({
  useReducedMotion: vi.fn(),
}))

import { useReducedMotion } from 'motion/react'
import { useRecollyMotion } from './useRecollyMotion'
import { fadeInUpVariants, modalVariants } from './variants'

describe('useRecollyMotion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reduced-motion=false の時、通常 variants を返す', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false)

    const { result } = renderHook(() => useRecollyMotion())

    expect(result.current.fadeInUp).toBe(fadeInUpVariants)
    expect(result.current.modal).toBe(modalVariants)
  })

  it('reduced-motion=true の時、即時版 variants（opacity のみ）を返す', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)

    const { result } = renderHook(() => useRecollyMotion())

    // 通常版とは異なるオブジェクトであるべき
    expect(result.current.fadeInUp).not.toBe(fadeInUpVariants)
    expect(result.current.modal).not.toBe(modalVariants)

    // hidden 状態は opacity: 0 のみで y や scale を含まないこと
    const fadeHidden = result.current.fadeInUp.hidden as Record<string, unknown>
    expect(fadeHidden).toEqual({ opacity: 0 })

    const modalHidden = result.current.modal.hidden as Record<string, unknown>
    expect(modalHidden).toEqual({ opacity: 0 })
  })

  it('reduced-motion=true の時、duration が 0 になる', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)

    const { result } = renderHook(() => useRecollyMotion())

    const visible = result.current.fadeInUp.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, number>
    expect(transition.duration).toBe(0)
  })

  it('reduced-motion=true の時、stagger も 0 になる', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)

    const { result } = renderHook(() => useRecollyMotion())

    const containerVisible = result.current.listContainer.visible as Record<string, unknown>
    const transition = containerVisible.transition as Record<string, number>
    expect(transition.staggerChildren).toBe(0)
  })

  it('全 variants（list/fadeInUp/modal/overlay/dropdown/toast/banner）を返す', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false)

    const { result } = renderHook(() => useRecollyMotion())

    expect(result.current.listContainer).toBeDefined()
    expect(result.current.fadeInUp).toBeDefined()
    expect(result.current.modal).toBeDefined()
    expect(result.current.overlay).toBeDefined()
    expect(result.current.dropdown).toBeDefined()
    expect(result.current.toast).toBeDefined()
    expect(result.current.banner).toBeDefined()
  })
})
