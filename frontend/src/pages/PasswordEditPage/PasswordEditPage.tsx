import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, authApi } from '../../lib/api'
import { Typography } from '../../components/ui/Typography/Typography'
import { Button } from '../../components/ui/Button/Button'
import { Divider } from '../../components/ui/Divider/Divider'
import { FormInput } from '../../components/ui/FormInput/FormInput'
import styles from '../../styles/authForm.module.css'

const MIN_PASSWORD_LENGTH = 6

export function PasswordEditPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('reset_password_token')
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [tokenInvalid, setTokenInvalid] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // トークンなしでアクセスされた場合は /password/new にリダイレクト
  if (!token) {
    return <Navigate to="/password/new" replace />
  }

  const isValid = password.length >= MIN_PASSWORD_LENGTH && password === passwordConfirmation

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setTokenInvalid(false)
    setIsSubmitting(true)

    try {
      await authApi.updatePassword(token, password, passwordConfirmation)
      navigate('/login', {
        state: {
          message: 'パスワードを更新しました。新しいパスワードでログインしてください。',
        },
      })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'password_reset_failed') {
        setTokenInvalid(true)
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('パスワードの更新に失敗しました')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Typography variant="h2">新しいパスワードを設定</Typography>
        <Divider />
        <form className={styles.form} onSubmit={handleSubmit}>
          <FormInput
            label="新しいパスワード"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
          <FormInput
            label="新しいパスワード（確認）"
            id="passwordConfirmation"
            type="password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
          {tokenInvalid && (
            <div className={styles.warningBanner}>
              <p>リンクが無効または期限切れです。再度リセットを申請してください。</p>
              <p>
                <Link to="/password/new">パスワードリセットを再申請</Link>
              </p>
            </div>
          )}
          {error && <p className={styles.error}>{error}</p>}
          <Button variant="primary" type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? '更新中...' : 'パスワードを更新'}
          </Button>
        </form>
      </div>
    </div>
  )
}
