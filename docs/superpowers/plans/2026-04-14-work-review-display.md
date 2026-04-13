# 作品詳細 感想タブ 表示/編集モード化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 作品詳細ページの `ReviewSection` を empty / view / edit の 3 モードに分離し、感想の全文展開表示とインライン編集切り替えを実現する。

**Architecture:** `ReviewSection.tsx` 内で `mode` ステートを分岐。外部 Props（`reviewText`, `onSave`）は不変。保存エラー伝播のため `useWorkDetail.handleReviewTextSave` のみ微修正（`updateRecord` のエラー握りつぶしを経由しないように直接 `recordsApi.update` を呼ぶ）。データモデル・バックエンド非変更。

**Tech Stack:** React 19 / TypeScript / Vitest + React Testing Library / CSS Modules（`tokens.css` 準拠）

**Spec:** `docs/superpowers/specs/2026-04-14-work-review-display-design.md`
**Issue:** IKcoding-jp/Recolly#146

---

## 設計判断サマリ

| 判断事項 | 決定 | 理由 |
|---|---|---|
| 単一感想 vs 複数感想 | 単一感想（現状維持） | スペックで確定。データモデル非変更 |
| 編集モード切替方式 | インライン切替 | モーダル/別ページは過剰。既存実装に近い |
| 書式対応 | プレーンテキスト + 改行保持（`white-space: pre-wrap`） | YAGNI。Markdown は別スコープ |
| 空状態 | 「感想を書く」ボタン付きメッセージ | Recolly 既存 EmptyState パターン（`WorkDetailPage.module.css` の `.empty` 等）と揃える |
| エラー表示方法 | インラインで赤字メッセージ 1 行（`ActionErrorCard` は使わない） | 編集中のインライン表示として `ActionErrorCard` はタイトル付きで重い |
| **`useWorkDetail` の修正** | **`handleReviewTextSave` のみ、`updateRecord` を経由せず `recordsApi.update` を直接呼ぶ形に変更** | `updateRecord` は try/catch でエラーを握りつぶす設計なので、現状のままでは `ReviewSection` 側のエラー処理が発火しない。他の handler（status/rating 等）への影響を避けるため、`handleReviewTextSave` のみ局所的に修正 |
| `WorkDetailPage.tsx` の変更 | なし | Props 不変のため |
| キャンセル確認 | なし（無言で破棄） | 他の編集 UI と一貫性 |

---

## File Structure

**修正:**

- `frontend/src/components/ReviewSection/ReviewSection.tsx` — 3モード分岐に書き換え
- `frontend/src/components/ReviewSection/ReviewSection.module.css` — 空状態・表示モード・エラー表示のスタイル追加
- `frontend/src/components/ReviewSection/ReviewSection.test.tsx` — 全面書き換え（既存 5 テスト → 新 19 テスト）
- `frontend/src/pages/WorkDetailPage/useWorkDetail.ts` — `handleReviewTextSave` を直接 `recordsApi.update` 呼び出しに変更

**新規作成:**

なし

**変更しないファイル（重要）:**

- `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`
- バックエンド全般

---

## Task 1: `useWorkDetail.handleReviewTextSave` でエラーを伝播させる

**Files:**
- Modify: `frontend/src/pages/WorkDetailPage/useWorkDetail.ts`

このタスクは ReviewSection のエラーハンドリングが機能するための前提。`updateRecord` の共通化を外して、`handleReviewTextSave` では `recordsApi.update` を直接呼び、エラーを呼び出し元に throw させる。

- [ ] **Step 1: `useWorkDetail.ts` の `handleReviewTextSave` を直接呼び出しに変更**

修正箇所: `frontend/src/pages/WorkDetailPage/useWorkDetail.ts:118-123`

変更前:

```typescript
const handleReviewTextSave = useCallback(
  async (text: string) => {
    await updateRecord({ review_text: text })
  },
  [updateRecord],
)
```

変更後:

