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
  size?: 'sm' | 'md'
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'value' | 'onChange' | 'size'>

export function FormSelect({
  label,
  value,
  onChange,
  options,
  error,
  className,
  size = 'md',
  id,
  ...rest
}: FormSelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const fieldClasses = [styles.field, size === 'sm' ? styles.fieldSm : ''].filter(Boolean).join(' ')
  const labelClasses = [styles.label, size === 'sm' ? styles.labelSm : ''].filter(Boolean).join(' ')
  const selectClasses = [
    styles.select,
    size === 'sm' ? styles.selectSm : '',
    error ? styles.selectError : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={fieldClasses}>
      {label && (
        <label htmlFor={selectId} className={labelClasses}>
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
