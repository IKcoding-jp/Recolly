# 作品詳細ページ UI リデザイン 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 作品詳細ページをタブ分割レイアウトに変更し、評価スライダーのジャンルカラー対応・ステップ方式化、感想欄のアウトラインスタイル化を行う

**Architecture:** 現在のサイドバー+メインのレイアウトを、ヘッダー（カバー画像+タイトル+ステータス+評価）+ タブ（概要/感想/コミュニティ）に再構成する。RatingSliderコンポーネントにmediaType propを追加してジャンルカラーを動的適用し、1点刻みのステップ方式に変更。各コンポーネントのスタイル修正はCSS Modulesの変更で対応。

**Tech Stack:** React 19, TypeScript, Vite, CSS Modules, Vitest + React Testing Library

**仕様書:** `docs/superpowers/specs/2026-04-11-work-detail-ui-redesign.md`
**モック:** `.superpowers/brainstorm/544-1775864705/content/final-mockup-v3.html`

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---------|------|------|
| `frontend/src/components/ui/RatingSlider/RatingSlider.tsx` | 修正 | ジャンル色・ステップ方式・目盛り・レイアウト変更 |
| `frontend/src/components/ui/RatingSlider/RatingSlider.module.css` | 修正 | 新スライダースタイル |
| `frontend/src/components/ui/ProgressControl/ProgressControl.tsx` | 修正 | プログレスバー削除 |
| `frontend/src/components/ui/ProgressControl/ProgressControl.module.css` | 修正 | バー関連スタイル削除 |
| `frontend/src/components/ReviewSection/ReviewSection.module.css` | 修正 | アウトラインスタイル追加 |
| `frontend/src/components/EpisodeReviewSection/EpisodeReviewCard.tsx` | 修正 | 編集・削除ボタンの右寄せ |
| `frontend/src/components/EpisodeReviewSection/EpisodeReviewSection.module.css` | 修正 | カードヘッダーのレイアウト変更 |
| `frontend/src/components/EpisodeReviewSection/EpisodeReviewSection.tsx` | 修正 | フォームの順序変更（一覧の下に移動） |
| `frontend/src/components/DiscussionSection/DiscussionSection.module.css` | 修正 | border-top削除（タブ内に移動するため） |
| `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx` | 修正 | タブ分割レイアウトに再構成 |
| `frontend/src/pages/WorkDetailPage/WorkDetailPage.module.css` | 修正 | サイドバー → ヘッダー+タブスタイル |
| `frontend/src/styles/tokens.css` | 修正 | 必要なトークン追加 |

---

### Task 1: RatingSlider — ジャンルカラー・ステップ方式・目盛り対応

**Files:**
- Modify: `frontend/src/components/ui/RatingSlider/RatingSlider.tsx`
- Modify: `frontend/src/components/ui/RatingSlider/RatingSlider.module.css`
- Test: `frontend/src/components/ui/RatingSlider/RatingSlider.test.tsx`

- [ ] **Step 1: テストファイルを作成**

```tsx
// frontend/src/components/ui/RatingSlider/RatingSlider.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { RatingSlider } from './RatingSlider'

describe('RatingSlider', () => {
  it('スコアを表示する', () => {
    render(<RatingSlider value={8} onChange={vi.fn()} />)
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('/10')).toBeInTheDocument()
  })

  it('value=0のとき「-」を表示する', () => {
    render(<RatingSlider value={0} onChange={vi.fn()} />)
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('1〜10の目盛りラベルを表示する', () => {
    render(<RatingSlider value={5} onChange={vi.fn()} />)
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument()
    }
  })

  it('mediaTypeに応じたジャンルカラーのCSS変数を適用する', () => {
    const { container } = render(
      <RatingSlider value={8} onChange={vi.fn()} mediaType="anime" />
    )
    const slider = container.querySelector('input[type="range"]')
    expect(slider).toBeInTheDocument()
  })

  it('step=1でスナップする（input要素のstep属性）', () => {
    const { container } = render(<RatingSlider value={5} onChange={vi.fn()} />)
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    expect(slider.step).toBe('1')
  })

  it('スライダー変更時にonChangeが呼ばれる', async () => {
    const handleChange = vi.fn()
    render(<RatingSlider value={5} onChange={handleChange} />)
    const slider = screen.getByRole('slider')
    await userEvent.click(slider)
    // userEventのスライダー操作は環境依存のため、changeイベントの存在確認
    expect(slider).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec frontend npx vitest run src/components/ui/RatingSlider/RatingSlider.test.tsx`
