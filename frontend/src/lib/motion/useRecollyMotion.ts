// frontend/src/lib/motion/useRecollyMotion.ts
import { useReducedMotion } from 'motion/react'
import {
  fadeInUpVariants,
  listContainerVariants,
  modalVariants,
  overlayVariants,
  dropdownVariants,
  toastVariants,
  bannerVariants,
} from './variants'

/**
 * Recolly全体のアニメーションを reduced-motion に応じて切り替える共通フック。
 *
 * reduced-motion が有効なら、全 variants を「即時状態変化」版（opacity のみ、duration 0）
 * に置き換える。translate/scale/rotate は禁止し、フェードのみ残すのは WCAG 慣習に従う。
 */
export function useRecollyMotion() {
  const shouldReduce = useReducedMotion()

  if (shouldReduce) {
    return {
      listContainer: {
        hidden: {},
        visible: { transition: { staggerChildren: 0 } },
      },
      fadeInUp: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
      },
      modal: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      },
      overlay: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      },
      dropdown: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      },
      toast: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      },
      banner: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      },
    }
  }

  return {
    listContainer: listContainerVariants,
    fadeInUp: fadeInUpVariants,
    modal: modalVariants,
    overlay: overlayVariants,
    dropdown: dropdownVariants,
    toast: toastVariants,
    banner: bannerVariants,
  }
}
