import { Link, useLocation } from 'react-router-dom'
import styles from './BottomTabBar.module.css'

type TabItem = {
  label: string
  path: string
  icon: string
}

const TAB_ITEMS: TabItem[] = [
  { label: 'ホーム', path: '/dashboard', icon: '🏠' },
  { label: '検索', path: '/search', icon: '🔍' },
  { label: 'ライブラリ', path: '/library', icon: '📚' },
  { label: '設定', path: '/settings', icon: '⚙️' },
]

export function BottomTabBar() {
  const { pathname } = useLocation()

  // startsWithで判定し、/settings/account等のサブパスでも親タブをアクティブにする。
  // どのタブにもマッチしないパス（例: /works/:id）では全タブ非アクティブになる。
  const isActive = (tabPath: string) => pathname === tabPath || pathname.startsWith(tabPath + '/')

  return (
    <nav className={styles.tabBar}>
      {TAB_ITEMS.map((tab) => (
        <Link
          key={tab.path}
          to={tab.path}
          className={isActive(tab.path) ? styles.active : styles.tab}
        >
          <span className={styles.icon}>{tab.icon}</span>
          <span className={styles.label}>{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}
