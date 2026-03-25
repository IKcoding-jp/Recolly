import { useState, useCallback } from 'react'
import { Button } from '../ui/Button/Button'
import styles from './ReviewSection.module.css'

type ReviewSectionProps = {
  reviewText: string | null
  onSave: (text: string) => Promise<void> | void
}

export function ReviewSection({ reviewText, onSave }: ReviewSectionProps) {
  const [text, setText] = useState(reviewText ?? '')
  const [isSaving, setIsSaving] = useState(false)

  // テキストが元の値から変更されたかどうか
  const isDirty = text !== (reviewText ?? '')

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await onSave(text)
    } finally {
      setIsSaving(false)
    }
  }, [text, onSave])

  return (
    <div className={styles.container}>
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="作品の感想を書く..."
        rows={4}
      />
      {isDirty && (
        <div className={styles.actions}>
          <Button variant="primary" size="sm" disabled={isSaving} onClick={() => void handleSave()}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      )}
    </div>
  )
}
