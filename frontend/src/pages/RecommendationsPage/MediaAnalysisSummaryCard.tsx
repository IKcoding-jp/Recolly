import { getMediaTypeLabel } from '../../lib/mediaTypeUtils'
import type { MediaPreferenceProfileReady } from '../../types/mediaPreferenceProfile'
import styles from './RecommendationsPage.module.css'

type Props = {
  profile: MediaPreferenceProfileReady
}

// メディア別タブ上部の傾向文カード（一括分析のtrend文を表示する）
export function MediaAnalysisSummaryCard({ profile }: Props) {
  const mediaLabel = getMediaTypeLabel(profile.media_type)
  const borderClass = styles[`mediaBorder${profile.media_type}` as keyof typeof styles]

  return (
    <div className={`${styles.summaryCard} ${borderClass ?? ''}`}>
      <div className={styles.summaryHeader}>
        <span className={styles.summaryLabel}>{mediaLabel}での好み傾向</span>
        <span className={styles.aiBadge}>AI分析</span>
      </div>
      <p className={styles.summaryText}>{profile.analysis_summary}</p>
    </div>
  )
}
