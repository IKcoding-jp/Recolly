import { motion } from 'motion/react'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { WatchingListItem } from '../../components/WatchingListItem/WatchingListItem'
import { DashboardEmptyState } from '../../components/DashboardEmptyState/DashboardEmptyState'
import { EmailPromptBanner } from '../../components/EmailPromptBanner/EmailPromptBanner'
import { useAuth } from '../../contexts/useAuth'
import { useDashboard } from '../../hooks/useDashboard'
import { useRecollyMotion } from '../../lib/motion'
import styles from './HomePage.module.css'

export function HomePage() {
  const { user } = useAuth()
  const { records, isLoading, error, handleAction } = useDashboard()
  const m = useRecollyMotion()

  return (
    <div className={styles.container}>
      {user?.email_missing && <EmailPromptBanner />}
      {isLoading && <div className={styles.loading}>読み込み中...</div>}
      {error && <div className={styles.error}>{error}</div>}
      {!isLoading && !error && records.length === 0 && <DashboardEmptyState />}
      {!isLoading && !error && records.length > 0 && (
        <>
          <SectionTitle>進行中</SectionTitle>
          <motion.div
            className={styles.list}
            variants={m.listContainer}
            initial="hidden"
            animate="visible"
          >
            {records.map((record) => (
              <motion.div key={record.id} variants={m.fadeInUp}>
                <WatchingListItem record={record} onAction={() => void handleAction(record)} />
              </motion.div>
            ))}
          </motion.div>
        </>
      )}
    </div>
  )
}