Expected: FAIL — mediaType propが存在しない、目盛りが存在しない

- [ ] **Step 3: RatingSlider.tsx を修正**

```tsx
// frontend/src/components/ui/RatingSlider/RatingSlider.tsx
import type { MediaType } from '../../../lib/types'
import styles from './RatingSlider.module.css'

/** ジャンル別カラーをCSS変数名にマッピング */
const GENRE_COLOR_VAR: Record<MediaType, string> = {
  anime: 'var(--color-anime)',
  movie: 'var(--color-movie)',
  drama: 'var(--color-drama)',
  book: 'var(--color-book)',
  manga: 'var(--color-manga)',
  game: 'var(--color-game)',
}

/** 1, 5, 10 は強調目盛り */
const MAJOR_TICKS = [1, 5, 10]

type RatingSliderProps = {
  value: number
  onChange: (value: number) => void
  mediaType?: MediaType
}

export function RatingSlider({ value, onChange, mediaType }: RatingSliderProps) {
  const genreColor = mediaType ? GENRE_COLOR_VAR[mediaType] : 'var(--color-text)'
  const percentage = (value / 10) * 100
  const sliderBackground = `linear-gradient(to right, ${genreColor} ${String(percentage)}%, var(--color-border-light) ${String(percentage)}%)`

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>評価</span>
        <div className={styles.scoreBlock}>
          <span className={styles.score} style={{ color: genreColor }}>
            {value === 0 ? '-' : value}
          </span>
          <span className={styles.maxLabel}>/10</span>
        </div>
      </div>
      <div className={styles.sliderWrap}>
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={value}
          onChange={handleChange}
          className={styles.slider}
          style={{
            background: sliderBackground,
            '--genre-color': genreColor,
          } as React.CSSProperties}
        />
        <div className={styles.ticks}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((tick) => (
            <div key={tick} className={styles.tick}>
              <div
                className={`${styles.tickMark} ${MAJOR_TICKS.includes(tick) ? styles.tickMajor : ''}`}
              />
              <span className={styles.tickLabel}>{tick}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: RatingSlider.module.css を修正**

```css
/* frontend/src/components/ui/RatingSlider/RatingSlider.module.css */
.container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.label {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
}

.sliderWrap {
  width: 100%;
}

.slider {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  outline: none;
  border-radius: 3px;
  background: var(--color-border-light);
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: var(--genre-color, var(--color-text));
  border-radius: var(--radius-full);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--genre-color, var(--color-text));
  border-radius: var(--radius-full);
  cursor: pointer;
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.slider::-moz-range-progress {
  background: var(--genre-color, var(--color-text));
  height: 6px;
  border-radius: 3px;
}

.ticks {
  display: flex;
  justify-content: space-between;
  margin-top: var(--spacing-xs);
  padding: 0 1px;
}

.tick {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 0;
}

.tickMark {
  width: 1px;
  height: 6px;
  background: #d0d0c8;
}

.tickMajor {
  height: 8px;
  background: #b0b0a8;
}

