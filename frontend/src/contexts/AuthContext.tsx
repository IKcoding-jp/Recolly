import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi, ApiError } from '../lib/api'
import type { User } from '../lib/types'
import { AuthContext } from './authContextValue'
import { identifyUser, resetAnalytics } from '../lib/analytics/posthog'

export type { AuthContextValue } from './authContextValue'
export { AuthContext } from './authContextValue'

// User.providers から signup_method を導出する。
// Google 連携済みかつパスワード未設定なら 'google' とみなし、それ以外は 'email'。
// (両方に紐付いている場合は email 優先 = 直接メール登録も行ったユーザーとして扱う)
function deriveSignupMethod(user: User): 'email' | 'google' {
  if (!user.has_password && user.providers.includes('google_oauth2')) {
    return 'google'
  }
  return 'email'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // 直前に identify したユーザー ID。同一ユーザーで重複 identify しないための記録
  const lastIdentifiedIdRef = useRef<number | null>(null)

  // 初回ロード時にセッション確認
  useEffect(() => {
    authApi
      .getCurrentUser()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  // user state の変化を監視して PostHog の identify / reset を発火。
  // login / signup / OAuth complete / initial session 復帰 / logout の全パスで
  // 確実に 1 回ずつ走るよう、user state 変化の単一ポイントで扱う。
  useEffect(() => {
    if (isLoading) return
    if (user) {
      if (lastIdentifiedIdRef.current === user.id) return
      lastIdentifiedIdRef.current = user.id
      identifyUser({
        id: user.id,
        signup_method: deriveSignupMethod(user),
        signup_date: user.created_at,
      })
    } else if (lastIdentifiedIdRef.current !== null) {
      // 直前に identify していたユーザーがログアウトした場合のみ reset する
      lastIdentifiedIdRef.current = null
      resetAnalytics()
    }
  }, [user, isLoading])

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password)
    setUser(data.user)
  }, [])

  const signup = useCallback(
    async (username: string, email: string, password: string, passwordConfirmation: string) => {
      const data = await authApi.signup(username, email, password, passwordConfirmation)
      setUser(data.user)
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (error) {
      // 401以外のエラー（ネットワーク断等）はログに残す
      if (!(error instanceof ApiError && error.status === 401)) {
        console.error('Logout error:', error)
      }
    } finally {
      // APIが失敗してもローカル状態は必ずクリアする
      setUser(null)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.getCurrentUser()
      setUser(data.user)
    } catch {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      signup,
      logout,
      setUser,
      refreshUser,
    }),
    [user, isLoading, login, signup, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
