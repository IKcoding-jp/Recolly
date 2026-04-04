import { useState, useCallback, useRef, useEffect } from 'react'
import { useTags } from '../../hooks/useTags'
import { Button } from '../ui/Button/Button'
import { FormInput } from '../ui/FormInput/FormInput'
import type { Tag } from '../../lib/types'
import styles from './TagSection.module.css'

type TagSectionProps = {
  recordId: number
  initialTags: Tag[]
}

export function TagSection({ recordId, initialTags }: TagSectionProps) {
  const { tags, allTags, isLoading, addTag, removeTag } = useTags(recordId, initialTags)
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 付与済みタグを除外した候補をフィルタリング
  const assignedIds = new Set(tags.map((t) => t.id))
  const suggestions = inputValue.trim()
    ? allTags.filter((t) => !assignedIds.has(t.id) && t.name.includes(inputValue.trim()))
    : []

  // コンテナ外クリックで候補を閉じる
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleAdd = useCallback(
    async (name: string) => {
      if (!name.trim() || isSubmitting) return
      setIsSubmitting(true)
      try {
        await addTag(name)
        setInputValue('')
        setShowSuggestions(false)
      } finally {
        setIsSubmitting(false)
      }
    },
    [addTag, isSubmitting],
  )

  const handleRemove = useCallback(
    (tagId: number) => {
      void removeTag(tagId)
    },
    [removeTag],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        void handleAdd(inputValue)
      }
    },
    [handleAdd, inputValue],
  )

  if (isLoading) {
    return <div className={styles.emptyText}>読み込み中...</div>
  }

  return (
    <div className={styles.container} ref={containerRef}>
      {tags.length > 0 ? (
        <div className={styles.tagList}>
          {tags.map((tag) => (
            <span key={tag.id} className={styles.tag}>
              {tag.name}
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => handleRemove(tag.id)}
                aria-label={`${tag.name}を削除`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className={styles.emptyText}>タグなし</div>
      )}

      <div className={styles.form}>
        <div className={styles.inputWrapper}>
          <FormInput
            label="タグ"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="タグを追加..."
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={isSubmitting || !inputValue.trim()}
          onClick={() => void handleAdd(inputValue)}
        >
          追加
        </Button>

        {showSuggestions && suggestions.length > 0 && (
          <div className={styles.suggestions}>
            {suggestions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={styles.suggestion}
                onClick={() => void handleAdd(tag.name)}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
