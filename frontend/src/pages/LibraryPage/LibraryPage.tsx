import { useNavigate } from 'react-router-dom'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { FormSelect } from '../../components/ui/FormSelect/FormSelect'
import { getStatusOptions } from '../../components/StatusFilter/statusOptions'
import { MEDIA_TYPE_OPTIONS } from '../../components/MediaTypeFilter/mediaTypeOptions'
import { SORT_OPTIONS } from '../../components/SortSelector/sortOptions'
import type { SortOption } from '../../components/SortSelector/sortOptions'
import type { RecordStatus, MediaType } from '../../lib/types'
import { RecordListItem } from '../../components/RecordListItem/RecordListItem'
import { RecordCardItem } from '../../components/RecordCardItem/RecordCardItem'
import { RecordCompactItem } from '../../components/RecordCompactItem/RecordCompactItem'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { Button } from '../../components/ui/Button/Button'
import { LayoutSwitcher } from '../../components/ui/LayoutSwitcher/LayoutSwitcher'
import { useLayoutPreference } from '../../hooks/useLayoutPreference'
import { useLibrary } from './useLibrary'
import styles from './LibraryPage.module.css'

export function LibraryPage() {
  const navigate = useNavigate()
  const { layout, setLayout } = useLayoutPreference()
  const perPage = layout === 'card' ? 24 : 20

  const {
    records,
    totalPages,
    totalCount,
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
  } = useLibrary(perPage)

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
    <div className={`${styles.page} ${layout === 'card' ? styles.pageWide : ''}`}>
      <SectionTitle>マイライブラリ</SectionTitle>

      <div className={styles.filters}>
        <FormSelect
          size="sm"
          label="ステータス"
          id="status-filter"
          value={status ?? 'all'}
          onChange={handleStatusChange}
          options={statusOptions.map((o) => ({ value: o.value ?? 'all', label: o.label }))}
        />

        <FormSelect
          size="sm"
          label="ジャンル"
          id="media-type-filter"
          value={mediaType ?? 'all'}
          onChange={handleMediaTypeChange}
          options={MEDIA_TYPE_OPTIONS.map((o) => ({ value: o.value ?? 'all', label: o.label }))}
        />

        <FormSelect
          size="sm"
          label="並び替え"
          id="sort-filter"
          value={sort}
          onChange={handleSortChange}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
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

      <LayoutSwitcher currentLayout={layout} totalCount={totalCount} onLayoutChange={setLayout} />

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
          <div
            className={
              layout === 'card'
                ? styles.cardGrid
                : layout === 'compact'
                  ? styles.compactList
                  : styles.list
            }
          >
            {records.map((record) => {
              switch (layout) {
                case 'card':
                  return <RecordCardItem key={record.id} record={record} />
                case 'compact':
                  return <RecordCompactItem key={record.id} record={record} />
                default:
                  return <RecordListItem key={record.id} record={record} />
              }
            })}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
