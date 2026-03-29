import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import { useDiscussion } from '../../hooks/useDiscussion'
import { useComments } from '../../hooks/useComments'
import { recordsApi } from '../../lib/recordsApi'
import { formatRelativeTime } from '../../lib/timeUtils'
import { getMediaTypeLabel } from '../../lib/mediaTypeUtils'
import { Breadcrumb } from '../../components/ui/Breadcrumb/Breadcrumb'
import { SpoilerBadge } from '../../components/ui/SpoilerBadge/SpoilerBadge'
import { EpisodeBadge } from '../../components/ui/EpisodeBadge/EpisodeBadge'
import { DropdownMenu } from '../../components/ui/DropdownMenu/DropdownMenu'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { CommentItem } from '../../components/CommentItem/CommentItem'
import { CommentForm } from '../../components/CommentForm/CommentForm'
import styles from './DiscussionDetailPage.module.css'

export function DiscussionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  const discussionId = Number(id)
  const { discussion, isLoading, error, updateDiscussion, deleteDiscussion } =
    useDiscussion(discussionId)
  const {
    comments,
    totalPages,
    totalCount,
    page,
    isLoading: isCommentsLoading,
    setPage,
    addComment,
    updateComment,
    deleteComment,
  } = useComments(discussionId)

  // ログインユーザーがこの作品を記録済みかチェック
  const [hasRecord, setHasRecord] = useState(false)

  useEffect(() => {
    if (!user || !discussion) return
    let cancelled = false
    const checkRecord = async () => {
      try {
        const res = await recordsApi.getAll({ workId: discussion.work.id })
        if (!cancelled) setHasRecord(res.records.length > 0)
      } catch {
        // 未ログインまたはエラー時は記録なしとして扱う
      }
    }
    void checkRecord()
    return () => {
      cancelled = true
    }
  }, [user, discussion])

  // スレッド編集モード
  const [isEditingThread, setIsEditingThread] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [isSavingThread, setIsSavingThread] = useState(false)

  const isThreadAuthor = user !== null && discussion !== null && user.id === discussion.user.id

  const handleEditThread = () => {
    if (!discussion) return
    setEditTitle(discussion.title)
    setEditBody(discussion.body)
    setIsEditingThread(true)
  }

  const handleSaveThread = async () => {
    if (!editTitle.trim() || !editBody.trim()) return
    setIsSavingThread(true)
    try {
      await updateDiscussion({ title: editTitle.trim(), body: editBody.trim() })
      setIsEditingThread(false)
    } finally {
      setIsSavingThread(false)
    }
  }

  const handleCancelEditThread = () => {
    setIsEditingThread(false)
  }

  const handleDeleteThread = () => {
    if (window.confirm('このスレッドを削除しますか？')) {
      void deleteDiscussion()
        .then(() => {
          void navigate('/community')
        })
        .catch(() => {
          setError('削除に失敗しました')
        })
    }
  }

  const threadMenuItems = [
    { label: '編集', onClick: handleEditThread },
    { label: '削除', onClick: handleDeleteThread, danger: true },
  ]

  // ローディング中
  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    )
  }

  // エラー
  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>{error}</div>
      </div>
    )
  }

  // ディスカッションが見つからない
  if (!discussion) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>ディスカッションが見つかりませんでした</div>
      </div>
    )
  }

  const { work } = discussion

  return (
    <div className={styles.page}>
      {/* パンくずリスト */}
      <Breadcrumb
        items={[
          { label: 'コミュニティ', path: '/community' },
          { label: work.title, path: `/works/${String(work.id)}` },
          { label: discussion.title },
        ]}
      />

      {/* 作品情報バー */}
      <Link to={`/works/${String(work.id)}`} className={styles.workBar}>
        <div className={styles.workCoverWrapper}>
          {work.cover_image_url ? (
            <img className={styles.workCover} src={work.cover_image_url} alt={work.title} />
          ) : (
            <div className={styles.workCoverPlaceholder} />
          )}
        </div>
        <div className={styles.workInfo}>
          <span className={styles.workTitle}>{work.title}</span>
          <div className={styles.workMeta}>
            <span className={styles.genreBadge}>{getMediaTypeLabel(work.media_type)}</span>
            <EpisodeBadge episodeNumber={discussion.episode_number} />
            {discussion.has_spoiler && <SpoilerBadge />}
          </div>
        </div>
      </Link>

      {/* スレッド本文 */}
      <div className={styles.thread}>
        <div className={styles.threadHeader}>
          <Link to={`/users/${String(discussion.user.id)}`} className={styles.threadAvatarLink}>
            <div className={styles.avatar}>{discussion.user.username.charAt(0).toUpperCase()}</div>
          </Link>
          <div className={styles.threadHeaderInfo}>
            <Link to={`/users/${String(discussion.user.id)}`} className={styles.threadAuthor}>
              {discussion.user.username}
            </Link>
            <span className={styles.threadTime}>{formatRelativeTime(discussion.created_at)}</span>
          </div>
          {isThreadAuthor && (
            <div className={styles.threadMenu}>
              <DropdownMenu items={threadMenuItems} />
            </div>
          )}
        </div>

        {isEditingThread ? (
          <div className={styles.threadEditForm}>
            <input
              type="text"
              className={styles.threadEditTitle}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="タイトル"
            />
            <textarea
              className={styles.threadEditBody}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={5}
              placeholder="本文"
            />
            <div className={styles.threadEditActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleCancelEditThread}
                disabled={isSavingThread}
              >
                キャンセル
              </button>
              <button
                type="button"
                className={styles.saveButton}
                onClick={() => void handleSaveThread()}
                disabled={isSavingThread || !editTitle.trim() || !editBody.trim()}
              >
                {isSavingThread ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.threadContent}>
            <h1 className={styles.threadTitle}>{discussion.title}</h1>
            <div className={styles.threadBody}>{discussion.body}</div>
          </div>
        )}
      </div>

      {/* コメントセクション */}
      <div className={styles.commentsSection}>
        <h2 className={styles.commentsHeading}>コメント（{totalCount}）</h2>

        {isCommentsLoading && <div className={styles.loading}>読み込み中...</div>}

        {!isCommentsLoading && comments.length === 0 && (
          <div className={styles.emptyComments}>まだコメントはありません</div>
        )}

        {!isCommentsLoading && comments.length > 0 && (
          <div className={styles.commentList}>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                isAuthor={user !== null && user.id === comment.user.id}
                onUpdate={updateComment}
                onDelete={deleteComment}
              />
            ))}
          </div>
        )}

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* コメントフォーム */}
      <CommentForm
        isAuthenticated={isAuthenticated}
        hasRecord={hasRecord}
        workId={work.id}
        onSubmit={addComment}
      />
    </div>
  )
}
