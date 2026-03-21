import type { ReactNode, ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = {
  variant: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>

export function Button({
  variant,
  size = 'md',
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [styles[variant], styles[size], className].filter(Boolean).join(' ')

  return (
    <button className={classes} type={type} {...rest}>
      {children}
    </button>
  )
}
