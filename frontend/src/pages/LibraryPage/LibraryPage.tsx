import { useNavigate } from 'react-router-dom'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { StatusFilter } from '../../components/StatusFilter/StatusFilter'
import { MediaTypeFilter } from '../../components/MediaTypeFilter/MediaTypeFilter'
import { SortSelector } from '../../components/SortSelector/SortSelector'
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

  return (
    <div className={styles.page}>
      <SectionTitle>マイライブラリ</SectionTitle>

      <div className={styles.filters}>
        <StatusFilter value={status} onChange={setStatus} />
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
