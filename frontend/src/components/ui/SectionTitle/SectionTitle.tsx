import type { ReactNode } from 'react'
import styles from './SectionTitle.module.css'

type SectionTitleProps = {
  className?: string
  children: ReactNode
}

export function SectionTitle({ className, children }: SectionTitleProps) {
  const combinedClassName = className ? `${styles.sectionTitle} ${className}` : styles.sectionTitle

  return <h2 className={combinedClassName}>{children}</h2>
}