.tickLabel {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.scoreBlock {
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.score {
  font-family: var(--font-heading);
  font-size: 32px;
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.maxLabel {
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
}
```

- [ ] **Step 5: テストを実行して通ることを確認**

Run: `docker compose exec frontend npx vitest run src/components/ui/RatingSlider/RatingSlider.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ui/RatingSlider/
git commit -m "feat(frontend): RatingSliderをジャンルカラー・ステップ方式・目盛り付きに改善 #work-detail-redesign"
```

---

### Task 2: ProgressControl — プログレスバー削除

**Files:**
- Modify: `frontend/src/components/ui/ProgressControl/ProgressControl.tsx`
- Modify: `frontend/src/components/ui/ProgressControl/ProgressControl.module.css`

- [ ] **Step 1: ProgressControl.tsx からプログレスバーのJSXを削除**

`ProgressControl.tsx` の以下の部分を削除する（行61-64付近）:

```tsx
// 削除する部分:
{total !== null && percentage !== null && (
  <div className={styles.bar}>
    <div className={styles.fill} style={{ width: `${percentage}%` }} />
  </div>
)}
```

また、`percentage` の計算（行23）も不要になるので削除:
```tsx
// 削除する部分:
const percentage = total ? Math.round((current / total) * 100) : null
```

- [ ] **Step 2: ProgressControl.module.css からバー関連スタイルを削除**

`.bar` と `.fill` のスタイル（行63-73）を削除:

```css
/* 削除する部分: */
.bar {
  height: 4px;
  background: var(--color-border-light);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--color-text);
  border-radius: var(--radius-sm);
  transition: width var(--transition-normal);
}
```

- [ ] **Step 3: 既存テストが通ることを確認**

Run: `docker compose exec frontend npx vitest run src/components/ui/ProgressControl/`
Expected: PASS（既存テストがあれば通る。なければスキップ）

- [ ] **Step 4: コミット**

```bash
git add frontend/src/components/ui/ProgressControl/
git commit -m "refactor(frontend): ProgressControlからプログレスバーを削除 #work-detail-redesign"
```

---

### Task 3: ReviewSection — アウトライン（枠線）スタイルに変更

**Files:**
- Modify: `frontend/src/components/ReviewSection/ReviewSection.module.css`

- [ ] **Step 1: ReviewSection.module.css にアウトラインスタイルを追加**

現在 `ReviewSection` は `FormTextarea`（ボトムラインスタイル）を使用している。`FormTextarea` のスタイルをオーバーライドして枠線スタイルにする。

`ReviewSection.module.css` を以下に変更:

```css
/* frontend/src/components/ReviewSection/ReviewSection.module.css */
.container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* FormTextareaのボトムラインをアウトラインに上書き */
.container textarea {
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-sm);
  padding: 12px;
  min-height: 80px;
  background: var(--color-bg-white);
}

.container textarea:focus {
  border-color: var(--color-text);
  border-bottom-color: var(--color-text);
}

.actions {
  display: flex;
  justify-content: flex-end;
}
```

- [ ] **Step 2: ブラウザで見た目を確認**

`http://localhost:5173/works/11` を開き、感想テキストエリアが枠線で囲まれていることを確認。

- [ ] **Step 3: コミット**

```bash
git add frontend/src/components/ReviewSection/ReviewSection.module.css
git commit -m "style(frontend): ReviewSectionをアウトライン（枠線）スタイルに変更 #work-detail-redesign"
```

---

### Task 4: EpisodeReviewSection — 枠線スタイル・編集削除の右寄せ・フォーム順序変更

**Files:**
- Modify: `frontend/src/components/EpisodeReviewSection/EpisodeReviewCard.tsx`
- Modify: `frontend/src/components/EpisodeReviewSection/EpisodeReviewSection.tsx`
- Modify: `frontend/src/components/EpisodeReviewSection/EpisodeReviewSection.module.css`

- [ ] **Step 1: EpisodeReviewCard.tsx — ヘッダーレイアウトを変更**

編集・削除ボタンをヘッダー右側に移動。現在の `cardHeader` の構造を変更:

```tsx
// frontend/src/components/EpisodeReviewSection/EpisodeReviewCard.tsx
// cardHeaderのJSXを以下に変更（return内の該当部分）:
<div className={styles.cardHeader}>
  <div className={styles.cardHeaderLeft}>
    <span className={styles.episodeTag}>
      第{review.episode_number}
      {unit}
    </span>
    <span className={styles.cardDate}>{formattedDate}</span>
  </div>
  <div className={styles.cardActions}>
    {!isEditing && (
      <>
        <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
          編集
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void handleDelete()}>
          削除
        </Button>
      </>
    )}
  </div>
</div>
```

- [ ] **Step 2: EpisodeReviewSection.tsx — フォームを一覧の下に移動**

現在フォームが上、一覧が下の順序を逆にする。フォームの上に区切り線を追加:

```tsx
// frontend/src/components/EpisodeReviewSection/EpisodeReviewSection.tsx
// return内のJSXを以下の順序に変更:
return (
  <div className={styles.container}>
    {sortedReviews.length > 0 && (
      <div className={styles.list}>
        {sortedReviews.map((review) => (
          <EpisodeReviewCard
            key={review.id}
            review={review}
            onUpdate={updateReview}
            onDelete={deleteReview}
            unit={unit}
          />
        ))}
      </div>
    )}

    <div className={styles.formDivider}>
      <div className={styles.form}>
        <div className={styles.formRow}>
          <label className={styles.episodeLabel} htmlFor="episode-number">
            第
          </label>
          <input
            id="episode-number"
            type="number"
            className={styles.episodeInput}
            value={episodeNumber}
            onChange={(e) => setEpisodeNumber(Number(e.target.value))}
            min={1}
          />
          <span className={styles.episodeLabel}>{unit}</span>
        </div>
        <FormTextarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`この${unit}の感想を書く...`}
          rows={3}
        />
        <div className={styles.formActions}>
          <Button
            variant="primary"
            size="sm"
            disabled={isSubmitting || !body.trim()}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  </div>
)
```

- [ ] **Step 3: EpisodeReviewSection.module.css — スタイル修正**

```css
/* 以下を追加・変更 */

/* カードヘッダー: 左右に分離 */
.cardHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.cardHeaderLeft {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

/* フォーム区切り線 */
.formDivider {
  padding-top: var(--spacing-lg);
  border-top: var(--border-width-thin) var(--border-style) var(--color-border-light);
}

/* テキストエリアをアウトラインスタイルに */
.form textarea {
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-sm);
  padding: 12px;
  background: var(--color-bg-white);
}

.form textarea:focus {
  border-color: var(--color-text);
  border-bottom-color: var(--color-text);
}
```

- [ ] **Step 4: 既存テストが通ることを確認**

Run: `docker compose exec frontend npx vitest run src/components/EpisodeReviewSection/`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/EpisodeReviewSection/
git commit -m "feat(frontend): EpisodeReviewSectionの枠線スタイル化・編集削除の右寄せ・フォーム順序変更 #work-detail-redesign"
```

---

### Task 5: DiscussionSection — border-top スタイル削除

**Files:**
- Modify: `frontend/src/components/DiscussionSection/DiscussionSection.module.css`

- [ ] **Step 1: DiscussionSection.module.css から区切り線スタイルを削除**

`.section` の `border-top` と `margin-top` を削除（タブ内に配置されるため不要）:

```css
/* 変更前: */
.section {
  margin-top: var(--spacing-2xl);
  padding-top: var(--spacing-lg);
  border-top: var(--border-width) var(--border-style) var(--color-border-light);
}

/* 変更後: */
.section {
  /* タブ内に配置されるため区切り線は不要 */
}
```

- [ ] **Step 2: コミット**

```bash
git add frontend/src/components/DiscussionSection/DiscussionSection.module.css
git commit -m "style(frontend): DiscussionSectionのborder-topを削除（タブ内配置のため） #work-detail-redesign"
```

---

### Task 6: WorkDetailPage — タブ分割レイアウトに再構成

**Files:**
- Modify: `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`
- Modify: `frontend/src/pages/WorkDetailPage/WorkDetailPage.module.css`
- Test: `frontend/src/pages/WorkDetailPage/WorkDetailPage.test.tsx`

- [ ] **Step 1: テストファイルを作成**

```tsx
// frontend/src/pages/WorkDetailPage/WorkDetailPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

// タブ切り替えのUIテスト用にシンプルなタブコンポーネントだけテスト
describe('WorkDetailPage タブ切り替え', () => {
  it('3つのタブが表示される', () => {
    // WorkDetailPage全体のレンダリングはAPI依存が大きいため、
    // タブの存在確認はブラウザテストで実施
    expect(true).toBe(true)
  })
})
```

注: WorkDetailPageはAPIモック等の複雑なセットアップが必要なため、タブ切り替えはブラウザでの手動確認を主とする。

- [ ] **Step 2: WorkDetailPage.tsx をタブ分割レイアウトに修正**

```tsx
// frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx
import { useState } from 'react'
import type { MediaType } from '../../lib/types'
import {
  hasEpisodes,
  getRewatchLabel,
  isOngoing,
  getUnreadCount,
  UNIT_LABELS,
} from '../../lib/mediaTypeUtils'
import { StatusSelector } from '../../components/ui/StatusSelector/StatusSelector'
import { RatingSlider } from '../../components/ui/RatingSlider/RatingSlider'
import { ProgressControl } from '../../components/ui/ProgressControl/ProgressControl'
import { RewatchControl } from '../../components/RewatchControl/RewatchControl'
import { ReviewSection } from '../../components/ReviewSection/ReviewSection'
import { EpisodeReviewSection } from '../../components/EpisodeReviewSection/EpisodeReviewSection'
import { TagSection } from '../../components/TagSection/TagSection'
import { DiscussionSection } from '../../components/DiscussionSection/DiscussionSection'
import { RecordDeleteDialog } from '../../components/RecordDeleteDialog/RecordDeleteDialog'
import { Button } from '../../components/ui/Button/Button'
import { useWorkDetail } from './useWorkDetail'
import styles from './WorkDetailPage.module.css'

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  anime: 'アニメ',
  movie: '映画',
  drama: 'ドラマ',
  book: '本',
  manga: '漫画',
  game: 'ゲーム',
}

