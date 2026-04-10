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
  const [successMessage, setSuccessMessage] = useState('')
  const [isUnauthorized, setIsUnauthorized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // location.state から OAuth エラーや成功メッセージを受け取る
  useEffect(() => {
    const state = location.state as { error?: string; message?: string } | null
    if (state?.error) {
      setError(state.error)
    }
    if (state?.message) {
      setSuccessMessage(state.message)
    }
    // リロード時に再表示されないよう state をクリア
    if (state) {
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsUnauthorized(false)
    setSuccessMessage('')
    setIsSubmitting(true)

    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        // 401 のときだけ警告バナーを表示
        if (err.status === 401) {
          setIsUnauthorized(true)
        }
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
        {successMessage && <p className={styles.success}>{successMessage}</p>}
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
          {isUnauthorized && (
            <div className={styles.hintCards}>
              <Link to="/password/new" className={styles.hintCard}>
                <span className={styles.hintIcon}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 7a2 2 0 0 1 2 2m4 0a6 6 0 0 1-7.74 5.74L11 17H9v2H7v2H4a1 1 0 0 1-1-1v-2.59a1 1 0 0 1 .29-.7l6.97-6.97A6 6 0 0 1 21 9z" />
                  </svg>
                </span>
                <span className={styles.hintText}>
                  <span className={styles.hintTitle}>パスワードを再設定する</span>
                  <span className={styles.hintDesc}>メールでリセットリンクを送ります</span>
                </span>
                <span className={styles.hintArrow}>›</span>
              </Link>
              <div className={styles.hintCard}>
                <span className={styles.hintIcon}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </span>
                <span className={styles.hintText}>
                  <span className={styles.hintTitle}>Google でログインしてみる</span>
                  <span className={styles.hintDesc}>
                    Google で登録していれば下のボタンからどうぞ
                  </span>
                </span>
              </div>
            </div>
          )}
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'ログイン中...' : 'ログイン'}
          </Button>
        </form>
        <OAuthButtons />
        <div className={styles.link}>
          <Link to="/password/new">パスワードをお忘れですか？</Link>
        </div>
        <div className={styles.link}>
          <Link to="/signup">アカウントを作成</Link>
        </div>
      </div>
    </div>
  )
}
