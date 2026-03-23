import { useEffect, useState } from 'react'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { Button } from '../../components/ui/Button/Button'
import { csrfApi } from '../../lib/api'
import { useAccountSettings } from './useAccountSettings'
import styles from './AccountSettingsPage.module.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// プロバイダーの表示名マッピング
const PROVIDER_DISPLAY: Record<string, { name: string; icon: string }> = {
  google_oauth2: { name: 'Google', icon: 'G' },
  twitter2: { name: 'X', icon: '\u{1D54F}' },
}

const ALL_PROVIDERS = ['google_oauth2', 'twitter2'] as const

export function AccountSettingsPage() {
  const [csrfToken, setCsrfToken] = useState('')
  const {
    user,
    password,
    setPassword,
    passwordConfirmation,
    setPasswordConfirmation,
    passwordError,
    passwordSuccess,
    isSubmitting,
    unlinkingProvider,
    providerError,
    canUnlink,
    handleUnlinkProvider,
    handlePasswordSubmit,
  } = useAccountSettings()

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const data = await csrfApi.getToken()
        setCsrfToken(data.token)
      } catch {
        // CSRFトークン取得失敗時はOAuth連携ボタンを無効化
      }
    }
    void fetchToken()
  }, [])

  if (!user) return null

  return (
    <div className={styles.page}>
      <SectionTitle>アカウント設定</SectionTitle>

      {/* ログイン方法セクション */}
      <div className={styles.section}>
        <SectionTitle>ログイン方法</SectionTitle>
        {providerError && <p className={styles.error}>{providerError}</p>}
        <div className={styles.providerList}>
          {/* メール+パスワード */}
          <div className={styles.providerRow}>
            <div className={styles.providerInfo}>
              <span className={styles.providerName}>メール+パスワード</span>
            </div>
            <span className={styles.connectedLabel}>
              {user.has_password ? '設定済み' : '未設定'}
            </span>
          </div>

          {/* OAuthプロバイダー */}
          {ALL_PROVIDERS.map((provider) => {
            const display = PROVIDER_DISPLAY[provider]
            const isConnected = user.providers.includes(provider)
            const isUnlinking = unlinkingProvider === provider

            return (
              <div key={provider} className={styles.providerRow}>
                <div className={styles.providerInfo}>
                  <span className={styles.providerIcon}>{display.icon}</span>
                  <span className={styles.providerName}>{display.name}</span>
                </div>
                {isConnected ? (
                  <div className={styles.providerInfo}>
                    <span className={styles.connectedLabel}>連携済み</span>
                    {canUnlink ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isUnlinking}
                        onClick={() => void handleUnlinkProvider(provider)}
                      >
                        {isUnlinking ? '解除中...' : '解除'}
                      </Button>
                    ) : (
                      <span className={styles.disabledReason}>
                        最後のログイン方法のため解除できません
                      </span>
                    )}
                  </div>
                ) : (
                  <form method="post" action={`${API_BASE}/api/v1/auth/${provider}`}>
                    <input type="hidden" name="authenticity_token" value={csrfToken} />
                    <button type="submit" className={styles.connectButton} disabled={!csrfToken}>
                      連携する
                    </button>
                  </form>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* パスワード設定セクション */}
      <div className={styles.section}>
        <SectionTitle>{user.has_password ? 'パスワードを変更' : 'パスワードを設定'}</SectionTitle>
        <form className={styles.form} onSubmit={handlePasswordSubmit}>
          <div className={styles.field}>
            <label htmlFor="password">
              {user.has_password ? '新しいパスワード' : 'パスワード'}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="passwordConfirmation">パスワード（確認）</label>
            <input
              id="passwordConfirmation"
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          {passwordError && <p className={styles.error}>{passwordError}</p>}
          {passwordSuccess && <p className={styles.success}>{passwordSuccess}</p>}
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '保存中...' : user.has_password ? '変更する' : '設定する'}
          </Button>
        </form>
      </div>
    </div>
  )
}
