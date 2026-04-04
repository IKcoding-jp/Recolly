import { Link } from 'react-router-dom'
import { useUserRecords } from '../../hooks/useUserRecords'
import { getStatusLabel } from '../../lib/mediaTypeUtils'
import type { MediaType } from '../../lib/types'
import { GENRE_FILTERS } from '../../pages/SearchPage/genreFilters'
import { FormSelect } from '../ui/FormSelect/FormSelect'
import { Pagination } from '../ui/Pagination/Pagination'
import { SectionTitle } from '../ui/SectionTitle/SectionTitle'
import styles from './PublicLibrary.module.css'

type PublicLibraryProps = {
  userId: number
}

/** 並び替え選択肢（更新日・評価・タイトル） */
const SORT_OPTIONS = [
  { value: 'updated_at', label: '更新日' },
  { value: 'rating', label: '評価' },
  { value: 'title_asc', label: 'タイトル' },
] as const

export function PublicLibrary({ userId }: PublicLibraryProps) {
  const { records, totalPages, isLoading, mediaType, sort, page, setMediaType, setSort, setPage } =
    useUserRecords(userId)

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value)
  }

  return (
    <section className={styles.section}>
      <SectionTitle>公開ライブラリ</SectionTitle>

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
          id="library-sort"
          value={sort}
          onChange={handleSortChange}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
      </div>

      {isLoading && <div className={styles.loading}>読み込み中...</div>}

      {!isLoading && records.length === 0 && (
        <div className={styles.empty}>公開記録はありません</div>
      )}

      {!isLoading && records.length > 0 && (
        <>
          <div className={styles.grid}>
            {records.map((record) => (
              <Link
                key={record.id}
                to={`/works/${record.work.id}`}
                className={styles.card}
                aria-label={record.work.title}
              >
                <div className={styles.coverWrapper}>
                  {record.work.cover_image_url ? (
                    <img
                      className={styles.cover}
                      src={record.work.cover_image_url}
                      alt={`${record.work.title}のカバー画像`}
                    />
                  ) : (
                    <div className={styles.coverPlaceholder} />
                  )}
                </div>
                <h3 className={styles.cardTitle}>{record.work.title}</h3>
                <div className={styles.cardMeta}>
                  {record.rating !== null && (
                    <span className={styles.rating}>★ {record.rating.toFixed(1)}</span>
                  )}
                  <span className={styles.status}>
                    {getStatusLabel(record.status, record.work.media_type)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </section>
  )
}
