import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { EmailPromptBanner } from '../../components/EmailPromptBanner/EmailPromptBanner'
import { StatsSummary } from '../../components/StatsSummary/StatsSummary'
import { useAuth } from '../../contexts/useAuth'
import { useStatistics } from '../../hooks/useStatistics'
import styles from './MyPage.module.css'

export function MyPage() {
  const { user } = useAuth()
  const { statistics, isLoading } = useStatistics()

  return (
    <div className={styles.container}>
      {user?.email_missing && <EmailPromptBanner />}
      <SectionTitle>マイページ</SectionTitle>
      {isLoading && <div className={styles.loading}>読み込み中...</div>}
      {!isLoading && statistics && <StatsSummary statistics={statistics} />}
    </div>
  )
}
