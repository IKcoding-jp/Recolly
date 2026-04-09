import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../contexts/useAuth'
import { accountApi, ApiError } from '../../lib/api'

// ログイン方法の総数（パスワード + OAuth連携数）
function countLoginMethods(hasPassword: boolean, providers: string[]): number {
  return (hasPassword ? 1 : 0) + providers.length
}

export function useAccountSettings() {
  const { user, setUser } = useAuth()
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null)
  const [providerError, setProviderError] = useState('')

  const totalMethods = user ? countLoginMethods(user.has_password, user.providers) : 0

  // プロバイダーが解除可能かどうか
  const canUnlink = totalMethods > 1

  const handleUnlinkProvider = async (provider: string) => {
    setProviderError('')
    setUnlinkingProvider(provider)

    try {
      const response = await accountApi.unlinkProvider(provider)
      setUser(response.user)
    } catch (err) {
      if (err instanceof ApiError) {
        setProviderError(err.message)
      } else {
        setProviderError('連携解除に失敗しました')
      }
    } finally {
      setUnlinkingProvider(null)
    }
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (password !== passwordConfirmation) {
      setPasswordError('パスワードが一致しません')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await accountApi.setPassword(password, passwordConfirmation)
      setUser(response.user)
      setPassword('')
      setPasswordConfirmation('')
      setPasswordSuccess(
        user?.has_password ? 'パスワードを変更しました' : 'パスワードを設定しました',
      )
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordError(err.message)
      } else {
        setPasswordError('パスワードの設定に失敗しました')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    user,
    setUser,
    password,
    setPassword,
    passwordConfirmation,
    setPasswordConfirmation,
    passwordError,
    passwordSuccess,
    isSubmitting,
    unlinkingProvider,
    providerError,
    setProviderError,
    canUnlink,
    handleUnlinkProvider,
    handlePasswordSubmit,
  }
}