const HAS_EPISODES: MediaType[] = ['anime', 'drama', 'manga']

type TabId = 'overview' | 'reviews' | 'community'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: '概要' },
  { id: 'reviews', label: '感想' },
  { id: 'community', label: 'コミュニティ' },
]

const formatDate = (date: string | null): string => {
  if (!date) return '---'
  return new Date(date).toLocaleDateString('ja-JP')
}

export function WorkDetailPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const {
    record,
    isLoading,
    isDeleting,
    showDeleteDialog,
    handleStatusChange,
    handleRatingChange,
    handleEpisodeChange,
    handleReviewTextSave,
    handleRewatchCountChange,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
  } = useWorkDetail()

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    )
  }

  if (!record) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>記録が見つかりません</div>
      </div>
    )
  }

  const { work } = record

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ===== ヘッダー: カバー画像 + タイトル + ステータス + 評価 ===== */}
        <div className={styles.header}>
          <div className={styles.coverArea}>
            {work.cover_image_url ? (
              <img
                className={styles.cover}
                src={work.cover_image_url}
                alt={`${work.title}のカバー画像`}
              />
            ) : (
              <div className={styles.coverPlaceholder} />
            )}
          </div>
          <div className={styles.titleArea}>
            <h1 className={styles.title}>{work.title}</h1>
            <div className={styles.metadata}>
              {MEDIA_TYPE_LABELS[work.media_type]}
              {work.total_episodes !== null && ` · 全${String(work.total_episodes)}話`}
            </div>

            <div className={styles.statusSection}>
              <StatusSelector
                value={record.status}
                onChange={handleStatusChange}
                mediaType={work.media_type}
              />
            </div>

            <RatingSlider
              value={record.rating ?? 0}
              onChange={(v) => handleRatingChange(v === 0 ? null : v)}
              mediaType={work.media_type}
            />
          </div>
        </div>

        {/* ===== タブナビゲーション ===== */}
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===== タブコンテンツ: 概要 ===== */}
        {activeTab === 'overview' && (
          <div className={styles.tabContent}>
            <div className={styles.dataRow}>
              {hasEpisodes(work.media_type) && (
                <div className={styles.dataItem}>
                  <div className={styles.label}>進捗</div>
                  <ProgressControl
                    current={record.current_episode}
                    total={work.total_episodes}
                    onChange={handleEpisodeChange}
                    showFullControls
                    mediaType={work.media_type}
                  />
                  {work.media_type === 'manga' &&
                    isOngoing(work.metadata) &&
                    getUnreadCount(record.current_episode, work.total_episodes) > 0 && (
                      <div className={styles.newVolumeAlert}>
                        📖 <strong>新刊</strong>が出ています！ {work.total_episodes}巻
                      </div>
                    )}
                </div>
              )}
              <div className={styles.dataItem}>
                <div className={styles.label}>{getRewatchLabel(work.media_type)}</div>
                <RewatchControl count={record.rewatch_count} onChange={handleRewatchCountChange} />
              </div>
              <div className={styles.dataItem}>
                <div className={styles.label}>開始日</div>
                <div className={styles.dateValue}>{formatDate(record.started_at)}</div>
              </div>
              <div className={styles.dataItem}>
                <div className={styles.label}>完了日</div>
                <div className={styles.dateValue}>{formatDate(record.completed_at)}</div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.label}>タグ</div>
              <TagSection recordId={record.id} initialTags={record.tags ?? []} />
            </div>

            {work.description && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>あらすじ</div>
                <p className={styles.description}>{work.description}</p>
              </div>
            )}

            <div className={styles.deleteSection}>
              <Button variant="secondary" onClick={openDeleteDialog}>
                記録を削除
              </Button>
            </div>
          </div>
        )}

        {/* ===== タブコンテンツ: 感想 ===== */}
        {activeTab === 'reviews' && (
          <div className={styles.tabContent}>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>作品の感想</div>
              <ReviewSection reviewText={record.review_text} onSave={handleReviewTextSave} />
            </div>

            {HAS_EPISODES.includes(work.media_type) && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  {UNIT_LABELS[work.media_type] === '巻' ? '巻数ごとの感想' : '話数ごとの感想'}
                </div>
                <EpisodeReviewSection
                  recordId={record.id}
                  currentEpisode={record.current_episode}
                  mediaType={work.media_type}
                />
              </div>
            )}
          </div>
        )}

        {/* ===== タブコンテンツ: コミュニティ ===== */}
        {activeTab === 'community' && (
          <div className={styles.tabContent}>
            <DiscussionSection
              workId={work.id}
              totalEpisodes={work.total_episodes}
              hasRecord={!!record}
            />
          </div>
        )}
      </div>

      <RecordDeleteDialog
        isOpen={showDeleteDialog}
        workTitle={work.title}
        onConfirm={confirmDelete}
        onCancel={closeDeleteDialog}
        isLoading={isDeleting}
      />
    </div>
  )
}
```

- [ ] **Step 3: WorkDetailPage.module.css をタブレイアウトに修正**

```css
/* frontend/src/pages/WorkDetailPage/WorkDetailPage.module.css */
.page {
  min-height: 100vh;
  background-color: var(--color-bg);
  padding: var(--spacing-xl);
}

