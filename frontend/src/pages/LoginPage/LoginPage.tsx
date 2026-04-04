import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import { ApiError } from '../../lib/api'
import { Typography } from '../../components/ui/Typography/Typography'
import { Button } from '../../components/ui/Button/Button'
import { Divider } from '../../components/ui/Divider/Divider'
import { OAuthButtons } from '../../components/OAuthButtons/OAuthButtons'
import { FormInput } from '../../components/ui/FormInput/FormInput'
import styles from '../../styles/authForm.module.css'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // OAuthエラー時のメッセージを表示
  useEffect(() => {
    const state = location.state as { error?: string } | null
    if (state?.error) {
      setError(state.error)
      // stateをクリアしてリロード時に再表示されないようにする
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('ログインに失敗しました')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Typography variant="h2">ログイン</Typography>
        <Divider />
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
          <FormInput
            label="パスワード"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className={styles.error}>{error}</p>}
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'ログイン中...' : 'ログイン'}
          </Button>
        </form>
        <OAuthButtons />
        <div className={styles.link}>
          <Link to="/signup">アカウントを作成</Link>
        </div>
      </div>
    </div>
  )
}
