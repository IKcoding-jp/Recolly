import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Discussion } from '../../lib/types'
import { discussionsApi } from '../../lib/discussionsApi'
import { SectionTitle } from '../ui/SectionTitle/SectionTitle'
import { DiscussionCard } from '../DiscussionCard/DiscussionCard'
import { DiscussionCreateModal } from '../DiscussionCreateModal/DiscussionCreateModal'
import { FormSelect } from '../ui/FormSelect/FormSelect'
import { Button } from '../ui/Button/Button'
import styles from './DiscussionSection.module.css'

/** 作品詳細ページ内に表示する最新3件のディスカッション数 */
const DISPLAY_COUNT = 3

type Props = {
  workId: number
  totalEpisodes: number | null
  hasRecord: boolean
}

export function DiscussionSection({ workId, totalEpisodes, hasRecord }: Props) {
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [episodeFilter, setEpisodeFilter] = useState<number | undefined>(undefined)
  const [showCreateModal, setShowCreateModal] = useState(false)
  // 新規作成後に一覧を再取得するためのカウンター
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const fetchData = async () => {
      try {
        const res = await discussionsApi.getByWork(workId, {
          episodeNumber: episodeFilter,
          perPage: DISPLAY_COUNT,
        })
        if (!cancelled) {
          setDiscussions(res.discussions)
        }
      } catch {
        // API取得失敗時は空配列のまま
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }
    void fetchData()
    return () => {
      cancelled = true
    }
  }, [workId, episodeFilter, refreshKey])

  const handleCreated = () => {
    setRefreshKey((prev) => prev + 1)
  }

  // 話数フィルターの選択肢を生成（FormSelectはstring型のvalueを受け取る）
  const episodeOptions: { value: string; label: string }[] = [{ value: '', label: 'すべて' }]
  if (totalEpisodes !== null) {
    for (let i = 1; i <= totalEpisodes; i++) {
      episodeOptions.push({ value: String(i), label: `第${String(i)}話` })
    }
  }

  // hasRecordがtrueなら認証済み+記録済みは自明（記録にはログインが必要なため）
  const canCreate = hasRecord

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <SectionTitle>DISCUSSIONS</SectionTitle>
        <div className={styles.filters}>
          {totalEpisodes !== null && (
            <div className={styles.filterWrapper}>
              <FormSelect
                value={episodeFilter === undefined ? '' : String(episodeFilter)}
                onChange={(e) => {
                  setEpisodeFilter(e.target.value === '' ? undefined : Number(e.target.value))
                }}
                options={episodeOptions}
              />
            </div>
          )}
          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setShowCreateModal(true)
              }}
            >
              投稿する
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading}>読み込み中...</div>
      ) : discussions.length === 0 ? (
        <div className={styles.empty}>ディスカッションはまだありません</div>
      ) : (
        <>
          <div className={styles.list}>
            {discussions.map((d) => (
              <DiscussionCard key={d.id} discussion={d} showWorkInfo={false} />
            ))}
          </div>
          <Link to={`/community?work_id=${String(workId)}`} className={styles.viewAllLink}>
            すべてのディスカッションを見る →
          </Link>
        </>
      )}

      {showCreateModal && (
        <DiscussionCreateModal
          workId={workId}
          totalEpisodes={totalEpisodes}
          onClose={() => {
            setShowCreateModal(false)
          }}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
