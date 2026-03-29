import { Link } from 'react-router-dom'
import { useUserRecords } from '../../hooks/useUserRecords'
import { getStatusLabel } from '../../lib/mediaTypeUtils'
import { MediaTypeFilter } from '../MediaTypeFilter/MediaTypeFilter'
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
        <MediaTypeFilter value={mediaType} onChange={setMediaType} />
        <div className={styles.sortWrapper}>
          <label htmlFor="library-sort" className={styles.sortLabel}>
            並び替え
          </label>
          <select
            id="library-sort"
            className={styles.sortSelect}
            value={sort}
            onChange={handleSortChange}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
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
