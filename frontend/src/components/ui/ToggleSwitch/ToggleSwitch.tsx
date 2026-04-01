import styles from './ToggleSwitch.module.css'

type ToggleSwitchProps = {
  leftLabel: string
  rightLabel: string
  isRight: boolean
  onChange: (isRight: boolean) => void
  disabled?: boolean
}

export function ToggleSwitch({
  leftLabel,
  rightLabel,
  isRight,
  onChange,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <div className={styles.container}>
      <span className={`${styles.label} ${!isRight ? styles.labelActive : ''}`}>{leftLabel}</span>
      <button
        type="button"
        role="switch"
        aria-checked={isRight}
        aria-label={`${leftLabel}と${rightLabel}を切り替え`}
        className={styles.track}
        onClick={() => onChange(!isRight)}
        disabled={disabled}
      >
        <span className={`${styles.thumb} ${isRight ? styles.thumbRight : ''}`} />
      </button>
      <span className={`${styles.label} ${isRight ? styles.labelActive : ''}`}>{rightLabel}</span>
    </div>
  )
}