```typescript
const handleReviewTextSave = useCallback(
  async (text: string) => {
    if (!state.record) return
    // 注意: updateRecord を経由するとエラーが握りつぶされるので、
    // ReviewSection 側でエラー表示できるように直接呼び出して例外を伝播させる
    const res = await recordsApi.update(state.record.id, { review_text: text })
    setState((prev) => ({ ...prev, record: res.record }))
  },
  [state.record],
)
```

- [ ] **Step 2: TypeScript チェックが通ることを確認**

Run: `cd frontend && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 既存の `WorkDetailPage.test.tsx` を実行して回帰がないことを確認**

Run: `cd frontend && npx vitest run src/pages/WorkDetailPage/WorkDetailPage.test.tsx`
Expected: 全パス

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/WorkDetailPage/useWorkDetail.ts
git commit -m "fix(frontend): 感想保存エラーを ReviewSection に伝播させる"
```

---

## Task 2: `ReviewSection` を empty モード対応に書き換え（既存テスト全削除）

**Files:**
- Modify: `frontend/src/components/ReviewSection/ReviewSection.tsx`
- Modify: `frontend/src/components/ReviewSection/ReviewSection.test.tsx`
- Modify: `frontend/src/components/ReviewSection/ReviewSection.module.css`

ここで 3 モードの骨組みを入れ、empty モードを実装する。既存テストは全て新設計に合わないため削除し、新テストを追加する方式。

- [ ] **Step 1: テストファイルを全面書き換え（empty モードの 5 テスト）**

`frontend/src/components/ReviewSection/ReviewSection.test.tsx` の内容を以下で置き換える:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReviewSection } from './ReviewSection'

