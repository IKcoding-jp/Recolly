import { useNavigate } from 'react-router-dom'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { getStatusOptions } from '../../components/StatusFilter/statusOptions'
import { MEDIA_TYPE_OPTIONS } from '../../components/MediaTypeFilter/mediaTypeOptions'
import { SORT_OPTIONS } from '../../components/SortSelector/sortOptions'
import type { SortOption } from '../../components/SortSelector/sortOptions'
import type { RecordStatus, MediaType } from '../../lib/types'
import { RecordListItem } from '../../components/RecordListItem/RecordListItem'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { Button } from '../../components/ui/Button/Button'
import { useLibrary } from './useLibrary'
import styles from './LibraryPage.module.css'

export function LibraryPage() {
  const navigate = useNavigate()
  const {
    records,
    totalPages,
    isLoading,
    error,
    status,
    mediaType,
    sort,
    page,
    allTags,
    selectedTags,
    setStatus,
    setMediaType,
    setSort,
    setPage,
    setTags,
  } = useLibrary()

  const handleTagToggle = (tagName: string) => {
    const next = selectedTags.includes(tagName)
      ? selectedTags.filter((t) => t !== tagName)
      : [...selectedTags, tagName]
    setTags(next)
  }

  const isUnfilteredEmpty = status === null && mediaType === null

  const handleGoToSearch = () => {
    navigate('/search')
  }

  const statusOptions = getStatusOptions(mediaType)

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setStatus(value === 'all' ? null : (value as RecordStatus))
  }

  const handleMediaTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setMediaType(value === 'all' ? null : (value as MediaType))
  }

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value as SortOption)
  }

  return (
    <div className={styles.page}>
      <SectionTitle>マイライブラリ</SectionTitle>

      <div className={styles.filters}>
        <div className={styles.filterItem}>
          <label htmlFor="status-filter" className={styles.filterLabel}>
            ステータス
          </label>
          <select
            id="status-filter"
            className={styles.filterSelect}
            value={status ?? 'all'}
            onChange={handleStatusChange}
          >
            {statusOptions.map((option) => (
              <option key={option.value ?? 'all'} value={option.value ?? 'all'}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterItem}>
          <label htmlFor="media-type-filter" className={styles.filterLabel}>
            ジャンル
          </label>
          <select
            id="media-type-filter"
            className={styles.filterSelect}
            value={mediaType ?? 'all'}
            onChange={handleMediaTypeChange}
          >
            {MEDIA_TYPE_OPTIONS.map((option) => (
              <option key={option.value ?? 'all'} value={option.value ?? 'all'}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterItem}>
          <label htmlFor="sort-filter" className={styles.filterLabel}>
            並び替え
          </label>
          <select
            id="sort-filter"
            className={styles.filterSelect}
            value={sort}
            onChange={handleSortChange}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className={styles.tagFilter}>
          <div className={styles.tagFilterLabel}>タグ</div>
          <div className={styles.tagChips}>
            {allTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`${styles.tagChip} ${selectedTags.includes(tag.name) ? styles.tagChipSelected : ''}`}
                onClick={() => handleTagToggle(tag.name)}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {isLoading && <div className={styles.loading}>読み込み中...</div>}

      {!isLoading && !error && records.length === 0 && (
        <div className={styles.empty}>
          {!isUnfilteredEmpty ? (
            <p className={styles.emptyText}>条件に一致する記録がありません</p>
          ) : (
            <div className={styles.emptyGuide}>
              <svg
                className={styles.emptyIcon}
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                <path d="M8 7h6" />
                <path d="M8 11h4" />
              </svg>
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
