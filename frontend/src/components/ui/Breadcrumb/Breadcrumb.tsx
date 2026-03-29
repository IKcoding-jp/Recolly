import { Link } from 'react-router-dom'
import styles from './Breadcrumb.module.css'

type BreadcrumbItem = {
  label: string
  path?: string
}

type Props = {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: Props) {
  return (
    <nav className={styles.breadcrumb} aria-label="パンくずリスト">
      {items.map((item, i) => (
        <span key={i} className={styles.item}>
          {i > 0 && (
            <span className={styles.separator} aria-hidden="true">
              &rsaquo;
            </span>
          )}
          {item.path ? (
            <Link to={item.path} className={styles.link}>
              {item.label}
            </Link>
          ) : (
            <span className={styles.current}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
