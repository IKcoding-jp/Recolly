import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, googleAuthApi } from '../../lib/api'
import { useAuth } from '../../contexts/useAuth'
import { ActionErrorCard } from '../ui/ActionErrorCard/ActionErrorCard'
import type { User } from '../../lib/types'
import type { GoogleCredentialResponse } from '../../types/google-gsi'
import styles from './OAuthButtons.module.css'

// Google Identity Services SDKが読み込まれるまでのポーリング間隔
const GIS_POLL_INTERVAL_MS = 100
// SDKが読み込まれない場合のタイムアウト（10秒）
const GIS_POLL_TIMEOUT_MS = 10000

type OAuthButtonsProps = {
  // 'sign_in': 未ログイン状態でログイン or 新規登録（デフォルト）
  // 'link': ログイン済みユーザーがGoogleアカウントを連携追加
  mode?: 'sign_in' | 'link'
  onLinkSuccess?: (user: User) => void
  onLinkError?: (message: string) => void
  // エラー時にメールログインフォームへスクロールするコールバック
  onScrollToEmailForm?: () => void
}

// Google Identity Services (ADR-0035) を使ったOAuthボタン。
//
// 旧OmniAuth方式（フォームPOSTでサーバーサイドリダイレクト）と違い、
// ブラウザ内でGoogle公式SDKを使ってID Tokenを取得し、それをRailsに送信する。
// これによりPWAスタンドアロンモードでもログインが完結する（外部ブラウザ遷移なし）。
export function OAuthButtons({
  mode = 'sign_in',
  onLinkSuccess,
  onLinkError,
  onScrollToEmailForm,
}: OAuthButtonsProps = {}) {
  const buttonContainerRef = useRef<HTMLDivElement>(null)
  const [isSdkReady, setIsSdkReady] = useState(false)
  const [error, setError] = useState<{ message: string; code?: string } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const { setUser } = useAuth()
  const navigate = useNavigate()

  // Google Identity Services SDKの読み込み完了を待つ。
  // index.htmlでasync/deferで読み込むため、ここでは`window.google`が
  // 利用可能になるまでポーリングで確認する
  useEffect(() => {
    if (window.google?.accounts?.id) {
      setIsSdkReady(true)
      return
    }

    let elapsed = 0
    const intervalId = setInterval(() => {
      elapsed += GIS_POLL_INTERVAL_MS
      if (window.google?.accounts?.id) {
        setIsSdkReady(true)
        clearInterval(intervalId)
      } else if (elapsed >= GIS_POLL_TIMEOUT_MS) {
        setError({
          message: 'Googleログインの読み込みに失敗しました。ページを再読み込みしてください',
        })
        clearInterval(intervalId)
      }
    }, GIS_POLL_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [])

  // SDK準備完了後、Googleボタンを描画
  useEffect(() => {
    if (!isSdkReady || !buttonContainerRef.current) return

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
    if (!clientId) {
      setError({ message: 'Googleログインが設定されていません（VITE_GOOGLE_CLIENT_ID 未定義）' })
      return
    }

    window.google?.accounts.id.initialize({
      client_id: clientId,
      callback: (response: GoogleCredentialResponse) => {
        void handleCredentialResponse(response.credential)
      },
    })

    // GISボタンはflex対応していないため、親コンテナの幅を測ってpx指定する
    // authForm.module.cssのcardがmax-width:400px, padding:32pxなので
    // フォーム内の実質幅は336px。それに合わせてボタン幅をフォーム他要素と揃える
    const containerWidth = buttonContainerRef.current.clientWidth
    // GISはwidthの上限を400pxに制限している
    const buttonWidth = Math.min(Math.max(containerWidth, 200), 400)

    window.google?.accounts.id.renderButton(buttonContainerRef.current, {
      theme: 'outline',
      size: 'large',
      text: mode === 'link' ? 'continue_with' : 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: buttonWidth,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSdkReady, mode])

  const handleCredentialResponse = async (credential: string) => {
    setError(null)
    setIsProcessing(true)
    try {
      if (mode === 'link') {
        const data = await googleAuthApi.linkProvider(credential)
        onLinkSuccess?.(data.user)
      } else {
        await handleSignIn(credential)
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (mode === 'link') {
          onLinkError?.(err.message)
        } else {
          setError({ message: err.message, code: err.code })
        }
      } else {
        if (mode === 'link') {
          onLinkError?.('ログインに失敗しました')
        } else {
          setError({ message: 'ログインに失敗しました' })
        }
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSignIn = async (credential: string) => {
    const data = await googleAuthApi.signIn(credential)
    switch (data.status) {
      case 'success':
        setUser(data.user)
        navigate('/dashboard', { replace: true })
        break
      case 'new_user':
        navigate('/auth/complete', { replace: true })
        break
      case 'error':
        setError({ message: data.message, code: data.code })
        break
    }
  }

  return (
    <div className={`${styles.container} ${mode === 'link' ? styles.containerLink : ''}`}>
      {mode === 'sign_in' && (
        <div className={styles.divider}>
          <span className={styles.dividerText}>または</span>
        </div>
      )}
      <div
        ref={buttonContainerRef}
        className={styles.buttonContainer}
        aria-label={mode === 'link' ? 'Google連携ボタン' : 'Googleでログインボタン'}
      />
      {!isSdkReady && !error && <div className={styles.loading}>Googleログインを読み込み中...</div>}
      {isProcessing && <div className={styles.loading}>処理中...</div>}
      {error && error.code === 'email_already_registered' && (
        <ActionErrorCard
          title="ログイン方法が異なります"
          message={error.message}
          actionLabel="メールでログイン"
          onAction={onScrollToEmailForm}
        />
      )}
      {error && error.code === 'email_registered_with_other_provider' && (
        <ActionErrorCard title="別のアカウントで登録済みです" message={error.message} />
      )}
      {error &&
        error.code !== 'email_already_registered' &&
        error.code !== 'email_registered_with_other_provider' && (
          <p className={styles.error}>{error.message}</p>
        )}
    </div>
  )
}
