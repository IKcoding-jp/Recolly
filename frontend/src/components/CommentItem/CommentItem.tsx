import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { DiscussionComment } from '../../lib/types'
import { formatRelativeTime } from '../../lib/timeUtils'
import { DropdownMenu } from '../ui/DropdownMenu/DropdownMenu'
import styles from './CommentItem.module.css'

type Props = {
  comment: DiscussionComment
  /** 現在ログイン中のユーザーIDと一致する場合に編集・削除メニューを表示 */
  isAuthor: boolean
  onUpdate: (commentId: number, body: string) => Promise<void>
  onDelete: (commentId: number) => Promise<void>
}

export function CommentItem({ comment, isAuthor, onUpdate, onDelete }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editBody, setEditBody] = useState(comment.body)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!editBody.trim()) return
    setIsSaving(true)
    try {
      await onUpdate(comment.id, editBody.trim())
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditBody(comment.body)
    setIsEditing(false)
  }

  const handleDelete = () => {
    if (window.confirm('このコメントを削除しますか？')) {
      void onDelete(comment.id)
    }
  }

  const menuItems = [
    {
      label: '編集',
      onClick: () => {
        setEditBody(comment.body)
        setIsEditing(true)
      },
    },
    { label: '削除', onClick: handleDelete, danger: true },
  ]

  return (
    <div className={styles.comment}>
      <div className={styles.header}>
        <Link to={`/users/${String(comment.user.id)}`} className={styles.avatarLink}>
          <div className={styles.avatar}>{comment.user.username.charAt(0).toUpperCase()}</div>
        </Link>
        <div className={styles.headerInfo}>
          <Link to={`/users/${String(comment.user.id)}`} className={styles.username}>
            {comment.user.username}
          </Link>
          <span className={styles.time}>
            {formatRelativeTime(comment.created_at)}
            {comment.edited && <span className={styles.editedBadge}>（編集済み）</span>}
          </span>
        </div>
        {isAuthor && (
          <div className={styles.menu}>
            <DropdownMenu items={menuItems} />
          </div>
        )}
      </div>
      {isEditing ? (
        <div className={styles.editForm}>
          <textarea
            className={styles.editTextarea}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={3}
          />
          <div className={styles.editActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleCancel}
              disabled={isSaving}
            >
              キャンセル
            </button>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => void handleSave()}
              disabled={isSaving || !editBody.trim()}
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.body}>{comment.body}</div>
      )}
    </div>
  )
}
