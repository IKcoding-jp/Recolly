import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { StatusFilter } from '../../components/StatusFilter/StatusFilter'
import { getStatusOptions } from '../../components/StatusFilter/statusOptions'
import { MediaTypeFilter } from '../../components/MediaTypeFilter/MediaTypeFilter'
import { MEDIA_TYPE_OPTIONS } from '../../components/MediaTypeFilter/mediaTypeOptions'
import { SortSelector } from '../../components/SortSelector/SortSelector'
import { SORT_OPTIONS } from '../../components/SortSelector/sortOptions'
import { RecordListItem } from '../../components/RecordListItem/RecordListItem'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { Button } from '../../components/ui/Button/Button'
import { useLibrary } from './useLibrary'
import styles from './LibraryPage.module.css'

/** オプション配列から値に対応するラベルを取得する */
function findLabel<T>(options: { value: T; label: string }[], value: T): string | undefined {
  return options.find((o) => o.value === value)?.label
}

export function LibraryPage() {
  const navigate = useNavigate()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const {
    records,
    totalPages,
    isLoading,
    error,
    status,
    mediaType,
    sort,
    page,
    setStatus,
    setMediaType,
    setSort,
    setPage,
  } = useLibrary()

  // 空状態の判定: status=all かつ mediaType=null のときのみガイド表示
  const isUnfilteredEmpty = status === null && mediaType === null

  const handleGoToSearch = () => {
    navigate('/search')
  }

  const statusOptions = getStatusOptions(mediaType)
  const statusLabel = findLabel(statusOptions, status) ?? 'すべて'
  const mediaTypeLabel = findLabel(MEDIA_TYPE_OPTIONS, mediaType) ?? '全ジャンル'
  const sortLabel = findLabel(SORT_OPTIONS, sort) ?? '更新日'

  return (
    <div className={styles.page}>
      <SectionTitle>マイライブラリ</SectionTitle>

      {/* モバイル用: フィルタサマリー + 折りたたみトグル */}
      <div className={styles.filterSummary}>
        <div className={styles.filterChips}>
          <span className={styles.chip}>{statusLabel}</span>
          <span className={styles.chip}>{mediaTypeLabel}</span>
          <span className={styles.chipMuted}>{sortLabel}順</span>
        </div>
        <button
          type="button"
          className={styles.filterToggle}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          {filtersOpen ? '閉じる' : '絞り込み'}
        </button>
      </div>

      {/* PC: 常に表示 / モバイル: filtersOpen時のみ表示 */}
      <div className={`${styles.filters} ${filtersOpen ? styles.filtersOpen : ''}`}>
        <StatusFilter value={status} onChange={setStatus} mediaType={mediaType} />
        <MediaTypeFilter value={mediaType} onChange={setMediaType} />
        <SortSelector value={sort} onChange={setSort} />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {isLoading && <div className={styles.loading}>読み込み中...</div>}

      {!isLoading && !error && records.length === 0 && (
        <div className={styles.empty}>
          {!isUnfilteredEmpty ? (
            <p className={styles.emptyText}>条件に一致する記録がありません</p>
          ) : (
            <div className={styles.emptyGuide}>
              <p className={styles.emptyIcon}>📚</p>
              <p className={styles.emptyTitle}>作品を探して記録しましょう</p>
              <Button variant="primary" onClick={handleGoToSearch}>
                作品を検索する
              </Button>
            </div>
          )}
        </div>
      )}

      {!isLoading && !error && records.length > 0 && (
        <>
          <div className={styles.list}>
            {records.map((record) => (
              <RecordListItem key={record.id} record={record} />
            ))}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
