import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { WatchingListItem } from '../../components/WatchingListItem/WatchingListItem'
import { DashboardEmptyState } from '../../components/DashboardEmptyState/DashboardEmptyState'
import { EmailPromptBanner } from '../../components/EmailPromptBanner/EmailPromptBanner'
import { useAuth } from '../../contexts/useAuth'
import { useDashboard } from './useDashboard'
import styles from './DashboardPage.module.css'

export function DashboardPage() {
  const { user } = useAuth()
  const { records, isLoading, error, handleAction } = useDashboard()

  return (
    <div className={styles.container}>
      {user?.email_missing && <EmailPromptBanner />}
      <SectionTitle>進行中</SectionTitle>
      {isLoading && <div className={styles.loading}>読み込み中...</div>}
      {error && <div className={styles.error}>{error}</div>}
      {!isLoading && !error && records.length === 0 && <DashboardEmptyState />}
      {!isLoading && records.length > 0 && (
        <div className={styles.list}>
          {records.map((record) => (
            <WatchingListItem
              key={record.id}
              record={record}
              onAction={() => void handleAction(record)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
