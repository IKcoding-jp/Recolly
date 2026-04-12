import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useRecollyMotion } from '../../../lib/motion'
import styles from './DropdownMenu.module.css'

type MenuItem = {
  label: string
  onClick: () => void
  danger?: boolean
}

type Props = {
  items: MenuItem[]
}

export function DropdownMenu({ items }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const m = useRecollyMotion()
  const ref = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  return (
    <div className={styles.container} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((p) => !p)}
        aria-label="メニューを開く"
      >
        ⋯
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.menu}
            variants={m.dropdown}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                className={item.danger ? styles.dangerItem : styles.menuItem}
                onClick={() => {
                  item.onClick()
                  setIsOpen(false)
                }}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
