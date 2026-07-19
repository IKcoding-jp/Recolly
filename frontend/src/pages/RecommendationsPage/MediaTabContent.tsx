import { getMediaTypeLabel } from '../../lib/mediaTypeUtils'
import type { MediaPreferenceProfile } from '../../types/mediaPreferenceProfile'
import type { RecommendedWork } from '../../types/recommendation'
import { MediaAnalysisSummaryCard } from './MediaAnalysisSummaryCard'
import { RecommendedWorkCard } from './RecommendedWorkCard'
import styles from './RecommendationsPage.module.css'

type Props = {
  profile: MediaPreferenceProfile
  onRecord: (work: RecommendedWork, position: number) => void
  recordedIds: Set<string>
  recordingId: string | null
}

export function MediaTabContent({ profile, onRecord, recordedIds, recordingId }: Props) {
  const mediaLabel = getMediaTypeLabel(profile.media_type)
  const workKey = (work: RecommendedWork) => `${work.external_api_source}:${work.external_api_id}`

  if (profile.status === 'generating') {
    return (
      <div className={styles.loadingOverlay}>
        <div className={styles.spinner} />
        <div>
          <div className={styles.loadingText}>{mediaLabel}の分析中...</div>
          <div className={styles.loadingSub}>1〜2分かかることがあります。</div>
        </div>
      </div>
    )
  }

  // insufficient_records / no_records は全体側の表示で扱うため、タブでは何も出さない
  if (profile.status !== 'ready') return null

  return (
    <>
      <MediaAnalysisSummaryCard profile={profile} />

      {profile.same_media_works.length > 0 && (
        <>
          <h2 className={styles.mediaSectionTitle}>{mediaLabel}のおすすめ</h2>
          <div className={styles.recList}>
            {profile.same_media_works.map((work, index) => (
              <RecommendedWorkCard
                key={workKey(work)}
                work={work}
                onRecord={(w) => onRecord(w, index + 1)}
                isLoading={recordingId === workKey(work)}
                isRecorded={recordedIds.has(workKey(work))}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}
