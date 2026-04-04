import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import { oauthApi, ApiError } from '../../lib/api'
import { Typography } from '../../components/ui/Typography/Typography'
import { Button } from '../../components/ui/Button/Button'
import { Divider } from '../../components/ui/Divider/Divider'
import { FormInput } from '../../components/ui/FormInput/FormInput'
import styles from '../../styles/authForm.module.css'

export function OauthUsernamePage() {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { setUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await oauthApi.completeRegistration(username)
      setUser(response.user)

      if (response.user.email_missing) {
        navigate('/auth/email-setup', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
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
        <Typography variant="h2">ユーザー名を設定</Typography>
        <Divider />
        <form className={styles.form} onSubmit={handleSubmit}>
          <FormInput
            label="ユーザー名"
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={2}
            maxLength={30}
            autoComplete="username"
          />
          {error && <p className={styles.error}>{error}</p>}
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '登録中...' : '登録する'}
          </Button>
        </form>
      </div>
    </div>
  )
}
