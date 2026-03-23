import { useEffect, useState } from 'react'
import { csrfApi } from '../../lib/api'
import styles from './OAuthButtons.module.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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

      <form method="post" action={`${API_BASE}/api/v1/auth/google_oauth2`}>
        <input type="hidden" name="authenticity_token" value={csrfToken} />
        <button type="submit" className={styles.oauthButton} disabled={!csrfToken}>
          <span className={styles.googleIcon}>G</span>
          Googleでログイン
        </button>
      </form>

      <form method="post" action={`${API_BASE}/api/v1/auth/twitter2`}>
        <input type="hidden" name="authenticity_token" value={csrfToken} />
        <button
          type="submit"
          className={`${styles.oauthButton} ${styles.xButton}`}
          disabled={!csrfToken}
        >
          <span className={styles.xIcon}>{'\u{1D54F}'}</span>
          Xでログイン
        </button>
      </form>
    </div>
  )
}
