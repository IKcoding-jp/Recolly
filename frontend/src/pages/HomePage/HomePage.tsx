import { Link } from 'react-router-dom'
import { EmailPromptBanner } from '../../components/EmailPromptBanner/EmailPromptBanner'
import { useAuth } from '../../contexts/useAuth'
import styles from './HomePage.module.css'

const QUICK_ACTIONS = [
  { label: '作品を探す', description: '新しい作品を検索して記録する', path: '/search' },
  { label: 'ライブラリ', description: '記録した作品を一覧で確認する', path: '/library' },
  { label: 'マイページ', description: '統計情報や進行中の作品を見る', path: '/mypage' },
] as const

export function HomePage() {
  const { user } = useAuth()

  return (
    <div className={styles.container}>
      {user?.email_missing && <EmailPromptBanner />}
      <h1 className={styles.greeting}>
        おかえりなさい、{user?.username}さん
      </h1>
      <div className={styles.cards}>
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.path} to={action.path} className={styles.card}>
            <span className={styles.cardLabel}>{action.label}</span>
            <span className={styles.cardDescription}>{action.description}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
