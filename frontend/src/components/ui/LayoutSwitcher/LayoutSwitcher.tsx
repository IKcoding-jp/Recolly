// frontend/src/components/ui/LayoutSwitcher/LayoutSwitcher.tsx
import type { LayoutType } from '../../../hooks/useLayoutPreference'
import styles from './LayoutSwitcher.module.css'

type LayoutSwitcherProps = {
  currentLayout: LayoutType
  totalCount: number
  onLayoutChange: (layout: LayoutType) => void
}

const LAYOUT_OPTIONS: { type: LayoutType; label: string; icon: React.ReactNode }[] = [
  {
    type: 'list',
    label: 'リスト表示',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <line x1="1" y1="4" x2="17" y2="4" />
        <line x1="1" y1="9" x2="17" y2="9" />
        <line x1="1" y1="14" x2="17" y2="14" />
      </svg>
    ),
  },
  {
    type: 'card',
    label: 'カード表示',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="1" y="1" width="6" height="7" rx="1" />
        <rect x="11" y="1" width="6" height="7" rx="1" />
        <rect x="1" y="10" width="6" height="7" rx="1" />
        <rect x="11" y="10" width="6" height="7" rx="1" />
      </svg>
    ),
  },
  {
    type: 'compact',
    label: 'コンパクト表示',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <line x1="1" y1="3" x2="17" y2="3" />
        <line x1="1" y1="6.5" x2="17" y2="6.5" />
        <line x1="1" y1="10" x2="17" y2="10" />
        <line x1="1" y1="13.5" x2="17" y2="13.5" />
      </svg>
    ),
  },
]

export function LayoutSwitcher({ currentLayout, totalCount, onLayoutChange }: LayoutSwitcherProps) {
  return (
    <div className={styles.toolbar}>
      <span className={styles.count}>{totalCount}件の作品</span>
      <div className={styles.buttons}>
        {LAYOUT_OPTIONS.map(({ type, label, icon }) => (
          <button
            key={type}
            type="button"
            className={`${styles.button} ${currentLayout === type ? styles.active : ''}`}
            aria-label={label}
            aria-pressed={currentLayout === type}
            onClick={() => onLayoutChange(type)}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  )
}
