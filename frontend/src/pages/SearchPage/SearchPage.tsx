import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { SearchResult, MediaType, RecordStatus } from '../../lib/types'
import { worksApi } from '../../lib/worksApi'
import { recordsApi } from '../../lib/recordsApi'
import { imagesApi } from '../../lib/imagesApi'
import { ApiError } from '../../lib/api'
import { FormInput } from '../../components/ui/FormInput/FormInput'
import { WorkCard } from '../../components/WorkCard/WorkCard'
import { SearchSkeleton } from '../../components/SearchSkeleton/SearchSkeleton'
import { SearchProgress } from '../../components/SearchProgress/SearchProgress'
import { ManualWorkForm } from '../../components/ManualWorkForm/ManualWorkForm'
import type { UploadResult } from '../../components/ImageUploader'
import { RecordModal } from '../../components/RecordModal/RecordModal'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { Button } from '../../components/ui/Button/Button'
import { getGenreLabel } from '../../lib/mediaTypeUtils'
import { GenreDropdown } from './GenreDropdown'
import { GENRE_FILTERS } from './genreFilters'
import type { GenreFilter } from './genreFilters'
import styles from './SearchPage.module.css'

// 日本語文字（ひらがな・カタカナ・漢字）が含まれるか判定
function containsJapanese(text: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)
}