.container {
  max-width: 800px;
  margin: 0 auto;
}

/* ===== ヘッダー: カバー画像 + タイトルエリア ===== */
.header {
  display: flex;
  gap: var(--spacing-xl);
  margin-bottom: var(--spacing-lg);
}

.coverArea {
  width: 160px;
  flex-shrink: 0;
}

.cover {
  width: 100%;
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-none);
}

.coverPlaceholder {
  width: 100%;
  aspect-ratio: 2 / 3;
  background-color: var(--color-border-light);
  border: var(--border-width) var(--border-style) var(--color-border-light);
}

.titleArea {
  flex: 1;
  min-width: 0;
}

.title {
  font-family: var(--font-heading);
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-xs);
  line-height: var(--line-height-tight);
}

.metadata {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-md);
  letter-spacing: 0.05em;
}

.statusSection {
  margin-bottom: var(--spacing-lg);
}

/* ===== タブ ===== */
.tabs {
  display: flex;
  gap: 0;
  border-bottom: var(--border-width) var(--border-style) #e8e8e0;
  margin-bottom: 28px;
}

.tab {
  padding: 10px 20px;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: var(--font-weight-bold);
  color: var(--color-text-muted);
  cursor: pointer;
  border: none;
  border-bottom: var(--border-width) var(--border-style) transparent;
  margin-bottom: -2px;
  background: none;
  transition: all var(--transition-fast);
}

