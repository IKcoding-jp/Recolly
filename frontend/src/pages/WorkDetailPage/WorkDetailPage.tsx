import { useState } from 'react'
import { motion } from 'motion/react'
import { useRecollyMotion } from '../../lib/motion'
import type { MediaType } from '../../lib/types'
import {
  hasEpisodes,
  getRewatchLabel,
  isOngoing,
  getUnreadCount,
  UNIT_LABELS,
} from '../../lib/mediaTypeUtils'
import { StatusSelector } from '../../components/ui/StatusSelector/StatusSelector'
import { RatingSlider } from '../../components/ui/RatingSlider/RatingSlider'
import { ProgressControl } from '../../components/ui/ProgressControl/ProgressControl'
import { RewatchControl } from '../../components/RewatchControl/RewatchControl'
import { ReviewSection } from '../../components/ReviewSection/ReviewSection'
import { EpisodeReviewSection } from '../../components/EpisodeReviewSection/EpisodeReviewSection'
import { TagSection } from '../../components/TagSection/TagSection'
import { DiscussionSection } from '../../components/DiscussionSection/DiscussionSection'
import { RecordDeleteDialog } from '../../components/RecordDeleteDialog/RecordDeleteDialog'
import { Button } from '../../components/ui/Button/Button'
import { useWorkDetail } from './useWorkDetail'
import styles from './WorkDetailPage.module.css'

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  anime: 'アニメ',
  movie: '映画',
  drama: 'ドラマ',
  book: '本',
  manga: '漫画',
  game: 'ゲーム',
}

// 話数ごとの感想を表示するジャンル
const HAS_EPISODES: MediaType[] = ['anime', 'drama', 'manga']

type TabId = 'overview' | 'reviews' | 'community'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: '概要' },
  { id: 'reviews', label: '感想' },
  { id: 'community', label: 'コミュニティ' },
]

const formatDate = (date: string | null): string => {
  if (!date) return '---'
  return new Date(date).toLocaleDateString('ja-JP')
}

export function WorkDetailPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const {
    record,
    isLoading,
    isDeleting,
    showDeleteDialog,
    handleStatusChange,
    handleRatingChange,
    handleEpisodeChange,
    handleReviewTextSave,
    handleRewatchCountChange,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
  } = useWorkDetail()
  const m = useRecollyMotion()

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    )
  }

  if (!record) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>記録が見つかりません</div>
      </div>
    )
  }

  const { work } = record

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.container}
        variants={m.listContainer}
        initial="hidden"
        animate="visible"
      >
        {/* ヘッダー: カバー画像 + タイトル + ステータス + 評価 */}
        <motion.div className={styles.header} variants={m.fadeInUp}>
          <div className={styles.coverArea}>
            {work.cover_image_url ? (
              <img
                className={styles.cover}
                src={work.cover_image_url}
                alt={`${work.title}のカバー画像`}
              />
            ) : (
              <div className={styles.coverPlaceholder} />
            )}
          </div>
          <div className={styles.titleArea}>
            <h1 className={styles.title}>{work.title}</h1>
            <div className={styles.metadata}>
              {MEDIA_TYPE_LABELS[work.media_type]}
              {work.total_episodes !== null && ` · 全${String(work.total_episodes)}話`}
            </div>

            <div className={styles.statusSection}>
              <StatusSelector
                value={record.status}
                onChange={handleStatusChange}
                mediaType={work.media_type}
              />
            </div>

            <RatingSlider
              value={record.rating ?? 0}
              onChange={(v) => handleRatingChange(v === 0 ? null : v)}
              mediaType={work.media_type}
            />
          </div>
        </motion.div>

        {/* タブナビゲーション */}
        <motion.div className={styles.tabs} variants={m.fadeInUp}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* タブコンテンツ: 概要 */}
        {activeTab === 'overview' && (
          <motion.div className={styles.tabContent} variants={m.fadeInUp}>
            <div className={styles.dataRow}>
              {hasEpisodes(work.media_type) && (
                <div className={styles.dataItem}>
                  <div className={styles.label}>進捗</div>
                  <ProgressControl
                    current={record.current_episode}
                    total={work.total_episodes}
                    onChange={handleEpisodeChange}
                    showFullControls
                    mediaType={work.media_type}
                  />
                  {work.media_type === 'manga' &&
                    isOngoing(work.metadata) &&
                    getUnreadCount(record.current_episode, work.total_episodes) > 0 && (
                      <div className={styles.newVolumeAlert}>
                        📖 <strong>新刊</strong>が出ています！ {work.total_episodes}巻
                      </div>
                    )}
                </div>
              )}
              <div className={styles.dataItem}>
                <div className={styles.label}>{getRewatchLabel(work.media_type)}</div>
                <RewatchControl count={record.rewatch_count} onChange={handleRewatchCountChange} />
              </div>
              <div className={styles.dataItem}>
                <div className={styles.label}>開始日</div>
                <div className={styles.dateValue}>{formatDate(record.started_at)}</div>
              </div>
              <div className={styles.dataItem}>
                <div className={styles.label}>完了日</div>
                <div className={styles.dateValue}>{formatDate(record.completed_at)}</div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.label}>タグ</div>
              <TagSection recordId={record.id} initialTags={record.tags ?? []} />
            </div>

            {work.description && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>あらすじ</div>
                <p className={styles.description}>{work.description}</p>
              </div>
            )}

            <div className={styles.deleteSection}>
              <Button variant="secondary" onClick={openDeleteDialog}>
                記録を削除
              </Button>
            </div>
          </motion.div>
        )}

        {/* タブコンテンツ: 感想 */}
        {activeTab === 'reviews' && (
          <motion.div className={styles.tabContent} variants={m.fadeInUp}>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>作品の感想</div>
              <ReviewSection reviewText={record.review_text} onSave={handleReviewTextSave} />
            </div>

            {HAS_EPISODES.includes(work.media_type) && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  {UNIT_LABELS[work.media_type] === '巻' ? '巻数ごとの感想' : '話数ごとの感想'}
                </div>
                <EpisodeReviewSection
                  recordId={record.id}
                  currentEpisode={record.current_episode}
                  mediaType={work.media_type}
                />
              </div>
            )}
          </motion.div>
        )}

        {/* タブコンテンツ: コミュニティ */}
        {activeTab === 'community' && (
          <motion.div className={styles.tabContent} variants={m.fadeInUp}>
            <DiscussionSection
              workId={work.id}
              totalEpisodes={work.total_episodes}
              hasRecord={!!record}
            />
          </motion.div>
        )}
      </motion.div>

      <RecordDeleteDialog
        isOpen={showDeleteDialog}
        workTitle={work.title}
        onConfirm={confirmDelete}
        onCancel={closeDeleteDialog}
        isLoading={isDeleting}
      />
    </div>
  )
}
