import type { TextareaHTMLAttributes } from 'react'
import styles from './FormTextarea.module.css'

type FormTextareaProps = {
  label?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  rows?: number
  error?: string
  className?: string
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'value' | 'onChange' | 'rows'>

export function FormTextarea({
  label,
  value,
  onChange,
  rows = 4,
  error,
  className,
  id,
  ...rest
}: FormTextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const textareaClasses = [styles.textarea, error ? styles.textareaError : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={textareaId} className={styles.label}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={textareaClasses}
        value={value}
        onChange={onChange}
        rows={rows}
        {...rest}
      />
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
