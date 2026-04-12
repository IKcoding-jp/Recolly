import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import { ApiError } from '../../lib/api'
import { Typography } from '../../components/ui/Typography/Typography'
import { Button } from '../../components/ui/Button/Button'
import { Divider } from '../../components/ui/Divider/Divider'
import { OAuthButtons } from '../../components/OAuthButtons/OAuthButtons'
import { FormInput } from '../../components/ui/FormInput/FormInput'
import { captureEvent } from '../../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'
import styles from '../../styles/authForm.module.css'

export function SignUpPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== passwordConfirmation) {
      setError('パスワードが一致しません')
      return
    }

    setIsSubmitting(true)

    try {
      await signup(username, email, password, passwordConfirmation)
      // 登録完了イベント発火（method: email）
      // ジャンル横断率や signup → 記録ファネル分析の基点になる
      captureEvent(ANALYTICS_EVENTS.SIGNUP_COMPLETED, { method: 'email' })
      navigate('/dashboard')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('登録に失敗しました')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Typography variant="h2">アカウント作成</Typography>
        <Divider />
        <form className={styles.form} onSubmit={handleSubmit}>
          <FormInput
            label="ユーザー名"
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
          <FormInput
            label="メールアドレス"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <FormInput
            label="パスワード"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <FormInput
            label="パスワード（確認）"
            id="passwordConfirmation"
            type="password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          {error && <p className={styles.error}>{error}</p>}
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '登録中...' : 'アカウントを作成'}
          </Button>
        </form>
        <OAuthButtons />
        <div className={styles.link}>
          <Link to="/login">ログインはこちら</Link>
        </div>
      </div>
    </div>
  )
}
