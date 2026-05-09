import { useState } from 'react'
import type { MediaPreferenceProfileReady } from '../../types/mediaPreferenceProfile'
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
  profile: MediaPreferenceProfileReady
}

export function MediaAnalysisSummaryCard({ profile }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const mediaLabel = MEDIA_LABEL[profile.media_type] ?? profile.media_type
  const borderClass = styles[`mediaBorder${profile.media_type}` as keyof typeof styles]

  return (
    <>
      <div className={`${styles.summaryCard} ${borderClass ?? ''}`}>
        <div className={styles.summaryHeader}>
          <span className={styles.summaryLabel}>{mediaLabel}での好み傾向</span>
          <span className={styles.aiBadge}>AI分析</span>
        </div>
        <p className={styles.summaryText}>{profile.analysis_summary}</p>
      </div>

      <button
        className={`${styles.expandToggle} ${isExpanded ? styles.expandOpen : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? '好み分析の詳細を閉じる' : '好み分析の詳細を見る'}
        <span className={styles.arrow}>▼</span>
      </button>

      {isExpanded && profile.preference_scores.length > 0 && (
        <div className={styles.detailInner}>
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>好み傾向スコア</div>
            <div className={styles.prefBars}>
              {profile.preference_scores.map((s) => {
                const barClass = styles[`prefBar${profile.media_type}` as keyof typeof styles]
                return (
                  <div key={s.label} className={styles.prefRow}>
                    <span className={styles.prefLabel}>{s.label}</span>
                    <div className={styles.prefBarBg}>
                      <div
                        className={`${styles.prefBar} ${barClass ?? ''}`}
                        style={{ width: `${(s.score / 10) * 100}%` }}
                      />
                    </div>
                    <span className={styles.prefScore}>{s.score}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
