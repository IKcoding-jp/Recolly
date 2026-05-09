import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button/Button'
import type { MediaPreferenceProfile } from '../../types/mediaPreferenceProfile'
import type { RecommendedWork } from '../../types/recommendation'
import { MediaAnalysisSummaryCard } from './MediaAnalysisSummaryCard'
import { RecommendedWorkCard } from './RecommendedWorkCard'
import styles from './RecommendationsPage.module.css'

const MEDIA_LABEL: Record<string, string> = {
  anime: 'アニメ',
  movie: '映画',
  drama: 'ドラマ',
  book: '本',
  manga: '漫画',
  game: 'ゲーム',
}

type Props = {
  profile: MediaPreferenceProfile
  onRecord: (work: RecommendedWork, position: number) => void
  recordedIds: Set<string>
  recordingId: string | null
}

export function MediaTabContent({ profile, onRecord, recordedIds, recordingId }: Props) {
  const mediaLabel = MEDIA_LABEL[profile.media_type] ?? profile.media_type
  const workKey = (work: RecommendedWork) => `${work.external_api_source}:${work.external_api_id}`

  if (profile.status === 'no_records') {
    return (
      <div className={styles.mediaEmptyState}>
        <p className={styles.mediaEmptyDesc}>
          まだ{mediaLabel}の記録がありません。記録を追加するとAI分析が使えるようになります。
        </p>
        <Link to="/search">
          <Button variant="secondary" size="sm">
            {mediaLabel}を検索して記録する
          </Button>
        </Link>
      </div>
    )
  }

  if (profile.status === 'insufficient_records') {
    const remaining = profile.required_count - profile.record_count
    return (
      <div className={styles.mediaProgressCard}>
        <div className={styles.progressTitle}>
          あと{remaining}件記録すると{mediaLabel}のAI分析が使えます
        </div>
        <div className={styles.progressBarContainer}>
          <div className={styles.progressBarBg}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${(profile.record_count / profile.required_count) * 100}%` }}
            />
          </div>
          <span className={styles.progressCount}>
            {profile.record_count} / {profile.required_count}
          </span>
        </div>
        <Link to="/search">
          <Button variant="secondary" size="sm">
            {mediaLabel}を検索して記録する
          </Button>
        </Link>
      </div>
    )
  }

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

      {profile.cross_media_works.length > 0 && (
        <>
          <h2 className={styles.mediaSectionTitle}>{mediaLabel}好きにおすすめの他メディア</h2>
          <div className={styles.recList}>
            {profile.cross_media_works.map((work, index) => (
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
