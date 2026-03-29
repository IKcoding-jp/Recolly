import styles from './RatingInput.module.css'

type RatingInputProps = {
  value: number | null
  onChange: (rating: number | null) => void
}

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export function RatingInput({ value, onChange }: RatingInputProps) {
  const handleClick = (rating: number) => {
    onChange(rating === value ? null : rating)
  }

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        {RATINGS.map((rating) => (
          <button
            key={rating}
            type="button"
            className={`${styles.button} ${value !== null && rating <= value ? styles.active : ''}`}
            onClick={() => handleClick(rating)}
            aria-label={String(rating)}
          >
            {rating}
          </button>
        ))}
      </div>
    </div>
  )
}
