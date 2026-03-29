import styles from './SearchSkeleton.module.css'

const SKELETON_COUNT = 4

// 各カードのシマー開始タイミングをずらすためのディレイ
const ANIMATION_DELAYS = ['0s', '0.1s', '0.2s', '0.3s']

export function SearchSkeleton() {
  return (
    <div className={styles.container}>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div key={i} className={styles.card} role="status" aria-label="読み込み中">
          <div
            className={styles.coverPlaceholder}
            style={{ animationDelay: ANIMATION_DELAYS[i] }}
          />
          <div className={styles.info}>
            <div
              className={`${styles.line} ${styles.lineGenre}`}
              style={{ animationDelay: ANIMATION_DELAYS[i] }}
            />
            <div
              className={`${styles.line} ${styles.lineTitle}`}
              style={{ animationDelay: ANIMATION_DELAYS[i] }}
            />
            <div
              className={`${styles.line} ${styles.lineDesc}`}
              style={{ animationDelay: ANIMATION_DELAYS[i] }}
            />
            <div
              className={`${styles.line} ${styles.lineDescShort}`}
              style={{ animationDelay: ANIMATION_DELAYS[i] }}
            />
          </div>
          <div
            className={styles.buttonPlaceholder}
            style={{ animationDelay: ANIMATION_DELAYS[i] }}
          />
        </div>
      ))}
    </div>
  )
}
