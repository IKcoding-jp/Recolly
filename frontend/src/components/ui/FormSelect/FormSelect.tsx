import type { SelectHTMLAttributes } from 'react'
import styles from './FormSelect.module.css'

type SelectOption = {
  value: string
  label: string
}

type FormSelectProps = {
  label?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: SelectOption[]
  error?: string
  className?: string
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'value' | 'onChange'>

export function FormSelect({
  label,
  value,
  onChange,
  options,
  error,
  className,
  id,
  ...rest
}: FormSelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const selectClasses = [styles.select, error ? styles.selectError : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={selectId} className={styles.label}>
          {label}
        </label>
      )}
      <select id={selectId} className={selectClasses} value={value} onChange={onChange} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
