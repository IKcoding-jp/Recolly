import { useEffect } from 'react'

/**
 * `.reveal` クラスを持つ要素を Intersection Observer で監視し、
 * 画面内に入った瞬間に `.in` クラスを付与して監視を解除する。
 *
 * LandingPage のスクロール・リビール用。各セクションのフェードイン演出に使う。
 * `prefers-reduced-motion: reduce` の環境では初期状態で全ての要素に `.in` を付与する
 * （アニメーション無しで即座に表示）。
 */
export function useScrollReveal(): void {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('.reveal')

    // prefers-reduced-motion 対応: アニメーション無しで即座表示
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      targets.forEach((el) => el.classList.add('in'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
    )

    targets.forEach((el) => observer.observe(el))

    return () => {
      observer.disconnect()
    }
  }, [])
}
