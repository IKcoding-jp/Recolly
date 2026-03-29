import { Link, useLocation } from 'react-router-dom'
import styles from './BottomTabBar.module.css'

type TabItem = {
  label: string
  path: string
  iconKey: 'home' | 'search' | 'library' | 'community' | 'settings'
}

const TAB_ITEMS: TabItem[] = [
  { label: 'ホーム', path: '/dashboard', iconKey: 'home' },
  { label: '検索', path: '/search', iconKey: 'search' },
  { label: 'ライブラリ', path: '/library', iconKey: 'library' },
  { label: 'コミュニティ', path: '/community', iconKey: 'community' },
  { label: '設定', path: '/settings', iconKey: 'settings' },
]

/* Recollyのクリーン・白黒デザインに合わせたモノクロSVGアイコン */
function TabIcon({ iconKey, active }: { iconKey: TabItem['iconKey']; active: boolean }) {
  const stroke = active ? 'var(--color-text)' : 'var(--color-text-muted)'
  const strokeWidth = active ? '2' : '1.5'
  const props = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  switch (iconKey) {
    case 'home':
      return (
        <svg {...props}>
          <path d="M3 12l9-8 9 8" />
          <path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
        </svg>
      )
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      )
    case 'library':
      return (
        <svg {...props}>
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </svg>
      )
    case 'community':
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z" />
        </svg>
      )
  }
}

export function BottomTabBar() {
  const { pathname } = useLocation()

  // startsWithで判定し、/settings/account等のサブパスでも親タブをアクティブにする。
  // コミュニティは /discussions/* のサブパスでもアクティブ表示にする。
  // どのタブにもマッチしないパス（例: /works/:id）では全タブ非アクティブになる。
  const isActive = (tabPath: string) => {
    if (tabPath === '/community') {
      return pathname === '/community' || pathname.startsWith('/discussions/')
    }
    return pathname === tabPath || pathname.startsWith(tabPath + '/')
  }

  return (
    <nav className={styles.tabBar}>
      {TAB_ITEMS.map((tab) => {
        const active = isActive(tab.path)
        return (
          <Link key={tab.path} to={tab.path} className={active ? styles.active : styles.tab}>
            <TabIcon iconKey={tab.iconKey} active={active} />
            <span className={styles.label}>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
