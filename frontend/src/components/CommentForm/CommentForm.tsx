import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './CommentForm.module.css'

type Props = {
  /** ログイン済みかどうか */
  isAuthenticated: boolean
  /** この作品をライブラリに記録済みかどうか */
  hasRecord: boolean
  /** 作品ID（記録ページへのリンク用） */
  workId: number
  /** コメント投稿ハンドラ */
  onSubmit: (body: string) => Promise<void>
}

export function CommentForm({ isAuthenticated, hasRecord, workId, onSubmit }: Props) {
  const [body, setBody] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 未ログイン → ログインを促す
  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <p className={styles.message}>
          コメントするには
          <Link to="/login" className={styles.link}>
            ログイン
          </Link>
          してください
        </p>
      </div>
    )
  }

  // ログイン済みだが記録がない → 記録を促す
  if (!hasRecord) {
    return (
      <div className={styles.container}>
        <p className={styles.message}>
          コメントするにはこの作品を
          <Link to={`/works/${String(workId)}`} className={styles.link}>
            ライブラリに記録
          </Link>
          してください
        </p>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!body.trim()) return
    setIsSubmitting(true)
    try {
      await onSubmit(body.trim())
      setBody('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.container}>
      <textarea
        className={styles.textarea}
        placeholder="コメントを入力..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
      />
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.submitButton}
          onClick={() => void handleSubmit()}
          disabled={isSubmitting || !body.trim()}
        >
          {isSubmitting ? '投稿中...' : 'コメントする'}
        </button>
      </div>
    </div>
  )
}
