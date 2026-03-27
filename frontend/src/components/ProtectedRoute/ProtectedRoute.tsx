import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import styles from './ProtectedRoute.module.css'

// 認証が必要なルートを保護するコンポーネント
// 未認証ユーザーはログインページにリダイレクトされる
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <div className={styles.loading}>読み込み中...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
