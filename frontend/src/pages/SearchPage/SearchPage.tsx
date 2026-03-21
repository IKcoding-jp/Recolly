import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SearchResult, MediaType, RecordStatus } from '../../lib/types'
import { worksApi } from '../../lib/worksApi'
import { recordsApi } from '../../lib/recordsApi'
import { ApiError } from '../../lib/api'
import { WorkCard } from '../../components/WorkCard/WorkCard'
import { ManualWorkForm } from '../../components/ManualWorkForm/ManualWorkForm'
import { RecordModal } from '../../components/RecordModal/RecordModal'
import { Typography } from '../../components/ui/Typography/Typography'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { Button } from '../../components/ui/Button/Button'
import styles from './SearchPage.module.css'

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  anime: 'アニメ',
  movie: '映画',
  drama: 'ドラマ',
  book: '本',
  manga: '漫画',
  game: 'ゲーム',
}

type GenreFilter = MediaType | 'all'

const GENRE_FILTERS: { value: GenreFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'anime', label: 'アニメ' },
  { value: 'movie', label: '映画' },
  { value: 'drama', label: 'ドラマ' },
  { value: 'book', label: '本' },
  { value: 'manga', label: '漫画' },
  { value: 'game', label: 'ゲーム' },
]

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState<GenreFilter>('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set())
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState('')
  const [showManualForm, setShowManualForm] = useState(false)
  const [modalWork, setModalWork] = useState<SearchResult | null>(null)

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsSearching(true)
    setError('')
    setHasSearched(true)

    try {
      const mediaType = genre === 'all' ? undefined : genre
      const response = await worksApi.search(query, mediaType)
      setResults(response.results)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('検索に失敗しました')
      }
    } finally {
      setIsSearching(false)
    }
  }

  const handleOpenModal = (work: SearchResult) => {
    setModalWork(work)
  }

  const handleConfirmRecord = async (data: { status: RecordStatus; rating: number | null }) => {
    if (!modalWork) return
    const workKey = `${modalWork.external_api_source}:${modalWork.external_api_id}`
    setLoadingId(workKey)
    try {
      await recordsApi.createFromSearchResult(modalWork, data)
      setRecordedIds((prev) => new Set(prev).add(workKey))
      setModalWork(null)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      }
    } finally {
      setLoadingId(null)
    }
  }

  const handleManualSubmit = async (title: string, mediaType: MediaType, description: string) => {
    await worksApi.create(title, mediaType, description)
    setShowManualForm(false)
  }

  const handleGenreChange = (newGenre: GenreFilter) => {
    setGenre(newGenre)
    if (query.trim() && hasSearched) {
      setIsSearching(true)
      setError('')
      const mediaType = newGenre === 'all' ? undefined : newGenre
      worksApi
        .search(query, mediaType)
        .then((response) => setResults(response.results))
        .catch(() => setError('検索に失敗しました'))
        .finally(() => setIsSearching(false))
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Typography variant="h2">作品検索</Typography>

        <form className={styles.searchForm} onSubmit={handleSearch}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="作品を検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button variant="primary" type="submit" disabled={isSearching}>
            {isSearching ? '検索中...' : '検索'}
          </Button>
        </form>

        <div className={styles.filters}>
          {GENRE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              className={`${styles.filterButton} ${genre === filter.value ? styles.filterActive : ''}`}
              onClick={() => handleGenreChange(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {isSearching && <p className={styles.loading}>検索中...</p>}

        {!isSearching && hasSearched && results.length === 0 && (
          <div className={styles.empty}>
            <p>作品が見つかりませんでした</p>
            <Button variant="secondary" onClick={() => setShowManualForm(true)}>
              手動で登録する
            </Button>
          </div>
        )}

        {results.length > 0 && (
          <div className={styles.results}>
            {results.map((work) => {
              const workKey = `${work.external_api_source}:${work.external_api_id}`
              return (
                <WorkCard
                  key={workKey}
                  work={work}
                  onRecord={handleOpenModal}
                  isRecorded={recordedIds.has(workKey)}
                  isLoading={loadingId === workKey}
                />
              )
            })}
          </div>
        )}

        <div className={styles.manualSection}>
          <SectionTitle>手動登録</SectionTitle>
          <Button variant="ghost" onClick={() => setShowManualForm(!showManualForm)}>
            {showManualForm ? '閉じる' : '作品を手動で登録する'}
          </Button>
          {showManualForm && <ManualWorkForm onSubmit={handleManualSubmit} />}
        </div>
      </div>

      <RecordModal
        isOpen={modalWork !== null}
        title={modalWork?.title ?? ''}
        mediaType={modalWork ? MEDIA_TYPE_LABELS[modalWork.media_type] : ''}
        onConfirm={handleConfirmRecord}
        onCancel={() => setModalWork(null)}
        isLoading={loadingId !== null}
      />
    </div>
  )
}