describe('ReviewSection', () => {
  let mockOnSave: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnSave = vi.fn().mockResolvedValue(undefined)
  })

  describe('empty モード', () => {
    it('reviewText が null の時、空状態メッセージが表示される', () => {
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      expect(screen.getByText('まだ感想が書かれていません')).toBeInTheDocument()
    })

    it('reviewText が空文字の時、空状態メッセージが表示される', () => {
      render(<ReviewSection reviewText="" onSave={mockOnSave} />)
      expect(screen.getByText('まだ感想が書かれていません')).toBeInTheDocument()
    })

    it('「感想を書く」ボタンが表示される', () => {
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      expect(screen.getByRole('button', { name: '感想を書く' })).toBeInTheDocument()
    })

    it('「感想を書く」クリックで編集モードに切り替わる', async () => {
      const user = userEvent.setup()
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '感想を書く' }))
      expect(screen.getByPlaceholderText('作品の感想を書く...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    })

    it('空状態では「編集」「保存」ボタンが表示されない', () => {
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      expect(screen.queryByRole('button', { name: '編集' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: テスト実行して全 5 テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/components/ReviewSection`
Expected: FAIL（「まだ感想が書かれていません」要素が見つからない、等）

- [ ] **Step 3: `ReviewSection.tsx` を empty モード + 基本骨組みで書き換え**

`frontend/src/components/ReviewSection/ReviewSection.tsx` を以下で置き換える:

```typescript
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

const computeInitialMode = (reviewText: string | null): Mode =>
  reviewText ? 'view' : 'empty'

export function ReviewSection({ reviewText, onSave }: ReviewSectionProps) {
  const [mode, setMode] = useState<Mode>(() => computeInitialMode(reviewText))
  const [draft, setDraft] = useState<string>(reviewText ?? '')
  const [isSaving, setIsSaving] = useState(false)
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

  // 現時点では view/edit は後続 Task で実装する暫定的な表示
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
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            disabled={isSaving}
          >
            キャンセル
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={isSaving}
            onClick={() => void handleSave()}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    )
  }

  // view モード（Task 3 で本実装）
  return null
}
```

- [ ] **Step 4: CSS に空状態と `actions` の gap 追加**

`frontend/src/components/ReviewSection/ReviewSection.module.css` を以下で置き換える:

```css
.container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* FormTextareaのボトムラインをアウトラインに上書き */
.container textarea {
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-sm);
  padding: var(--spacing-md);
  min-height: 160px;
  background: var(--color-bg-white);
}

.container textarea:focus {
  border-color: var(--color-text);
  border-bottom-color: var(--color-text);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

/* empty モード */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl);
  border: var(--border-width-thin) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-bg-white);
}

.emptyMessage {
  margin: 0;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
}
```

- [ ] **Step 5: テスト実行、empty モードの 5 テストが全パスすることを確認**

Run: `cd frontend && npx vitest run src/components/ReviewSection`
Expected: PASS 5, FAIL 0

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ReviewSection/
git commit -m "feat(frontend): ReviewSection の empty モードを実装"
```

---

## Task 3: view モード実装（表示・編集遷移）

**Files:**
- Modify: `frontend/src/components/ReviewSection/ReviewSection.tsx`
- Modify: `frontend/src/components/ReviewSection/ReviewSection.test.tsx`
- Modify: `frontend/src/components/ReviewSection/ReviewSection.module.css`

- [ ] **Step 1: view モードのテストを追加**

`ReviewSection.test.tsx` の `describe('empty モード', ...)` の後に、以下の `describe` ブロックを追加:

```typescript
  describe('view モード', () => {
    it('reviewText に値がある時、本文が表示される', () => {
      render(<ReviewSection reviewText="素晴らしい作品" onSave={mockOnSave} />)
      expect(screen.getByText('素晴らしい作品')).toBeInTheDocument()
    })

    it('改行を含むテキストで pre-wrap スタイルが適用される', () => {
      const text = '1行目\n2行目\n3行目'
      const { container } = render(
        <ReviewSection reviewText={text} onSave={mockOnSave} />,
      )
      const textEl = container.querySelector('p')
      expect(textEl?.textContent).toBe(text)
      expect(textEl?.className).toMatch(/viewText/)
    })

    it('「編集」ボタンが表示される', () => {
      render(<ReviewSection reviewText="感想" onSave={mockOnSave} />)
      expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument()
    })

    it('「編集」クリックで編集モードに切り替わり、既存テキストが入っている', async () => {
      const user = userEvent.setup()
      render(<ReviewSection reviewText="感想" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '編集' }))
      expect(screen.getByDisplayValue('感想')).toBeInTheDocument()
    })

    it('view モードではテキストエリアが表示されない', () => {
      render(<ReviewSection reviewText="感想" onSave={mockOnSave} />)
      expect(screen.queryByPlaceholderText('作品の感想を書く...')).not.toBeInTheDocument()
    })
  })
```

- [ ] **Step 2: テスト実行して新規 5 テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/components/ReviewSection`
Expected: empty モードの 5 テストはパス、view モードの 5 テストが失敗（「素晴らしい作品」要素がない、等）

- [ ] **Step 3: `ReviewSection.tsx` の view モードの `return null` を実装に置き換え**

`ReviewSection.tsx` の末尾 `return null` を以下に置き換える:

```typescript
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
```

- [ ] **Step 4: CSS に view モード用スタイルを追加**

`ReviewSection.module.css` の末尾に以下を追加:

```css
/* view モード */
.viewContainer {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.viewActions {
  display: flex;
  justify-content: flex-end;
}

.viewText {
  margin: 0;
  padding: var(--spacing-md);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
  background: var(--color-bg-white);
  border: var(--border-width-thin) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-sm);
}
```

- [ ] **Step 5: テスト実行、view モード 5 テスト + empty モード 5 テストで計 10 テストがパスすることを確認**

Run: `cd frontend && npx vitest run src/components/ReviewSection`
Expected: PASS 10, FAIL 0

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ReviewSection/
git commit -m "feat(frontend): ReviewSection の view モードを実装"
```

---

## Task 4: edit モード保存テスト追加と挙動検証

**Files:**
- Modify: `frontend/src/components/ReviewSection/ReviewSection.test.tsx`

Task 2 で edit モードの UI は既に実装済みだが、保存挙動のテストがない。このタスクでテストを追加する。

- [ ] **Step 1: edit モード保存系テストを追加**

`ReviewSection.test.tsx` の末尾 `describe('view モード', ...)` の後に追加:

```typescript
  describe('edit モード - 保存', () => {
    it('保存ボタンをクリックすると onSave が新しいテキストで呼ばれる', async () => {
      const user = userEvent.setup()
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '感想を書く' }))
      const textarea = screen.getByPlaceholderText('作品の感想を書く...')
      await user.type(textarea, '新しい感想')
      await user.click(screen.getByRole('button', { name: '保存' }))
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('新しい感想')
      })
    })

    it('保存中は保存ボタンが「保存中...」表示で disabled になる', async () => {
      const user = userEvent.setup()
      let resolveSave: (() => void) | undefined
      mockOnSave.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveSave = resolve
          }),
      )
      render(<ReviewSection reviewText="text" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '編集' }))
      await user.click(screen.getByRole('button', { name: '保存' }))
      const savingBtn = await screen.findByRole('button', { name: '保存中...' })
      expect(savingBtn).toBeDisabled()
      resolveSave?.()
    })

    it('保存成功後、親が reviewText を更新すると view モードに戻る', async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <ReviewSection reviewText="" onSave={mockOnSave} />,
      )
      await user.click(screen.getByRole('button', { name: '感想を書く' }))
      const textarea = screen.getByPlaceholderText('作品の感想を書く...')
      await user.type(textarea, '保存後')
      await user.click(screen.getByRole('button', { name: '保存' }))
      await waitFor(() => expect(mockOnSave).toHaveBeenCalled())
      // 親が reviewText を更新したことをシミュレート
      rerender(<ReviewSection reviewText="保存後" onSave={mockOnSave} />)
      expect(screen.getByText('保存後')).toBeInTheDocument()
      expect(
        screen.queryByPlaceholderText('作品の感想を書く...'),
      ).not.toBeInTheDocument()
    })
  })
```

`waitFor` を使うので、既存のインポートに `waitFor` を追加:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
```

- [ ] **Step 2: テスト実行、全 13 テストがパスすることを確認**

Run: `cd frontend && npx vitest run src/components/ReviewSection`
Expected: PASS 13, FAIL 0

すべて Task 2 で実装済みのコードが既にこの挙動を満たしている前提。もし失敗したら、該当の実装にバグがあるのでデバッグする。

- [ ] **Step 3: コミット**

```bash
git add frontend/src/components/ReviewSection/ReviewSection.test.tsx
git commit -m "test(frontend): ReviewSection の edit モード保存テストを追加"
```

---

## Task 5: edit モード キャンセルテスト追加

**Files:**
- Modify: `frontend/src/components/ReviewSection/ReviewSection.test.tsx`

- [ ] **Step 1: キャンセル系テストを追加**

`ReviewSection.test.tsx` の末尾 `describe('edit モード - 保存', ...)` の後に追加:

```typescript
  describe('edit モード - キャンセル', () => {
    it('キャンセルすると編集内容が破棄され、view モードに戻る', async () => {
      const user = userEvent.setup()
      render(<ReviewSection reviewText="元のテキスト" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '編集' }))
      const textarea = screen.getByPlaceholderText('作品の感想を書く...')
      await user.clear(textarea)
      await user.type(textarea, '変更後')
      await user.click(screen.getByRole('button', { name: 'キャンセル' }))
      expect(screen.getByText('元のテキスト')).toBeInTheDocument()
      expect(
        screen.queryByPlaceholderText('作品の感想を書く...'),
      ).not.toBeInTheDocument()
    })

    it('null 状態から編集→キャンセルで empty モードに戻る', async () => {
      const user = userEvent.setup()
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '感想を書く' }))
      await user.click(screen.getByRole('button', { name: 'キャンセル' }))
      expect(screen.getByText('まだ感想が書かれていません')).toBeInTheDocument()
    })
  })
