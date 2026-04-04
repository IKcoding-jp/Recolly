import type { InputHTMLAttributes } from 'react'
import styles from './FormInput.module.css'

type FormInputProps = {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  error?: string
  className?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'value' | 'onChange'>

export function FormInput({
  label,
  value,
  onChange,
  error,
  className,
  id,
  ...rest
}: FormInputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  const inputClasses = [styles.input, error ? styles.inputError : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input id={inputId} className={inputClasses} value={value} onChange={onChange} {...rest} />
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
