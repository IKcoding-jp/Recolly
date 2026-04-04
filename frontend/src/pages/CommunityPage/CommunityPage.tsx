import { useDiscussions } from '../../hooks/useDiscussions'
import type { DiscussionSort } from '../../hooks/useDiscussions'
import { DiscussionCard } from '../../components/DiscussionCard/DiscussionCard'
import { FormSelect } from '../../components/ui/FormSelect/FormSelect'
import { GENRE_FILTERS } from '../SearchPage/genreFilters'
import type { MediaType } from '../../lib/types'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import styles from './CommunityPage.module.css'

const SORT_OPTIONS: { value: DiscussionSort; label: string }[] = [
  { value: 'newest', label: '新着順' },
  { value: 'most_comments', label: 'コメント多い順' },
]

export function CommunityPage() {
  const {
    discussions,
    totalPages,
    isLoading,
    error,
    mediaType,
    sort,
    page,
    setMediaType,
    setSort,
    setPage,
  } = useDiscussions()

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value as DiscussionSort)
  }

  return (
    <div className={styles.page}>
      <SectionTitle>コミュニティ</SectionTitle>

      <div className={styles.filters}>
        <div className={styles.genreFilters}>
          {GENRE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`${styles.filterButton} ${(mediaType ?? 'all') === filter.value ? styles.filterActive : ''}`}
              onClick={() =>
                setMediaType(filter.value === 'all' ? null : (filter.value as MediaType))
              }
            >
              {filter.label}
            </button>
          ))}
        </div>
        <FormSelect
          label="並び替え"
          id="sort-select"
          value={sort}
          onChange={handleSortChange}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
      </div>

      {isLoading && <div className={styles.loading}>読み込み中...</div>}

      {error && <div className={styles.error}>{error}</div>}

      {!isLoading && !error && discussions.length === 0 && (
        <div className={styles.empty}>ディスカッションはまだありません</div>
      )}

      {!isLoading && !error && discussions.length > 0 && (
        <>
          <div className={styles.list}>
            {discussions.map((d) => (
              <DiscussionCard key={d.id} discussion={d} />
            ))}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
