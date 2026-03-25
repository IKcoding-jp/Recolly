import styles from './RewatchControl.module.css'

type RewatchControlProps = {
  count: number
  onChange: (count: number) => void
}

export function RewatchControl({ count, onChange }: RewatchControlProps) {
  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(count - 1)}
        disabled={count <= 0}
        aria-label="-"
      >
        -
      </button>
      <span className={styles.display}>{count}回</span>
      <button
        type="button"
        className={`${styles.button} ${styles.increment}`}
        onClick={() => onChange(count + 1)}
        aria-label="+"
      >
        +
      </button>
    </div>
  )
}
