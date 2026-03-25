import type { Statistics } from '../../lib/types'
import { GENRE_LABELS, STATUS_LABELS } from './statsLabels'
import { NumberCards } from './NumberCards'
import { DistributionBars } from './DistributionBars'
import { MonthlyChart } from './MonthlyChart'
import styles from './StatsSummary.module.css'

interface StatsSummaryProps {
  statistics: Statistics
}

export function StatsSummary({ statistics }: StatsSummaryProps) {
  return (
    <section className={styles.wrapper}>
      <NumberCards statistics={statistics} />

      <div className={styles.distributionGrid}>
        <DistributionBars
          title="ジャンル別"
          data={statistics.by_genre}
          labels={GENRE_LABELS}
        />
        <DistributionBars
          title="ステータス別"
          data={statistics.by_status}
          labels={STATUS_LABELS}
        />
      </div>

      {statistics.monthly_completions.length > 0 && (
        <MonthlyChart completions={statistics.monthly_completions} />
      )}
    </section>
  )
}