```

- [ ] **Step 2: テスト実行、全 15 テストがパスすることを確認**

Run: `cd frontend && npx vitest run src/components/ReviewSection`
Expected: PASS 15, FAIL 0

Task 2 で `handleCancel` は既に実装済み。もし失敗したらデバッグする。

- [ ] **Step 3: コミット**

```bash
git add frontend/src/components/ReviewSection/ReviewSection.test.tsx
git commit -m "test(frontend): ReviewSection のキャンセル挙動テストを追加"
```

---

## Task 6: エラーハンドリング実装（インラインエラー表示）

**Files:**
- Modify: `frontend/src/components/ReviewSection/ReviewSection.tsx`
- Modify: `frontend/src/components/ReviewSection/ReviewSection.test.tsx`
- Modify: `frontend/src/components/ReviewSection/ReviewSection.module.css`

- [ ] **Step 1: エラーハンドリングのテストを追加**

`ReviewSection.test.tsx` の末尾（`describe('edit モード - キャンセル', ...)` の後）に追加:

```typescript
  describe('エラーハンドリング', () => {
    it('onSave が例外を投げた場合、エラーメッセージが表示される', async () => {
      const user = userEvent.setup()
      mockOnSave.mockRejectedValue(new Error('network error'))
      render(<ReviewSection reviewText="text" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '編集' }))
      await user.click(screen.getByRole('button', { name: '保存' }))
      expect(
        await screen.findByText('保存に失敗しました。もう一度お試しください。'),
      ).toBeInTheDocument()
    })

    it('保存失敗時は編集モードに留まり、入力内容が失われない', async () => {
      const user = userEvent.setup()
      mockOnSave.mockRejectedValue(new Error('fail'))
      render(<ReviewSection reviewText="" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '感想を書く' }))
      const textarea = screen.getByPlaceholderText('作品の感想を書く...')
      await user.type(textarea, '失敗テスト')
      await user.click(screen.getByRole('button', { name: '保存' }))
      await screen.findByText(
        '保存に失敗しました。もう一度お試しください。',
      )
      expect(screen.getByDisplayValue('失敗テスト')).toBeInTheDocument()
    })

    it('再試行時に前回のエラーがクリアされる', async () => {
      const user = userEvent.setup()
      mockOnSave
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(undefined)
      render(<ReviewSection reviewText="text" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '編集' }))
      await user.click(screen.getByRole('button', { name: '保存' }))
      await screen.findByText(
        '保存に失敗しました。もう一度お試しください。',
      )
      await user.click(screen.getByRole('button', { name: '保存' }))
      await waitFor(() => {
        expect(
          screen.queryByText('保存に失敗しました。もう一度お試しください。'),
        ).not.toBeInTheDocument()
      })
    })
  })