// ゲーム検索結果が少ない＋日本語クエリ＋ゲーム関連ジャンルのとき英語検索ヒントを表示すべきか判定
function shouldShowEnglishHint(
  results: SearchResult[],
  searchQuery: string,
  genre: GenreFilter,
): boolean {
  if (genre !== 'all' && genre !== 'game') return false
  if (!containsJapanese(searchQuery)) return false
  const gameCount = results.filter((r) => r.media_type === 'game').length
  return gameCount <= 3
}

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
  // 手動登録で作成したWorkのID（Record作成時に使用）
  const [manualWorkId, setManualWorkId] = useState<number | null>(null)

  // 検索リクエストのキャンセル用 AbortController を保持する
  // 新しい検索が開始されたら古いリクエストを中断する
  const abortControllerRef = useRef<AbortController | null>(null)

  // マウント時にユーザーの記録済み作品IDリストを取得
  useEffect(() => {
    recordsApi
      .getRecordedExternalIds()
      .then((data) => setRecordedIds(new Set(data.recorded_ids)))
      .catch(() => {
        // 取得失敗時はフォールバック（空のまま）
      })
  }, [])

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    // 古いリクエストがあればキャンセルする
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    // 画面上の古い結果を即座にクリア
    setResults([])
    setIsSearching(true)
    setError('')
    setHasSearched(true)

    try {
      const mediaType = genre === 'all' ? undefined : genre
      const response = await worksApi.search(query, mediaType, { signal: controller.signal })
      // このリクエストがキャンセルされていたら結果を反映しない
      if (controller.signal.aborted) return
      setResults(response.results)
    } catch (err) {
      // AbortError（ユーザー/システムが中断した）は無視する
      if ((err as Error).name === 'AbortError') return
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('検索に失敗しました')
      }
    } finally {
      // キャンセルされていない場合のみローディングを解除
      if (!controller.signal.aborted) {
        setIsSearching(false)
      }
    }
  }

  const handleOpenModal = (work: SearchResult) => {
    setModalWork(work)
  }

  const handleConfirmRecord = async (data: { status: RecordStatus; rating: number | null }) => {
    if (!modalWork) return

    try {
      if (manualWorkId) {
        // 手動登録作品: work_idで直接Record作成
        setLoadingId('manual')
        await recordsApi.createFromWorkId(manualWorkId, data)
        setManualWorkId(null)
      } else {
        // 検索結果作品: 既存のフロー
        const workKey = `${modalWork.external_api_source}:${modalWork.external_api_id}`
        setLoadingId(workKey)
        await recordsApi.createFromSearchResult(modalWork, data)
        setRecordedIds((prev) => new Set(prev).add(workKey))
      }
      setModalWork(null)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        // 409 Conflict = 既に記録済み → UIを「記録済み」に更新
        if (err.status === 409 && modalWork) {
          const workKey = `${modalWork.external_api_source}:${modalWork.external_api_id}`
          setRecordedIds((prev) => new Set(prev).add(workKey))
          setModalWork(null)
        }
      }
    } finally {
      setLoadingId(null)
    }
  }

  const handleManualSubmit = async (
    title: string,
    mediaType: MediaType,
    description: string,
    imageData?: UploadResult,
  ) => {
    const { work } = await worksApi.create(title, mediaType, description)
    // 画像登録はbest-effort（失敗しても作品登録フローは継続する）
    if (imageData) {
      try {
        await imagesApi.create({
          s3Key: imageData.s3Key,
          fileName: imageData.fileName,
          contentType: imageData.contentType,
          fileSize: imageData.fileSize,
          imageableType: 'Work',
          imageableId: work.id,
        })
      } catch {
        // 画像登録失敗は無視してRecordModal表示に進む
      }
    }
    // 手動登録後、RecordModalを開いてステータスを選ばせる
    setManualWorkId(work.id)
    setModalWork({
      title: work.title,
      media_type: work.media_type,
      description: work.description,
      cover_image_url: work.cover_image_url,
      total_episodes: work.total_episodes,
      external_api_id: null,
      external_api_source: null,
      metadata: {},
    })
    setShowManualForm(false)
  }

  const handleGenreChange = (newGenre: GenreFilter) => {
    setGenre(newGenre)
    if (query.trim() && hasSearched) {
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      setResults([])
      setIsSearching(true)
      setError('')

      const mediaType = newGenre === 'all' ? undefined : newGenre
      worksApi
        .search(query, mediaType, { signal: controller.signal })
        .then((response) => {
          if (controller.signal.aborted) return
          setResults(response.results)
        })
        .catch((err: Error) => {
          if (err.name === 'AbortError') return
          setError('検索に失敗しました')
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearching(false)
          }
        })
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <SectionTitle>作品検索</SectionTitle>

        <form className={styles.searchForm} onSubmit={handleSearch}>
          <div className={styles.searchInputWrapper}>
            <FormInput
              label="検索"
              id="search"
              type="text"
              placeholder="作品を検索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button variant="primary" type="submit" disabled={isSearching}>
            {isSearching ? '検索中...' : '検索'}
          </Button>
        </form>

        {/* PC: ピルボタン */}
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

        {/* モバイル: ドロップダウン */}
        <GenreDropdown value={genre} onChange={handleGenreChange} />

        {error && <p className={styles.error}>{error}</p>}

        {isSearching && (
          <>
            <SearchProgress />
            <SearchSkeleton />
          </>
        )}

        {!isSearching && hasSearched && results.length === 0 && (
          <div className={styles.empty}>
            <p>作品が見つかりませんでした</p>
            <Button variant="secondary" onClick={() => setShowManualForm(true)}>
              手動で登録する
            </Button>
          </div>
        )}

        {!isSearching &&
          hasSearched &&
          results.length > 0 &&
          shouldShowEnglishHint(results, query, genre) && (
            <p className={styles.hint}>海外ゲームは英語タイトルでも検索してみてください</p>
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
          <div className={styles.manualCard}>
            <p className={styles.manualGuide}>お探しの作品が見つかりませんか？</p>
            <Button variant="secondary" onClick={() => setShowManualForm(!showManualForm)}>
              {showManualForm ? '閉じる' : '+ 手動で登録する'}
            </Button>
          </div>
          {showManualForm && <ManualWorkForm onSubmit={handleManualSubmit} />}
        </div>
      </div>

      <RecordModal
        key={
          modalWork
            ? `${modalWork.external_api_source ?? 'manual'}:${modalWork.external_api_id ?? manualWorkId}`
            : 'closed'
        }
        isOpen={modalWork !== null}
        title={modalWork?.title ?? ''}
        mediaType={modalWork?.media_type ?? 'anime'}
        mediaTypeLabel={modalWork ? getGenreLabel(modalWork.media_type) : ''}
        onConfirm={handleConfirmRecord}
        onCancel={() => {
          setModalWork(null)
          setManualWorkId(null)
        }}
        isLoading={loadingId !== null}
      />
    </div>
  )
}
