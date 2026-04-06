import { Link, useLocation } from 'react-router-dom'
import type { User } from '../../../lib/types'
import { UserMenu } from '../UserMenu/UserMenu'
import styles from './NavBar.module.css'

type NavItem = {
  label: string
  path: string | null
}

const NAV_ITEMS: NavItem[] = [
  { label: 'ホーム', path: '/dashboard' },
  { label: '検索', path: '/search' },
  { label: 'ライブラリ', path: '/library' },
  { label: 'コミュニティ', path: '/community' },
  { label: 'おすすめ', path: '/recommendations' },
]

type NavBarProps = {
  user: User
  onLogout: () => void
}

export function NavBar({ user, onLogout }: NavBarProps) {
  const { pathname } = useLocation()

  // コミュニティは /discussions/* のサブパスでもアクティブ表示にする
  const isActive = (path: string) => {
    if (path === '/community') {
      return pathname === '/community' || pathname.startsWith('/discussions/')
    }
    return pathname === path
  }

  return (
    <nav className={styles.nav}>
      <Link to="/dashboard" className={styles.logo}>
        Recolly
      </Link>
      <div className={styles.right}>
        <div className={styles.links}>
          {NAV_ITEMS.map((item) =>
            item.path ? (
              <Link
                key={item.label}
                to={item.path}
                className={isActive(item.path) ? styles.active : styles.link}
              >
                {item.label}
              </Link>
            ) : (
              <span key={item.label} className={styles.disabled}>
                {item.label}
              </span>
            ),
          )}
        </div>
        <div className={styles.menuSeparator} />
        <UserMenu user={user} onLogout={onLogout} />
      </div>
    </nav>
  )
}