```

- [ ] **Step 2: テスト実行、エラー関連テスト 3 件のうち 1 件以上失敗することを確認**

Run: `cd frontend && npx vitest run src/components/ReviewSection`
Expected: エラーメッセージ要素が DOM に存在しないため失敗

**注意:** 実は Task 2 で `saveError` ステートと `catch { setSaveError(...) }` までは書いてあるが、**描画部分で `saveError` を表示していない**ので失敗するはず。これは意図的。

- [ ] **Step 3: `ReviewSection.tsx` の edit モード描画にエラー表示を追加**

`ReviewSection.tsx` の `mode === 'edit'` の JSX 内、`<FormTextarea ... />` の直後・`<div className={styles.actions}>` の前に以下を追加:

```typescript
        {saveError && (
          <p className={styles.errorMessage} role="alert">
            {saveError}
          </p>
        )}
```

編集モード全体の return 文が次のようになる:

```typescript
  if (mode === 'edit') {
    return (
      <div className={styles.container}>
        <FormTextarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="作品の感想を書く..."
          rows={EDIT_ROWS}
        />
        {saveError && (
          <p className={styles.errorMessage} role="alert">
            {saveError}
          </p>
        )}
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            disabled={isSaving}
          >
            キャンセル
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={isSaving}
            onClick={() => void handleSave()}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    )
  }
