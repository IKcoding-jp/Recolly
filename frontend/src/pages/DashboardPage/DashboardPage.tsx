import { useAuth } from '../../contexts/useAuth'
import { Typography } from '../../components/ui/Typography/Typography'
import { Button } from '../../components/ui/Button/Button'
import { Divider } from '../../components/ui/Divider/Divider'

// 仮のダッシュボードページ（認証確認用）
// フェーズ1の後半で正式なダッシュボードに置き換える
export function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <div style={{ padding: 'var(--spacing-xl)' }}>
      <Typography variant="h2">ダッシュボード</Typography>
      <Divider />
      <Typography variant="body">ようこそ、{user?.username} さん</Typography>
      <Typography variant="meta">{user?.email}</Typography>
      <div style={{ marginTop: 'var(--spacing-lg)' }}>
        <Button variant="secondary" onClick={() => void logout()}>
          ログアウト
        </Button>
      </div>
    </div>
  )
}
