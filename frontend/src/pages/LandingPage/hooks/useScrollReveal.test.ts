import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollReveal } from './useScrollReveal'

describe('useScrollReveal', () => {
  // IntersectionObserver のグローバルモック
  let observeFn: ReturnType<typeof vi.fn>
  let disconnectFn: ReturnType<typeof vi.fn>
  let unobserveFn: ReturnType<typeof vi.fn>
  let lastCallback: IntersectionObserverCallback | null = null

  beforeEach(() => {
    observeFn = vi.fn()
    disconnectFn = vi.fn()
    unobserveFn = vi.fn()
    lastCallback = null

    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(function (this: IntersectionObserver, cb: IntersectionObserverCallback) {
        lastCallback = cb
        this.observe = observeFn
        this.disconnect = disconnectFn
        this.unobserve = unobserveFn
        this.takeRecords = vi.fn()
        this.root = null
        this.rootMargin = ''
        this.thresholds = []
        return this
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('マウント後に .reveal 要素を監視する', () => {
    const el1 = document.createElement('div')
    el1.classList.add('reveal')
    const el2 = document.createElement('div')
    el2.classList.add('reveal')
    document.body.append(el1, el2)

    renderHook(() => useScrollReveal())

    expect(observeFn).toHaveBeenCalledWith(el1)
    expect(observeFn).toHaveBeenCalledWith(el2)

    el1.remove()
    el2.remove()
  })

  it('要素が画面内に入ると in クラスを付与して監視を解除する', () => {
    const el = document.createElement('div')
    el.classList.add('reveal')
    document.body.append(el)

    renderHook(() => useScrollReveal())

    // コールバックを手動発火
    if (!lastCallback) throw new Error('callback not captured')
    lastCallback(
      [
        {
          target: el,
          isIntersecting: true,
          intersectionRatio: 1,
          time: 0,
          boundingClientRect: el.getBoundingClientRect(),
          intersectionRect: el.getBoundingClientRect(),
          rootBounds: null,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    )

    expect(el.classList.contains('in')).toBe(true)
    expect(unobserveFn).toHaveBeenCalledWith(el)

    el.remove()
  })

  it('要素が画面内に入らない場合は in クラスを付与しない', () => {
    const el = document.createElement('div')
    el.classList.add('reveal')
    document.body.append(el)

    renderHook(() => useScrollReveal())

    if (!lastCallback) throw new Error('callback not captured')
    lastCallback(
      [
        {
          target: el,
          isIntersecting: false,
          intersectionRatio: 0,
          time: 0,
          boundingClientRect: el.getBoundingClientRect(),
          intersectionRect: el.getBoundingClientRect(),
          rootBounds: null,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    )

    expect(el.classList.contains('in')).toBe(false)
    expect(unobserveFn).not.toHaveBeenCalled()

    el.remove()
  })

  it('アンマウント時に observer を disconnect する', () => {
    const el = document.createElement('div')
    el.classList.add('reveal')
    document.body.append(el)

    const { unmount } = renderHook(() => useScrollReveal())
    unmount()

    expect(disconnectFn).toHaveBeenCalled()

    el.remove()
  })
})
