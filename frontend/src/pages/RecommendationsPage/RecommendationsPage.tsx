import { useState } from 'react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { Button } from '../../components/ui/Button/Button'
import { RecordModal } from '../../components/RecordModal/RecordModal'
import { useRecommendations } from '../../hooks/useRecommendations'
import { recordsApi } from '../../lib/recordsApi'
import { getGenreLabel, getMediaTypeLabel } from '../../lib/mediaTypeUtils'
import { useRecollyMotion } from '../../lib/motion'
import { captureEvent } from '../../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'
import { updateMediaTypesCount } from '../../lib/analytics/userProperties'
import type { MediaType, RecordStatus } from '../../lib/types'
import type { RecommendedWork } from '../../types/recommendation'
import { AnalysisSummaryCard } from './AnalysisSummaryCard'
import { RecommendedWorkCard } from './RecommendedWorkCard'
import styles from './RecommendationsPage.module.css'

export function RecommendationsPage() {
  const { data, status, isLoading, isRefreshing, error, refresh } = useRecommendations()
  const [modalWork, setModalWork] = useState<RecommendedWork | null>(null)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set())
  const m = useRecollyMotion()

  const handleOpenModal = (work: RecommendedWork, position: number) => {
    captureEvent(ANALYTICS_EVENTS.RECOMMENDATION_CLICKED, {
      media_type: work.media_type as MediaType,
      position,
      has_reason: Boolean(work.reason),
    })
    setModalWork(work)
  }

  const handleConfirmRecord = async (recordData: {
    status: RecordStatus
    rating: number | null
  }) => {
    if (!modalWork) return

    const workKey = `${modalWork.external_api_source}:${modalWork.external_api_id}`
    setRecordingId(workKey)

    try {
      await recordsApi.createFromSearchResult(
        {
          title: modalWork.title,
          media_type: modalWork.media_type as MediaType,
          description: modalWork.description,
          cover_image_url: modalWork.cover_url,
          // RecommendedWork は総話数情報を持たないため null を明示的に設定
          total_episodes: null,
          external_api_id: modalWork.external_api_id,
          external_api_source: modalWork.external_api_source,
          metadata: modalWork.metadata,
        },
        recordData,
      )
      // ジャンル横断率計測の基点イベント
      captureEvent(ANALYTICS_EVENTS.RECORD_CREATED, {
        media_type: modalWork.media_type as MediaType,
      })
      // ジャンル横断率 Insight (#3) の User Property を最新化
      void updateMediaTypesCount()
      setRecordedIds((prev) => new Set(prev).add(workKey))
      setModalWork(null)
    } catch {
      // エラーハンドリングはRecordModal側で表示
    } finally {
      setRecordingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <div className={styles.errorTitle}>おすすめの取得に失敗しました</div>
          <p className={styles.errorDesc}>
            サーバーとの通信に問題が発生しました。しばらく経ってからもう一度お試しください。
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            もう一度試す
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'no_records') {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>作品を記録しておすすめを受け取ろう</div>
          <p className={styles.emptyDesc}>
            観た作品を記録して評価すると、あなたの好みを分析してジャンルを超えた作品をおすすめします
          </p>
          <Link to="/search">
            <Button variant="primary">作品を検索する</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'insufficient_records' && data) {
    const remaining = (data.required_count ?? 5) - data.record_count
    return (
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>おすすめ</h1>
        <div className={styles.progressCard}>
          <div className={styles.progressTitle}>あと{remaining}件記録するとAI分析が使えます</div>
          <div className={styles.progressBarContainer}>
            <div className={styles.progressBarBg}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${(data.record_count / (data.required_count ?? 5)) * 100}%` }}
              />
            </div>
            <span className={styles.progressCount}>
              {data.record_count} / {data.required_count ?? 5}
            </span>
          </div>
          <p className={styles.progressHint}>評価をつけると分析の精度が上がります</p>
        </div>

        {data.genre_stats && data.genre_stats.length > 0 && (
          <>
            <SectionTitle>現在の記録</SectionTitle>
            <div className={styles.simpleGenreRow}>
              {data.genre_stats.map((stat) => (
                <div key={stat.media_type} className={styles.simpleGenre}>
                  <div className={styles.simpleGenreNum}>{stat.count}</div>
                  <div className={styles.simpleGenreLabel}>
                    {getMediaTypeLabel(stat.media_type)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  if (status === 'generating') {
    return (
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>おすすめ</h1>
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <div>
            <div className={styles.loadingText}>分析を更新しています...</div>
            <div className={styles.loadingSub}>
              記録データの分析とおすすめ作品の検索を行っています。1〜2分かかることがあります。
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'ready' && data) {
    return (
      <div className={styles.container}>
        <motion.div variants={m.listContainer} initial="hidden" animate="visible">
          <motion.div className={styles.pageHeader} variants={m.fadeInUp}>
            <h1 className={styles.pageTitle}>おすすめ</h1>
            <p className={styles.pageSubtitle}>
              あなたの記録データから好みを分析し、ジャンルを超えた作品をおすすめします
            </p>
          </motion.div>

          {/* 更新バー */}
          <motion.div className={styles.updateBar} variants={m.fadeInUp}>
            <div className={styles.updateInfo}>
              <span className={styles.updateDot} />
              <span>{data.record_count}件の記録をもとに分析</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void refresh()}
              disabled={isRefreshing}
            >
              {isRefreshing ? '更新中...' : '分析を更新'}
            </Button>
          </motion.div>

          {/* 好み分析サマリー */}
          {data.analysis && (
            <motion.div variants={m.fadeInUp}>
              <AnalysisSummaryCard analysis={data.analysis} />
            </motion.div>
          )}

          {/* あなたへのおすすめ */}
          {data.recommended_works.length > 0 && (
            <motion.div variants={m.fadeInUp}>
              <SectionTitle>あなたへのおすすめ</SectionTitle>
              <div className={styles.recList}>
                {data.recommended_works.map((work, index) => (
                  <RecommendedWorkCard
                    key={`${work.external_api_source}:${work.external_api_id}`}
                    work={work}
                    onRecord={(w) => handleOpenModal(w, index + 1)}
                    isLoading={
                      recordingId === `${work.external_api_source}:${work.external_api_id}`
                    }
                    isRecorded={recordedIds.has(
                      `${work.external_api_source}:${work.external_api_id}`,
                    )}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* いつもと違うジャンルに挑戦 */}
          {data.challenge_works.length > 0 && (
            <motion.div variants={m.fadeInUp}>
              <SectionTitle className={styles.challengeTitle}>
                いつもと違うジャンルに挑戦
              </SectionTitle>
              <div className={styles.recList}>
                {data.challenge_works.map((work, index) => (
                  <RecommendedWorkCard
                    key={`${work.external_api_source}:${work.external_api_id}`}
                    work={work}
                    onRecord={(w) => handleOpenModal(w, index + 1)}
                    isLoading={
                      recordingId === `${work.external_api_source}:${work.external_api_id}`
                    }
                    isRecorded={recordedIds.has(
                      `${work.external_api_source}:${work.external_api_id}`,
                    )}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* 記録モーダル */}
        <RecordModal
          key={
            modalWork ? `${modalWork.external_api_source}:${modalWork.external_api_id}` : 'closed'
          }
          isOpen={modalWork !== null}
          title={modalWork?.title ?? ''}
          mediaType={(modalWork?.media_type as MediaType) ?? 'anime'}
          mediaTypeLabel={modalWork ? getGenreLabel(modalWork.media_type as MediaType) : ''}
          onConfirm={(d) => void handleConfirmRecord(d)}
          onCancel={() => setModalWork(null)}
          isLoading={recordingId !== null}
        />
      </div>
    )
  }

  return null
}
