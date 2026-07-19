import styles from './RecommendationsPage.module.css'

const TABS = [
  { id: 'overall', label: '全体' },
  { id: 'anime', label: 'アニメ' },
  { id: 'movie', label: '映画' },
  { id: 'drama', label: 'ドラマ' },
  { id: 'book', label: '本' },
  { id: 'manga', label: '漫画・ラノベ' },
  { id: 'game', label: 'ゲーム' },
] as const

export type TabId = (typeof TABS)[number]['id']

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type Props = {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export function MediaTabBar({ activeTab, onTabChange }: Props) {
  const getActiveClass = (tabId: string) => {
    if (tabId !== activeTab) return ''
    if (tabId === 'overall') return styles.tabActiveOverall
    return (
      (styles[`tabActive${capitalize(tabId)}` as keyof typeof styles] as string) ?? styles.tabActive
    )
  }

  return (
    <div className={styles.tabBar} role="tablist">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          aria-selected={activeTab === id}
          className={`${styles.tab} ${getActiveClass(id)}`}
          onClick={() => onTabChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