```

- [ ] **Step 4: CSS にエラーメッセージ用スタイルを追加**

`ReviewSection.module.css` の末尾に追加:

```css
.errorMessage {
  margin: 0;
  color: var(--color-error);
  font-family: var(--font-body);
  font-size: var(--font-size-label);
}
```

- [ ] **Step 5: テスト実行、全 18 テストがパスすることを確認**

Run: `cd frontend && npx vitest run src/components/ReviewSection`
Expected: PASS 18, FAIL 0

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ReviewSection/
git commit -m "feat(frontend): ReviewSection の保存エラー表示を実装"
```

---

## Task 7: 親データ同期の useEffect 挙動を検証するテスト追加

**Files:**
- Modify: `frontend/src/components/ReviewSection/ReviewSection.test.tsx`

Task 2 で既に `useEffect` は実装済み。このタスクではその挙動を検証するテストを追加する。

- [ ] **Step 1: 親データ同期テストを追加**

`ReviewSection.test.tsx` の末尾に追加:

```typescript
  describe('親データ同期', () => {
    it('編集中に親が reviewText を更新しても draft は上書きされない', async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <ReviewSection reviewText="初期" onSave={mockOnSave} />,
      )
      await user.click(screen.getByRole('button', { name: '編集' }))
      const textarea = screen.getByPlaceholderText('作品の感想を書く...')
      await user.clear(textarea)
      await user.type(textarea, '編集中のテキスト')
      // 親が reviewText を別の値で更新（例: 別タブで保存が発生）
      rerender(
        <ReviewSection reviewText="他から来た値" onSave={mockOnSave} />,
      )
      expect(screen.getByDisplayValue('編集中のテキスト')).toBeInTheDocument()
    })
  })
```

- [ ] **Step 2: テスト実行、全 19 テストがパスすることを確認**

Run: `cd frontend && npx vitest run src/components/ReviewSection`
Expected: PASS 19, FAIL 0

Task 2 の `useEffect` は `mode !== 'edit'` の時のみ再同期するので、このテストは既に通るはず。もし失敗したら `useEffect` の依存配列を再確認する。

- [ ] **Step 3: コミット**

```bash
git add frontend/src/components/ReviewSection/ReviewSection.test.tsx
git commit -m "test(frontend): ReviewSection の親データ同期テストを追加"
```

---

## Task 8: リント・型チェック・全体テスト実行

**Files:**
- なし（検証のみ）

- [ ] **Step 1: ESLint を実行**

Run: `cd frontend && npx eslint src/components/ReviewSection src/pages/WorkDetailPage`
Expected: エラー・警告なし

失敗した場合: 報告されたルール違反を修正してから次へ。

- [ ] **Step 2: Prettier チェック**

Run: `cd frontend && npx prettier --check src/components/ReviewSection src/pages/WorkDetailPage`
Expected: All matched files use Prettier code style!

失敗した場合: `npx prettier --write <該当ファイル>` で整形してから次へ。

- [ ] **Step 3: TypeScript 型チェック**

