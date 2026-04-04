import styles from './RatingSlider.module.css'

type RatingSliderProps = {
  value: number
  onChange: (value: number) => void
}

export function RatingSlider({ value, onChange }: RatingSliderProps) {
  const percentage = (value / 10) * 100
  const sliderBackground = `linear-gradient(to right, var(--color-text) ${percentage}%, var(--color-border-light) ${percentage}%)`

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }

  return (
    <div className={styles.container}>
      <div className={styles.sliderWrap}>
        <input
          type="range"
          min="0"
          max="10"
          value={value}
          onChange={handleChange}
          className={styles.slider}
          style={{ background: sliderBackground }}
        />
        <div className={styles.labels}>
          <span>1</span>
          <span>5</span>
          <span>10</span>
        </div>
      </div>
      <div className={styles.scoreBlock}>
        <span className={styles.score}>{value === 0 ? '-' : value}</span>
        <span className={styles.maxLabel}>/ 10</span>
      </div>
    </div>
  )
}
