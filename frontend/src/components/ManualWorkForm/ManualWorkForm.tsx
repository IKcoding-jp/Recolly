import { useState } from 'react'
import type { FormEvent } from 'react'
import type { MediaType } from '../../lib/types'
import { ImageUploader } from '../ImageUploader'
import type { UploadResult } from '../ImageUploader'
import { Button } from '../ui/Button/Button'
import styles from './ManualWorkForm.module.css'

type ManualWorkFormProps = {
  onSubmit: (
    title: string,
    mediaType: MediaType,
    description: string,
    imageData?: UploadResult,
  ) => Promise<void>
}

const MEDIA_TYPE_OPTIONS: { value: MediaType; label: string }[] = [
  { value: 'anime', label: 'アニメ' },
  { value: 'movie', label: '映画' },
  { value: 'drama', label: 'ドラマ' },
  { value: 'book', label: '本' },
  { value: 'manga', label: '漫画' },
  { value: 'game', label: 'ゲーム' },
]

export function ManualWorkForm({ onSubmit }: ManualWorkFormProps) {
  const [title, setTitle] = useState('')
  const [mediaType, setMediaType] = useState<MediaType>('anime')
  const [description, setDescription] = useState('')
  const [imageData, setImageData] = useState<UploadResult | undefined>(undefined)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('タイトルを入力してください')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(title, mediaType, description, imageData)
      setTitle('')
      setDescription('')
      setImageData(undefined)
    } catch {
      setError('登録に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="manual-title">タイトル</label>
        <input
          id="manual-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="manual-media-type">ジャンル</label>
        <select
          id="manual-media-type"
          value={mediaType}
          onChange={(e) => setMediaType(e.target.value as MediaType)}
        >
          {MEDIA_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label>カバー画像（任意）</label>
        <ImageUploader
          onUploadComplete={(result) => setImageData(result)}
          onRemove={() => setImageData(undefined)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="manual-description">説明（任意）</label>
        <textarea
          id="manual-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <Button variant="secondary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? '登録中...' : '登録する'}
      </Button>
    </form>
  )
}