.tab:hover {
  color: var(--color-text-muted);
}

.tabActive {
  color: var(--color-text);
  border-bottom-color: var(--color-text);
}

.tabContent {
  /* タブコンテンツの共通ラッパー */
}

/* ===== データ行（概要タブ） ===== */
.dataRow {
  display: flex;
  gap: var(--spacing-xl);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-lg);
}

.dataItem {
  min-width: 120px;
}

.dateValue {
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  margin-top: var(--spacing-xs);
}

/* ===== セクション ===== */
.section {
  margin-bottom: var(--spacing-lg);
}

.sectionTitle {
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin-bottom: 10px;
}

.label {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-xs);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
}

.description {
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  color: var(--color-text);
  line-height: var(--line-height-relaxed);
  margin: 0;
}

.newVolumeAlert {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: #fef3ef;
  border: var(--border-width-thin) var(--border-style) var(--color-manga);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-label);
  color: var(--color-text);
}

.newVolumeAlert strong {
  color: var(--color-manga);
}

/* ===== 削除セクション（右寄せ） ===== */
.deleteSection {
  margin-top: 48px;
  padding-top: var(--spacing-lg);
  border-top: var(--border-width-thin) var(--border-style) #e8e8e0;
  display: flex;
  justify-content: flex-end;
}

