import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'

const ERROR_MESSAGES: Record<string, string> = {
  email_already_registered:
    'このメールアドレスは既に登録されています。メールアドレスでログインしてください',
  email_registered_with_other_provider: 'このメールアドレスは既に別のプロバイダで登録されています',
  oauth_failed: 'OAuth認証に失敗しました。もう一度お試しください',
  provider_already_linked: 'このプロバイダは既に連携済みです',
}

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()

  useEffect(() => {
    const status = searchParams.get('status')
    const message = searchParams.get('message')

    const handleCallback = async () => {
      switch (status) {
        case 'success':
          await refreshUser()
          navigate('/dashboard', { replace: true })
          break
        case 'provider_linked':
          await refreshUser()
          navigate('/settings', { replace: true, state: { message: 'OAuth連携が完了しました' } })
          break
        case 'new_user':
          navigate('/auth/complete', { replace: true })
          break
        case 'error':
        default: {
          const errorMessage = message ? ERROR_MESSAGES[message] || message : 'エラーが発生しました'
          navigate('/', { replace: true, state: { error: errorMessage } })
          break
        }
      }
    }

    void handleCallback()
  }, [searchParams, navigate, refreshUser])

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <p>認証処理中...</p>
    </div>
  )
}
