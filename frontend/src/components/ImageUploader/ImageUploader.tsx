import { useState, useRef, useCallback } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { imagesApi } from '../../lib/imagesApi'
import styles from './ImageUploader.module.css'

// アップロード完了時に親コンポーネントへ渡すデータ
export type UploadResult = {
  s3Key: string
  fileName: string
  contentType: string
  fileSize: number
}

type ImageUploaderProps = {
  onUploadComplete: (result: UploadResult) => void
  onRemove: () => void
  existingImageUrl?: string
}

// バリデーション定数
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

type UploaderState = 'idle' | 'uploading' | 'done' | 'error'

export function ImageUploader({
  onUploadComplete,
  onRemove,
  existingImageUrl,
}: ImageUploaderProps) {
  const [state, setState] = useState<UploaderState>(existingImageUrl ? 'done' : 'idle')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingImageUrl ?? null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ファイルのバリデーション
  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return '対応していないファイル形式です。JPEG、PNG、GIF、WebPのみ対応しています。'
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。'
    }
    return null
  }

  // アップロード処理（presign取得 → S3アップロード）
  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setState('error')
        setErrorMessage(validationError)
        return
      }

      // プレビュー画像を表示
      const objectUrl = URL.createObjectURL(file)
      setPreviewUrl(objectUrl)
      setState('uploading')
      setProgress(0)

      try {
        // 1. 署名付きURLを取得
        const { presigned_url, s3_key } = await imagesApi.presign(file.name, file.type, file.size)

        // 2. S3にアップロード（プログレス付き）
        await imagesApi.uploadToS3(presigned_url, file, (percent) => {
          setProgress(percent)
        })

        // 3. 完了状態にして親に通知
        setState('done')
        onUploadComplete({
          s3Key: s3_key,
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        })
      } catch {
        setState('error')
        setErrorMessage('アップロードに失敗しました。もう一度お試しください。')
        URL.revokeObjectURL(objectUrl)
        setPreviewUrl(null)
      }
    },
    [onUploadComplete],
  )

  // ファイル選択ダイアログからの選択
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void uploadFile(file)
    }
    // 同じファイルを再選択できるようにリセット
    e.target.value = ''
  }

  // ドラッグ&ドロップ
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      void uploadFile(file)
    }
  }

  // 画像を削除してidle状態に戻す
  const handleRemove = () => {
    if (previewUrl && !existingImageUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setState('idle')
    setProgress(0)
    setErrorMessage('')
    onRemove()
  }

  // idle状態に戻す（エラーからの復帰）
  const handleRetry = () => {
    setState('idle')
    setErrorMessage('')
    setProgress(0)
  }

  // --- idle: ドロップゾーン表示 ---
  if (state === 'idle') {
    return (
      <div>
        <div
          className={`${styles.dropzone} ${isDragOver ? styles.dropzoneDragOver : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              fileInputRef.current?.click()
            }
          }}
        >
          <span className={styles.dropzoneText}>ドラッグ&ドロップ</span>
          <span className={styles.dropzoneLink}>ファイルを選択</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className={styles.hiddenInput}
          onChange={handleFileChange}
        />
      </div>
    )
  }

  // --- uploading: プログレスバー表示 ---
  if (state === 'uploading') {
    return (
      <div className={styles.uploading}>
        <span className={styles.uploadingText}>アップロード中...</span>
        <div className={styles.progressBarOuter}>
          <div className={styles.progressBarInner} style={{ width: `${progress}%` }} />
        </div>
        <span className={styles.progressPercent}>{progress}%</span>
      </div>
    )
  }

  // --- done: プレビュー + 削除リンク ---
  if (state === 'done') {
    return (
      <div className={styles.done}>
        {previewUrl && (
          <img src={previewUrl} alt="カバー画像プレビュー" className={styles.preview} />
        )}
        <div className={styles.doneInfo}>
          <span className={styles.doneText}>アップロード完了</span>
          <button type="button" className={styles.removeLink} onClick={handleRemove}>
            画像を削除
          </button>
        </div>
      </div>
    )
  }

  // --- error: エラーメッセージ + 再試行リンク ---
  return (
    <div className={styles.errorContainer}>
      <span className={styles.errorText}>{errorMessage}</span>
      <button type="button" className={styles.retryLink} onClick={handleRetry}>
        もう一度試す
      </button>
    </div>
  )
}