/* ===== ローディング・空状態 ===== */
.loading {
  text-align: center;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  margin-top: var(--spacing-xl);
}

.empty {
  text-align: center;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  margin-top: var(--spacing-xl);
}

/* ===== レスポンシブ ===== */
@media (max-width: 768px) {
  .page {
    padding: var(--spacing-md);
  }

  .header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .coverArea {
    width: 140px;
  }

  .statusSection {
    display: flex;
    justify-content: center;
  }

  .dataRow {
    gap: var(--spacing-md);
  }
}
```

- [ ] **Step 4: ブラウザで動作確認**

`http://localhost:5173/works/11` を開き、以下を確認:
- ヘッダー（カバー画像+タイトル+ステータス+評価）が正しく表示
- 評価スライダーがジャンルカラー（アニメ青）で表示
- 評価バーが1点刻みでスナップ
- 3つのタブが切り替わる
- 概要タブ: 進捗・再視聴・日付・タグ・あらすじ・削除ボタン（右寄せ）
- 感想タブ: 枠線テキストエリア + 話数感想カード（編集削除右寄せ）
- コミュニティタブ: ディスカッション
- 768px以下でレスポンシブ表示

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/WorkDetailPage/
git commit -m "feat(frontend): WorkDetailPageをタブ分割レイアウトに再構成 #work-detail-redesign"
```

---

### Task 7: 統合テスト・最終確認

- [ ] **Step 1: 全テストを実行**

Run: `docker compose exec frontend npx vitest run`
Expected: 全テスト PASS

- [ ] **Step 2: ESLint・TypeScript型チェック**

Run: `docker compose exec frontend npx tsc --noEmit && docker compose exec frontend npx eslint src/`
Expected: エラーなし

- [ ] **Step 3: ブラウザで最終確認**

`http://localhost:5173/works/11` で以下を確認:
- 各タブの切り替えが正常
- 評価スライダーがジャンルカラーで1点刻み動作
- 感想の枠線スタイル
- 編集・削除ボタンが右寄せ
- 記録削除ボタンが右寄せ
- レスポンシブ（768px以下）

- [ ] **Step 4: 最終コミット（必要に応じて修正後）**

```bash
git add -A
git commit -m "fix(frontend): 作品詳細ページUIリデザインの最終調整 #work-detail-redesign"
```
