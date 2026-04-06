import { getMediaTypeLabel } from '../../lib/mediaTypeUtils'
import type { RecommendationAnalysis } from '../../types/recommendation'
import styles from './RecommendationsPage.module.css'

type AnalysisDetailProps = {
  analysis: RecommendationAnalysis
}

export function AnalysisDetail({ analysis }: AnalysisDetailProps) {
  return (
    <div className={styles.detailInner}>
      {/* ジャンル別統計 */}
      <div className={styles.detailSection}>
        <h3 className={styles.detailSectionTitle}>ジャンル別統計</h3>
        <div className={styles.genreGrid}>
          {analysis.genre_stats.map((stat) => (
            <div
              key={stat.media_type}
              className={`${styles.genreCard} ${styles[`genre${stat.media_type}Card`]}`}
            >
              <div className={`${styles.genreIndicator} ${styles[`bg${stat.media_type}`]}`} />
              <div className={`${styles.genreCount} ${styles[`color${stat.media_type}`]}`}>
                {stat.count}
              </div>
              <div className={styles.genreLabel}>{getMediaTypeLabel(stat.media_type)}</div>
              {stat.avg_rating !== null && (
                <div className={styles.genreRating}>
                  <span className={styles.star}>★</span> {stat.avg_rating}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 好みの傾向スコア */}
      {analysis.preference_scores.length > 0 && (
        <div className={styles.detailSection}>
          <h3 className={styles.detailSectionTitle}>
            好みの傾向スコア
            <span className={styles.aiBadge}>AI分析</span>
          </h3>
          <div className={styles.prefBars}>
            {analysis.preference_scores.map((score) => (
              <div key={score.label} className={styles.prefRow}>
                <span className={styles.prefLabel}>{score.label}</span>
                <div className={styles.prefBarBg}>
                  <div className={styles.prefBar} style={{ width: `${score.score * 10}%` }} />
                </div>
                <span className={styles.prefScore}>{score.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* よく使うタグ */}
      {analysis.top_tags.length > 0 && (
        <div className={styles.detailSection}>
          <h3 className={styles.detailSectionTitle}>よく使うタグ</h3>
          <div className={styles.tagList}>
            {analysis.top_tags.map((tag) => (
              <span key={tag.name} className={styles.tag}>
                {tag.name} <span className={styles.tagCount}>{tag.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
