import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '../../../lib/types'
import styles from './UserMenu.module.css'

type UserMenuProps = {
  user: User
  onLogout: () => void
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const initials = user.username.slice(0, 2).toUpperCase()

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={styles.avatar}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="ユーザーメニュー"
      >
        {initials}
      </button>
      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>{user.username}</div>
          <div className={styles.email}>{user.email}</div>
          <div className={styles.divider} />
          <Link to={`/users/${user.id}`} className={styles.item} onClick={() => setIsOpen(false)}>
            プロフィール
          </Link>
          <Link to="/settings" className={styles.item} onClick={() => setIsOpen(false)}>
            設定
          </Link>
          <div className={styles.divider} />
          <button className={styles.item} onClick={onLogout}>
            ログアウト
          </button>
        </div>
      )}
    </div>
  )
}