Run: `cd frontend && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: ReviewSection 関連の全テスト実行**

Run: `cd frontend && npx vitest run src/components/ReviewSection src/pages/WorkDetailPage`
Expected: すべてパス

- [ ] **Step 5: ファイル行数チェック**

Run: `wc -l frontend/src/components/ReviewSection/ReviewSection.tsx`
Expected: 200 行以下（CLAUDE.md のファイルサイズルール）

- [ ] **Step 6: リンター修正があった場合のみコミット**

変更がある場合:

```bash
git add frontend/src/components/ReviewSection/ frontend/src/pages/WorkDetailPage/
git commit -m "style(frontend): ReviewSection の lint/format 調整"
```

変更がなければスキップ。

---

## Task 9: 開発サーバーで手動（または Playwright）動作確認

**Files:**
- なし（動作確認）

動作確認は `recolly-workflow` の Step 5 に従って、IK さんに確認方法（手動 or Playwright MCP）を質問してから実施する。

- [ ] **Step 1: IK さんに動作確認方法を AskUserQuestion で確認**

質問テキスト例:
> ReviewSection の動作確認を行います。以下のどちらで進めますか？
> 1. 手動確認（ブラウザで操作する手順を案内）
> 2. Playwright MCP で自動確認

- [ ] **Step 2: 動作確認チェックリスト**

確認観点（手動でも Playwright でも同じ）:

1. **空状態**: 新規作品の詳細ページを開き、感想タブで「まだ感想が書かれていません」と「感想を書く」ボタンが表示される
2. **empty → edit**: 「感想を書く」クリックでテキストエリアが表示される
3. **保存**: テキスト入力して「保存」クリックで view モードに切り替わり、全文が表示される
4. **改行保持**: 改行を含むテキストを保存し、view モードで改行が視覚的に保持されている
5. **編集**: view モードで「編集」クリックで再度テキストエリアに戻る
6. **キャンセル**: edit モードでテキストを変更して「キャンセル」クリックで編集内容が破棄される
7. **長文**: 十分長いテキストを保存して、スクロールせずに全文が展開表示される（スクロールバーが出ない）
8. **エラー**: ネットワークを切断して保存を試みて、エラーメッセージが表示される（手動時のみ）
9. **モバイル**: 開発者ツールのデバイスモードでスマホサイズにし、タッチターゲット 44px 以上、レイアウト崩れなしを確認

- [ ] **Step 3: 問題があればタスクを追加して修正、なければ次のステップへ**

---

## Task 10: ブランチ完了 + PR 作成

**Files:**
- なし（`superpowers:finishing-a-development-branch` スキルに従う）

- [ ] **Step 1: `superpowers:finishing-a-development-branch` スキルを発動**

このスキルが PR 作成までの手順をガイドする。Recolly の Git 運用ルール（`recolly-git-rules` スキル）も必要に応じて参照する。

- [ ] **Step 2: PR タイトル候補**

`feat(frontend): 作品詳細の感想タブを表示/編集モード化 (#146)`

- [ ] **Step 3: PR 本文には以下を含める**

- Issue リンク: `Closes #146`
- スクショ（空状態・view モード・edit モード各1枚）
- テスト結果（19 テストパス）
- Spec / Plan へのリンク

---

## Self-Review

### 1. スペック要件カバレッジ

| スペック要件 | 実装タスク |
|---|---|
| 空状態メッセージ + ボタン | Task 2 |
| view モード全文展開 + `white-space: pre-wrap` | Task 3 |
| 「編集」ボタンで編集遷移 | Task 3 |
| 「感想を書く」ボタンで編集遷移 | Task 2 |
| edit モード `FormTextarea rows=8` | Task 2 |
| 保存 / キャンセルボタン | Task 2, 4, 5 |
| 保存中表示 | Task 4 |
| 保存成功後に view に戻る | Task 4（useEffect 同期による） |
| キャンセルで元のモードに戻る | Task 5 |
| エラー時編集モードに留まる | Task 6 |
| エラー再試行でエラークリア | Task 6 |
| 編集中の親データ同期（上書き防止） | Task 7 |
| Props 不変 | 全タスク（ReviewSectionProps 型を変更しない） |
| `WorkDetailPage.tsx` 非変更 | 全タスク |
| `useWorkDetail.ts` エラー伝播調整 | Task 1 |
| デザイントークン使用 | Task 2, 3, 6（CSS ステップ） |
| 200 行以内 | Task 8（行数チェック） |
| 19 テストケース | Task 2-7（合計 5+5+3+2+3+1 = 19） |

抜け漏れなし。

### 2. プレースホルダースキャン

- "TBD" / "TODO" / "implement later" なし ✓
- 各ステップに具体コードまたはコマンドあり ✓
- 「エラーハンドリング追加」のような曖昧な指示なし ✓

### 3. 型・名前の整合性

- `Mode = 'empty' | 'view' | 'edit'` が Task 2 で定義され、Task 3, 4, 5, 6 すべてで一貫使用 ✓
- `handleStartEdit` / `handleCancel` / `handleSave` の関数名が統一 ✓
- `SAVE_ERROR_MESSAGE` 定数が Task 2 で定義され、テストで参照される文字列と一致 ✓
- `EDIT_ROWS = 8` 定数が Task 2 で定義、Spec の指定（rows=8）と一致 ✓
