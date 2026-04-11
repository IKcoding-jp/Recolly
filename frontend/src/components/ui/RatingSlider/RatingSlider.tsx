import type { MediaType } from '../../../lib/types'
import styles from './RatingSlider.module.css'

/** ジャンル別カラーをCSS変数名にマッピング */
const GENRE_COLOR_VAR: Record<MediaType, string> = {
  anime: 'var(--color-anime)',
  movie: 'var(--color-movie)',
  drama: 'var(--color-drama)',
  book: 'var(--color-book)',
  manga: 'var(--color-manga)',
  game: 'var(--color-game)',
}

/** 1, 5, 10 は強調目盛り */
const MAJOR_TICKS = [1, 5, 10]

type RatingSliderProps = {
  value: number
  onChange: (value: number) => void
  mediaType?: MediaType
}

export function RatingSlider({ value, onChange, mediaType }: RatingSliderProps) {
  const genreColor = mediaType ? GENRE_COLOR_VAR[mediaType] : 'var(--color-text)'
  const percentage = (value / 10) * 100
  const sliderBackground = `linear-gradient(to right, ${genreColor} ${String(percentage)}%, var(--color-border-light) ${String(percentage)}%)`

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>評価</span>
        <div className={styles.scoreBlock}>
          <span className={styles.score} style={{ color: genreColor }}>
            {value === 0 ? '-' : value}
          </span>
          <span className={styles.maxLabel}>/10</span>
        </div>
      </div>
      <div className={styles.sliderWrap}>
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={value}
          onChange={handleChange}
          className={styles.slider}
          style={
            {
              background: sliderBackground,
              '--genre-color': genreColor,
            } as React.CSSProperties
          }
        />
        <div className={styles.ticks}>
          {/* スライダーのmin=0に対応する見えないスペーサー（0の位置） */}
          <div className={styles.tickSpacer} />
          {Array.from({ length: 10 }, (_, i) => i + 1).map((tick) => (
            <div key={tick} className={styles.tick}>
              <div
                className={`${styles.tickMark} ${MAJOR_TICKS.includes(tick) ? styles.tickMajor : ''}`}
              />
              <span className={styles.tickLabel}>{tick}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
