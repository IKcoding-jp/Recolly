import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi, ApiError } from '../lib/api'
import type { User } from '../lib/types'
import { AuthContext } from './authContextValue'

export type { AuthContextValue } from './authContextValue'
export { AuthContext } from './authContextValue'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 初回ロード時にセッション確認
  useEffect(() => {
    authApi
      .getCurrentUser()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

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
