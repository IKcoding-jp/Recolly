import { useState } from 'react'
import type { RecommendationAnalysis } from '../../types/recommendation'
import { AnalysisDetail } from './AnalysisDetail'
import styles from './RecommendationsPage.module.css'

type AnalysisSummaryCardProps = {
  analysis: RecommendationAnalysis
}

export function AnalysisSummaryCard({ analysis }: AnalysisSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <>
      <div className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <span className={styles.summaryLabel}>あなたの好み傾向</span>
          <span className={styles.aiBadge}>AI分析</span>
        </div>
        <p className={styles.summaryText}>{analysis.summary}</p>
      </div>

      <button
        className={`${styles.expandToggle} ${isExpanded ? styles.expandOpen : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? '好み分析の詳細を閉じる' : '好み分析の詳細を見る'}
        <span className={styles.arrow}>▼</span>
      </button>

      {isExpanded && <AnalysisDetail analysis={analysis} />}
    </>
  )
}
