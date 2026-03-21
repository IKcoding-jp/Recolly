import styles from './Divider.module.css'

type DividerProps = {
  className?: string
}

export function Divider({ className }: DividerProps) {
  const combinedClassName = className ? `${styles.divider} ${className}` : styles.divider

  return <hr className={combinedClassName} />
}
