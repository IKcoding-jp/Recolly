import styles from './PageLayout.module.css'

interface PageLayoutProps {
  children: React.ReactNode
  className?: string
}

export function PageLayout({ children, className }: PageLayoutProps) {
  const classes = [styles.layout, className].filter(Boolean).join(' ')
  return <div className={classes}>{children}</div>
}
