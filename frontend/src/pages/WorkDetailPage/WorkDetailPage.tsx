import type { MediaType } from '../../lib/types'
import { hasEpisodes, getRewatchLabel } from '../../lib/mediaTypeUtils'
import { StatusSelector } from '../../components/ui/StatusSelector/StatusSelector'
import { RatingInput } from '../../components/ui/RatingInput/RatingInput'
import { ProgressControl } from '../../components/ui/ProgressControl/ProgressControl'
import { RewatchControl } from '../../components/RewatchControl/RewatchControl'
import { ReviewSection } from '../../components/ReviewSection/ReviewSection'
import { EpisodeReviewSection } from '../../components/EpisodeReviewSection/EpisodeReviewSection'
import { TagSection } from '../../components/TagSection/TagSection'
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

const formatDate = (date: string | null): string => {
  if (!date) return '---'
  return new Date(date).toLocaleDateString('ja-JP')
}

export function WorkDetailPage() {
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
      <div className={styles.container}>
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            {work.cover_image_url ? (
              <img
                className={styles.cover}
                src={work.cover_image_url}
                alt={`${work.title}のカバー画像`}
              />
            ) : (
              <div className={styles.coverPlaceholder} />
            )}
            <div className={styles.metadata}>
              <div>{MEDIA_TYPE_LABELS[work.media_type]}</div>
              {work.total_episodes !== null && <div>全{work.total_episodes}話</div>}
            </div>
          </aside>

          <div className={styles.main}>
            <h1 className={styles.title}>{work.title}</h1>

            <div className={styles.section}>
              <div className={styles.label}>ステータス</div>
              <StatusSelector
                value={record.status}
                onChange={handleStatusChange}
                mediaType={work.media_type}
              />
            </div>

            <div className={styles.section}>
              <div className={styles.label}>評価</div>
              <RatingInput value={record.rating} onChange={handleRatingChange} />
            </div>

            {hasEpisodes(work.media_type) && (
              <div className={styles.section}>
                <div className={styles.label}>進捗</div>
                <ProgressControl
                  current={record.current_episode}
                  total={work.total_episodes}
                  onChange={handleEpisodeChange}
                  showFullControls
                  mediaType={work.media_type}
                />
              </div>
            )}

            <div className={styles.section}>
              <div className={styles.label}>{getRewatchLabel(work.media_type)}</div>
              <RewatchControl count={record.rewatch_count} onChange={handleRewatchCountChange} />
            </div>

            <div className={styles.section}>
              <div className={styles.label}>日付</div>
              <div className={styles.dates}>
                <div className={styles.dateItem}>開始: {formatDate(record.started_at)}</div>
                <div className={styles.dateItem}>完了: {formatDate(record.completed_at)}</div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.label}>タグ</div>
              <TagSection recordId={record.id} initialTags={record.tags ?? []} />
            </div>

            {work.description && (
              <div className={styles.section}>
                <div className={styles.label}>あらすじ</div>
                <p className={styles.description}>{work.description}</p>
              </div>
            )}

            <div className={styles.section}>
              <div className={styles.label}>感想</div>
              <ReviewSection reviewText={record.review_text} onSave={handleReviewTextSave} />
            </div>

            {HAS_EPISODES.includes(work.media_type) && (
              <div className={styles.section}>
                <div className={styles.label}>話数ごとの感想</div>
                <EpisodeReviewSection
                  recordId={record.id}
                  currentEpisode={record.current_episode}
                />
              </div>
            )}

            <div className={styles.deleteSection}>
              <Button variant="secondary" onClick={openDeleteDialog}>
                記録を削除
              </Button>
            </div>
          </div>
        </div>
      </div>

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
