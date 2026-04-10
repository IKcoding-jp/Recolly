import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, authApi } from '../../lib/api'
import { Typography } from '../../components/ui/Typography/Typography'
import { Button } from '../../components/ui/Button/Button'
import { Divider } from '../../components/ui/Divider/Divider'
import { FormInput } from '../../components/ui/FormInput/FormInput'
import styles from '../../styles/authForm.module.css'

export function PasswordNewPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await authApi.resetPassword(email)
      setSubmitted(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('送信に失敗しました')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Typography variant="h2">パスワードをリセット</Typography>
        <Divider />
        {submitted ? (
          <p className={styles.success}>
            パスワードリセットの手順をメールをお送りしました。
            <br />
            メールをご確認ください。
          </p>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <FormInput
              label="メールアドレス"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            {error && <p className={styles.error}>{error}</p>}
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? '送信中...' : 'リセットメールを送信'}
            </Button>
          </form>
        )}
        <div className={styles.link}>
          <Link to="/login">ログインに戻る</Link>
        </div>
      </div>
    </div>
  )
}
