import { useEffect, useState } from 'react'
import { csrfApi } from '../../lib/api'
import styles from './OAuthButtons.module.css'

export function OAuthButtons() {
  const [csrfToken, setCsrfToken] = useState('')

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const data = await csrfApi.getToken()
        setCsrfToken(data.token)
      } catch {
        // CSRFトークン取得失敗時はOAuthボタンを無効化
      }
    }
    void fetchToken()
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.divider}>
        <span className={styles.dividerText}>または</span>
      </div>

      <form method="post" action="/api/v1/auth/google_oauth2">
        <input type="hidden" name="authenticity_token" value={csrfToken} />
        <button type="submit" className={styles.oauthButton} disabled={!csrfToken}>
          <span className={styles.googleIcon}>G</span>
          Googleでログイン
        </button>
      </form>
    </div>
  )
}
