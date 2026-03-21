import type { ReactNode, ElementType } from 'react'
import styles from './Typography.module.css'

type Variant = 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'label' | 'meta'

/** バリアントごとのデフォルトHTMLタグ */
const DEFAULT_TAG_MAP: Record<Variant, ElementType> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  body: 'p',
  label: 'span',
  meta: 'span',
}

type TypographyProps = {
  variant: Variant
  /** デフォルトのHTMLタグを上書きする */
  as?: ElementType
  className?: string
  children: ReactNode
}

export function Typography({ variant, as, className, children }: TypographyProps) {
  const Tag = as ?? DEFAULT_TAG_MAP[variant]
  const combinedClassName = className ? `${styles[variant]} ${className}` : styles[variant]

  return <Tag className={combinedClassName}>{children}</Tag>
}
