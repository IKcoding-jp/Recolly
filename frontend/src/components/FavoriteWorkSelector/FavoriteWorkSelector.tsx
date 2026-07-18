import { useEffect, useState } from 'react'
import type { MediaType, PublicRecord, WorkSummary } from '../../lib/types'
import { request } from '../../lib/api'
import { GenreFilterTabs } from '../ui/GenreFilterTabs/GenreFilterTabs'
import { SearchInput } from '../ui/SearchInput/SearchInput'
import styles from './FavoriteWorkSelector.module.css'

type FavoriteWorkSelectorProps = {
  isOpen: boolean
  onClose: () => void
  onSelect: (work: WorkSummary) => void
  excludeWorkIds: number[]
}

export function FavoriteWorkSelector({
  isOpen,
  onClose,
  onSelect,
  excludeWorkIds,
}: FavoriteWorkSelectorProps) {
  const [records, setRecords] = useState<PublicRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mediaType, setMediaType] = useState<MediaType | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setIsLoading(true)

    const fetchRecords = async () => {
      try {
        const params = new URLSearchParams({ per_page: '100' })
        if (mediaType) params.set('media_type', mediaType)
        const res = await request<{ records: PublicRecord[] }>(`/records?${params.toString()}`)
        setRecords(res.records)
      } catch {
        setRecords([])
      } finally {
        setIsLoading(false)
      }
    }

    void fetchRecords()
  }, [isOpen, mediaType])

  if (!isOpen) return null

  const filtered = records.filter((r) => {
    if (excludeWorkIds.includes(r.work.id)) return false
    if (searchQuery) {
      return r.work.title.toLowerCase().includes(searchQuery.toLowerCase())
    }
    return true
  })

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>作品を選択</h3>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            x
          </button>
        </div>

        <div className={styles.searchArea}>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="作品名で絞り込み..."
            aria-label="作品名で絞り込み"
          />
        </div>

        <div className={styles.genreFilters}>
          <GenreFilterTabs
            value={mediaType ?? 'all'}
            onChange={(value) => setMediaType(value === 'all' ? null : value)}
          />
        </div>

        <div className={styles.workGrid}>
          {isLoading ? (
            <p className={styles.loadingText}>読み込み中...</p>
          ) : filtered.length === 0 ? (
            <p className={styles.emptyText}>
              {records.length === 0
                ? 'ライブラリに作品を追加してから設定してください'
                : '該当する作品がありません'}
            </p>
          ) : (
            filtered.map((r) => (
              <button
                key={r.work.id}
                type="button"
                className={styles.workCard}
                onClick={() => onSelect(r.work)}
              >
                {r.work.cover_image_url ? (
                  <img
                    className={styles.workCover}
                    src={r.work.cover_image_url}
                    alt={r.work.title}
                  />
                ) : (
                  <div className={styles.workCoverPlaceholder}>{r.work.title.charAt(0)}</div>
                )}
                <span className={styles.workName}>{r.work.title}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
