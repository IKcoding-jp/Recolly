import { useState } from 'react'
import { discussionsApi } from '../../lib/discussionsApi'
import { Button } from '../ui/Button/Button'
import styles from './DiscussionCreateModal.module.css'

const TITLE_MAX_LENGTH = 100
const BODY_MAX_LENGTH = 5000

type Props = {
  workId: number
  totalEpisodes: number | null
  onClose: () => void
  onCreated: () => void
}

export function DiscussionCreateModal({ workId, totalEpisodes, onClose, onCreated }: Props) {
  const [episodeNumber, setEpisodeNumber] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [hasSpoiler, setHasSpoiler] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isTitleOver = title.length > TITLE_MAX_LENGTH
  const isBodyOver = body.length > BODY_MAX_LENGTH
  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !isTitleOver && !isBodyOver

  const handleSubmit = () => {
    if (!canSubmit || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    discussionsApi
      .create(workId, {
        title: title.trim(),
        body: body.trim(),
        episode_number: episodeNumber,
        has_spoiler: hasSpoiler,
      })
      .then(() => {
        onCreated()
        onClose()
      })
      .catch(() => {
        setError('ディスカッションの作成に失敗しました')
      })
      .finally(() => {
        setIsSubmitting(false)
      })
  }

  // 話数の選択肢を生成
  const episodeOptions: { value: number | null; label: string }[] = [
    { value: null, label: '作品全体' },
  ]
  if (totalEpisodes !== null) {
    for (let i = 1; i <= totalEpisodes; i++) {
      episodeOptions.push({ value: i, label: `第${String(i)}話` })
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>ディスカッションを作成</h3>
        </div>

        {error !== null && <div className={styles.error}>{error}</div>}

        {totalEpisodes !== null && (
          <div className={styles.field}>
            <label className={styles.label}>話数</label>
            <select
              className={styles.select}
              value={episodeNumber === null ? '' : String(episodeNumber)}
              onChange={(e) => {
                setEpisodeNumber(e.target.value === '' ? null : Number(e.target.value))
              }}
            >
              {episodeOptions.map((opt) => (
                <option key={opt.value === null ? 'all' : opt.value} value={opt.value ?? ''}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>タイトル</label>
          <input
            className={styles.input}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ディスカッションのタイトル"
            maxLength={TITLE_MAX_LENGTH + 10}
          />
          <div className={isTitleOver ? styles.charCountOver : styles.charCount}>
            {title.length}/{TITLE_MAX_LENGTH}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>本文</label>
          <textarea
            className={styles.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="ディスカッションの内容を入力"
          />
          <div className={isBodyOver ? styles.charCountOver : styles.charCount}>
            {body.length}/{BODY_MAX_LENGTH}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.checkboxLabel}>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={hasSpoiler}
              onChange={(e) => setHasSpoiler(e.target.checked)}
            />
            ネタバレを含む
          </label>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? '作成中...' : '作成'}
          </Button>
        </div>
      </div>
    </div>
  )
}
