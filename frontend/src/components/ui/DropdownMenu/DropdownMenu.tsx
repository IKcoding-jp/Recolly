import { useCallback, useEffect, useRef, useState } from 'react'
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
      {isOpen && (
        <div className={styles.menu}>
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
        </div>
      )}
    </div>
  )
}
