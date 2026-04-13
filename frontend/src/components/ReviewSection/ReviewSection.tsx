import { useState, useEffect, useCallback } from 'react'
import { Button } from '../ui/Button/Button'
import { FormTextarea } from '../ui/FormTextarea/FormTextarea'
import styles from './ReviewSection.module.css'

type ReviewSectionProps = {
  reviewText: string | null
  onSave: (text: string) => Promise<void> | void
}

type Mode = 'empty' | 'view' | 'edit'

const EDIT_ROWS = 8
const SAVE_ERROR_MESSAGE = '保存に失敗しました。もう一度お試しください。'

const computeInitialMode = (reviewText: string | null): Mode => (reviewText ? 'view' : 'empty')

export function ReviewSection({ reviewText, onSave }: ReviewSectionProps) {
  const [mode, setMode] = useState<Mode>(() => computeInitialMode(reviewText))
  const [draft, setDraft] = useState<string>(reviewText ?? '')
  const [isSaving, setIsSaving] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Task 6 のエラー表示実装で JSX に描画予定
  const [saveError, setSaveError] = useState<string | null>(null)

  // 親から reviewText が変わった時、編集中でなければ追従する
  useEffect(() => {
    if (mode !== 'edit') {
      setMode(computeInitialMode(reviewText))
      setDraft(reviewText ?? '')
    }
    // mode を依存配列に含めない: 編集中に mode が変わるたびに再同期するのを避けるため
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewText])

  const handleStartEdit = useCallback(() => {
    setDraft(reviewText ?? '')
    setSaveError(null)
    setMode('edit')
  }, [reviewText])

  const handleCancel = useCallback(() => {
    setDraft(reviewText ?? '')
    setSaveError(null)
    setMode(computeInitialMode(reviewText))
  }, [reviewText])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveError(null)
    try {
      await onSave(draft)
      // 保存成功: edit モードを抜けて、draft の内容に応じて view / empty に遷移
      // useEffect は mode === 'edit' の時は同期をスキップするため、ここで明示的に遷移する
      // 親の reviewText 更新と一緒にバッチされるので、中間状態は描画されない
      setMode(draft ? 'view' : 'empty')
    } catch {
      setSaveError(SAVE_ERROR_MESSAGE)
    } finally {
      setIsSaving(false)
    }
  }, [draft, onSave])

  if (mode === 'empty') {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyMessage}>まだ感想が書かれていません</p>
        <Button variant="primary" size="sm" onClick={handleStartEdit}>
          感想を書く
        </Button>
      </div>
    )
  }

  // 現時点では edit は後続 Task で動作検証する暫定実装
  if (mode === 'edit') {
    return (
      <div className={styles.container}>
        <FormTextarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="作品の感想を書く..."
          rows={EDIT_ROWS}
        />
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={handleCancel} disabled={isSaving}>
            キャンセル
          </Button>
          <Button variant="primary" size="sm" disabled={isSaving} onClick={() => void handleSave()}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    )
  }

  // view モード
  return (
    <div className={styles.viewContainer}>
      <div className={styles.viewActions}>
        <Button variant="secondary" size="sm" onClick={handleStartEdit}>
          編集
        </Button>
      </div>
      <p className={styles.viewText}>{reviewText}</p>
    </div>
  )
}
