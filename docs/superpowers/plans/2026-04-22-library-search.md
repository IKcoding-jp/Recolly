# ライブラリ検索機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** マイライブラリに「タイトル部分一致」のキーワード検索機能を追加する（既存フィルタと AND 結合、URL 同期、300ms デバウンス）。

**Architecture:** バックエンドは既存の `RecordFilterable` concern に `filter_by_keyword` を追加し `q` パラメータで ILIKE 絞り込み。フロントエンドは新規 `SearchInput` コンポーネントを作り、`useLibrary` フックに `q` state とデバウンスを追加、`LibraryPage` の SectionTitle 直下に配置する。

**Tech Stack:** Ruby 3.3 / Rails 8 / PostgreSQL 16 / RSpec / React 19 / TypeScript / Vite / Vitest / React Testing Library / userEvent

**Spec:** `docs/superpowers/specs/2026-04-22-library-search-design.md`

**Branch:** `feat/library-search`（既に作成済み・spec コミット済み）

---

## File Structure

### バックエンド

| ファイル | 種別 | 責務 |
|---------|------|------|
| `backend/app/controllers/concerns/record_filterable.rb` | 修正 | `filter_by_keyword` を追加し `apply_filters` から呼ぶ |
| `backend/spec/requests/api/v1/records_search_spec.rb` | 新規 | `q` パラメータの request spec（部分一致・大文字小文字・エスケープ・AND・空白・認可） |

### フロントエンド

| ファイル | 種別 | 責務 |
|---------|------|------|
| `frontend/src/components/ui/SearchInput/SearchInput.tsx` | 新規 | アイコン + input + クリアボタンの制御コンポーネント |
| `frontend/src/components/ui/SearchInput/SearchInput.module.css` | 新規 | tokens.css のみ使うスタイル |
| `frontend/src/components/ui/SearchInput/SearchInput.test.tsx` | 新規 | ユニットテスト |
| `frontend/src/lib/recordsApi.ts` | 修正 | `getAll` の filters に `q?: string` を追加 |
| `frontend/src/pages/LibraryPage/useLibrary.ts` | 修正 | `q` state、`draftQ` 状態、300ms デバウンスで URL 同期、API へ `q` を渡す |
| `frontend/src/pages/LibraryPage/LibraryPage.tsx` | 修正 | SectionTitle 直下に `<SearchInput>` を配置（記録 0 件時は非表示） |
| `frontend/src/pages/LibraryPage/LibraryPage.test.tsx` | 修正 | 検索入力・デバウンス・クリア・空状態のテスト追加 |

---

## Task 1: バックエンド — `q` 部分一致の失敗テストを書く

**Files:**
- Create: `backend/spec/requests/api/v1/records_search_spec.rb`

**前提知識:**
- 既存 `records_spec.rb` の `describe 'GET /api/v1/records'` と同じパターンで書く
- RSpec は Docker 経由で実行: `docker compose exec backend bundle exec rspec <path>`
- factory_bot は未導入。`User.create!` / `Work.create!` / `Record.create!` で直接生成
- 認証は `sign_in user` ヘルパーで行う（既存 request spec を参考）

### - [ ] Step 1: 失敗テストファイルを作成

`backend/spec/requests/api/v1/records_search_spec.rb` に以下を書く:

```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Records — キーワード検索', type: :request do
  let(:user) { User.create!(username: 'searchuser', email: 'search@example.com', password: 'password123') }

  before { sign_in user }

  def create_record(title, media_type: 'anime', status: :watching)
    work = Work.create!(title: title, media_type: media_type)
    Record.create!(user: user, work: work, status: status)
  end

  describe 'q パラメータ' do
    it 'タイトルに q を含む records のみ返す' do
      create_record('進撃の巨人')
      create_record('鋼の錬金術師')

      get '/api/v1/records', params: { q: '進撃' }

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['records'].length).to eq(1)
      expect(json['records'][0]['work']['title']).to eq('進撃の巨人')
    end

    it '大文字小文字を区別しない（ILIKE）' do
      create_record('Attack on Titan')

      get '/api/v1/records', params: { q: 'attack' }

      json = response.parsed_body
      expect(json['records'].length).to eq(1)
    end

    it 'LIKE メタ文字（%, _）をエスケープしリテラルとして扱う' do
      create_record('100%完全攻略')
      create_record('100満点')

      get '/api/v1/records', params: { q: '100%' }

      json = response.parsed_body
      expect(json['records'].length).to eq(1)
      expect(json['records'][0]['work']['title']).to eq('100%完全攻略')
    end

    it 'q と status を AND で組み合わせる' do
      create_record('進撃の巨人', status: :watching)
      create_record('進撃の別作品', status: :completed)

      get '/api/v1/records', params: { q: '進撃', status: 'watching' }

      json = response.parsed_body
      expect(json['records'].length).to eq(1)
      expect(json['records'][0]['status']).to eq('watching')
    end

    it '空文字の q は絞り込まない（全件返す）' do
      create_record('進撃の巨人')
      create_record('鋼の錬金術師')

      get '/api/v1/records', params: { q: '' }

      json = response.parsed_body
      expect(json['records'].length).to eq(2)
    end

    it '空白のみの q は絞り込まない' do
      create_record('進撃の巨人')

      get '/api/v1/records', params: { q: '   ' }

      json = response.parsed_body
      expect(json['records'].length).to eq(1)
    end

    it '他ユーザーの記録は返さない' do
      create_record('進撃の巨人')
      other = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
      other_work = Work.create!(title: '進撃の巨人の別記録', media_type: 'anime')
      Record.create!(user: other, work: other_work)

      get '/api/v1/records', params: { q: '進撃' }

      json = response.parsed_body
      expect(json['records'].length).to eq(1)
      expect(json['records'][0]['work']['title']).to eq('進撃の巨人')
    end
  end
end
```

### - [ ] Step 2: テストを走らせて失敗を確認

Run:
```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/records_search_spec.rb --fail-fast
```

Expected: 最初のテストが **FAIL**（`json['records'].length` が 2 になり 1 と一致しない。理由: `q` パラメータはまだ実装されていないので全件返る）

### - [ ] Step 3: コミットしない（Red 段階）

次のタスクで実装してからまとめてコミットする。

---

## Task 2: バックエンド — `filter_by_keyword` を実装

**Files:**
- Modify: `backend/app/controllers/concerns/record_filterable.rb`

### - [ ] Step 1: `apply_filters` に呼び出しを追加し `filter_by_keyword` を定義

`backend/app/controllers/concerns/record_filterable.rb` の `apply_filters` と private メソッド群を以下のように変更:

```ruby
def apply_filters(records)
  records = filter_by_status(records)
  records = filter_by_media_type(records)
  records = filter_by_work_id(records)
  records = filter_by_keyword(records)
  filter_by_tags(records)
end
```

そして既存の `filter_by_work_id` の直後に以下のメソッドを追加:

```ruby
# タイトル部分一致検索（ILIKE）。
# LIKE メタ文字（%, _）は sanitize_sql_like でエスケープしリテラル扱い。
def filter_by_keyword(records)
  return records if params[:q].blank?

  keyword = params[:q].to_s.strip
  return records if keyword.empty?

  records.joins(:work).where(
    'works.title ILIKE ?',
    "%#{Work.sanitize_sql_like(keyword)}%"
  )
end
```

### - [ ] Step 2: テストを走らせて全て通ることを確認

Run:
```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/records_search_spec.rb
```

Expected: **7 examples, 0 failures**

### - [ ] Step 3: 既存の records_spec.rb が壊れていないことを確認

Run:
```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/records_spec.rb
```

Expected: 既存テスト全てが PASS

### - [ ] Step 4: RuboCop を通す

Run:
```bash
docker compose exec backend bundle exec rubocop app/controllers/concerns/record_filterable.rb spec/requests/api/v1/records_search_spec.rb
```

Expected: `no offenses detected`。もし違反があれば修正してから次へ。

### - [ ] Step 5: コミット

```bash
git add backend/app/controllers/concerns/record_filterable.rb backend/spec/requests/api/v1/records_search_spec.rb
git commit -m "feat: ライブラリ記録の q パラメータによるタイトル部分一致検索を追加"
```

---

## Task 3: フロントエンドAPI — `recordsApi.getAll` に `q` を追加

**Files:**
- Modify: `frontend/src/lib/recordsApi.ts`

### - [ ] Step 1: 型とクエリ構築に `q` を追加

`frontend/src/lib/recordsApi.ts` の `RecordFilterParams` に `q?: string` を追加し、`getAll` 内で URL パラメータに加える:

```ts
type RecordFilterParams = {
  status?: RecordStatus
  mediaType?: string
  workId?: number
  sort?: string
  page?: number
  perPage?: number
  tags?: string[]
  q?: string
}

export const recordsApi = {
  getAll(filters?: RecordFilterParams): Promise<RecordsListResponse> {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.mediaType) params.set('media_type', filters.mediaType)
    if (filters?.workId) params.set('work_id', String(filters.workId))
    if (filters?.sort) params.set('sort', filters.sort)
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.perPage) params.set('per_page', String(filters.perPage))
    if (filters?.tags) {
      filters.tags.forEach((tag) => params.append('tag[]', tag))
    }
    if (filters?.q) params.set('q', filters.q)
    const query = params.toString()
    return request<RecordsListResponse>(`/records${query ? `?${query}` : ''}`)
  },
  // 以下変更なし
}
```

### - [ ] Step 2: 型チェックが通ることを確認

Run:
```bash
docker compose exec frontend npm run typecheck
```

Expected: エラーなし

### - [ ] Step 3: コミットしない

次の `SearchInput` コンポーネントと一緒にコミットする（関連する小さな変更のため）。

---

## Task 4: フロントエンド — `SearchInput` コンポーネントの失敗テストを書く

**Files:**
- Create: `frontend/src/components/ui/SearchInput/SearchInput.test.tsx`

**前提知識:**
- Vitest + React Testing Library + userEvent を使う
- 既存の `FormInput` / `Button` のテストパターンに倣う
- `userEvent.setup()` でセットアップし、`userEvent.type` / `userEvent.click` を使う

### - [ ] Step 1: テストファイルを作成

`frontend/src/components/ui/SearchInput/SearchInput.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchInput } from './SearchInput'

describe('SearchInput', () => {
  it('value を input に表示する', () => {
    render(<SearchInput value="進撃" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('進撃')
  })

  it('入力時に onChange が新しい値で呼ばれる', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()
    render(<SearchInput value="" onChange={handleChange} />)

    await user.type(screen.getByRole('textbox'), '鬼')

    expect(handleChange).toHaveBeenCalledWith('鬼')
  })

  it('value が空でないときクリアボタンを表示する', () => {
    render(<SearchInput value="進撃" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /クリア/ })).toBeInTheDocument()
  })

  it('value が空のときクリアボタンを表示しない', () => {
    render(<SearchInput value="" onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: /クリア/ })).not.toBeInTheDocument()
  })

  it('クリアボタンで onChange が空文字で呼ばれる', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()
    render(<SearchInput value="進撃" onChange={handleChange} />)

    await user.click(screen.getByRole('button', { name: /クリア/ }))

    expect(handleChange).toHaveBeenCalledWith('')
  })

  it('aria-label を input に付与する', () => {
    render(<SearchInput value="" onChange={() => {}} aria-label="ライブラリ内検索" />)
    expect(screen.getByRole('textbox', { name: 'ライブラリ内検索' })).toBeInTheDocument()
  })

  it('placeholder を input に表示する', () => {
    render(<SearchInput value="" onChange={() => {}} placeholder="タイトルで検索..." />)
    expect(screen.getByPlaceholderText('タイトルで検索...')).toBeInTheDocument()
  })
})
```

### - [ ] Step 2: テストを走らせて失敗を確認

Run:
```bash
docker compose exec frontend npm test -- src/components/ui/SearchInput/SearchInput.test.tsx
```

Expected: **FAIL**（`SearchInput` モジュールが存在しないためインポートエラー）

---

## Task 5: フロントエンド — `SearchInput` 実装

**Files:**
- Create: `frontend/src/components/ui/SearchInput/SearchInput.tsx`
- Create: `frontend/src/components/ui/SearchInput/SearchInput.module.css`

### - [ ] Step 1: CSS を作成

`frontend/src/components/ui/SearchInput/SearchInput.module.css`:

```css
.wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: var(--transition-base);
}

.wrapper:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-subtle);
}

.icon {
  flex-shrink: 0;
  margin-left: var(--spacing-md);
  color: var(--color-text-muted);
}

.input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-md);
  color: var(--color-text);
  font-family: inherit;
}

.input::placeholder {
  color: var(--color-text-muted);
}

.clearButton {
  flex-shrink: 0;
  margin-right: var(--spacing-sm);
  padding: var(--spacing-xs);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: var(--transition-base);
}

.clearButton:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

.clearButton:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.sizeSm .input {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-sm);
}
```

**注意**: 上記 CSS 変数がすべて `tokens.css` に存在することを確認。無ければ Step 3 で追加する。

### - [ ] Step 2: コンポーネントを作成

`frontend/src/components/ui/SearchInput/SearchInput.tsx`:

```tsx
import type { KeyboardEvent } from 'react'
import styles from './SearchInput.module.css'

type SearchInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  size?: 'sm' | 'md'
  'aria-label'?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  size = 'md',
  'aria-label': ariaLabel,
}: SearchInputProps) {
  // Enter キーは親フォームに伝えず、デバウンスに任せる
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.preventDefault()
  }

  const wrapperClass = [styles.wrapper, size === 'sm' ? styles.sizeSm : ''].filter(Boolean).join(' ')

  return (
    <div className={wrapperClass}>
      <svg
        className={styles.icon}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        maxLength={200}
      />
      {value && (
        <button
          type="button"
          className={styles.clearButton}
          onClick={() => onChange('')}
          aria-label="クリア"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
```

### - [ ] Step 3: `tokens.css` に未定義の変数があれば追加

Run:
```bash
grep -E "color-primary-subtle|color-surface-hover" frontend/src/tokens.css
```

もし `--color-primary-subtle` や `--color-surface-hover` が定義されていなければ、`frontend/src/tokens.css` に追加する:

```css
/* tokens.css の :root { ... } 内に、他の --color-* と同じ場所に追加 */
--color-primary-subtle: rgba(59, 130, 246, 0.15);
--color-surface-hover: #f5f5f5;
```

実際の色はプロジェクトの既存トーンに合わせて調整（CLAUDE.md の `feedback_design_preference.md`: 白背景・クリーン・モダン）。

**既に存在するなら何もしない。**

### - [ ] Step 4: SearchInput のテストが全て通ることを確認

Run:
```bash
docker compose exec frontend npm test -- src/components/ui/SearchInput/SearchInput.test.tsx
```

Expected: **7 tests passed**

### - [ ] Step 5: ESLint / Prettier を通す

Run:
```bash
docker compose exec frontend npm run lint -- src/components/ui/SearchInput/ src/lib/recordsApi.ts
```

Expected: エラーなし。違反があれば修正。

### - [ ] Step 6: コミット

```bash
git add frontend/src/lib/recordsApi.ts frontend/src/components/ui/SearchInput/
# tokens.css に変更があれば追加
git add frontend/src/tokens.css 2>/dev/null || true
git commit -m "feat: SearchInput コンポーネントを追加し recordsApi に q パラメータを追加"
```

---

## Task 6: フロントエンド — `useLibrary` に `q` state とデバウンスを追加

**Files:**
- Modify: `frontend/src/pages/LibraryPage/useLibrary.ts`

**前提知識:**
- 既存の `useLibrary` は URL の searchParams を単一の真実源（source of truth）として使っている
- デバウンスは「入力中の draft 値」を state で持ち、300ms 後に URL へコミットする二段構えにする
- ページネーションのリセットは既存 `updateParams` が担保（`'page' in updates` が false なら `next.delete('page')`）

### - [ ] Step 1: `useLibrary` を修正

`frontend/src/pages/LibraryPage/useLibrary.ts` を以下のように変更（変更箇所のみ抜粋、既存部分は残す）:

**(a) URL から `q` を読み取り、draftQ state を初期化する処理を `selectedTagsKey` の下に追加:**

```ts
// URLの q を読み取る
const q = searchParams.get('q') ?? ''

// 入力中の draft 値（デバウンス元）
const [draftQ, setDraftQ] = useState(q)

// 外部から URL が変わった場合は draft を同期（戻る/進む対応）
useEffect(() => {
  setDraftQ(q)
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [q])
```

**(b) API 呼び出しの依存配列と params に `q` を追加:**

```ts
useEffect(() => {
  if (rawStatus === null) return

  let cancelled = false

  const fetchRecords = async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const res = await recordsApi.getAll({
        status: status ?? undefined,
        mediaType: mediaType ?? undefined,
        sort,
        page,
        perPage,
        tags: selectedTagsKey ? selectedTagsKey.split(',') : undefined,
        q: q || undefined,
      })
      if (!cancelled) {
        setState({
          records: res.records,
          meta: res.meta ?? null,
          isLoading: false,
          error: null,
        })
      }
    } catch (err) {
      if (!cancelled) {
        const message = err instanceof Error ? err.message : 'エラーが発生しました'
        setState((prev) => ({ ...prev, isLoading: false, error: message }))
      }
    }
  }
  void fetchRecords()
  return () => {
    cancelled = true
  }
}, [status, mediaType, sort, page, perPage, rawStatus, selectedTagsKey, q])
```

**(c) デバウンスで URL にコミット（`setTags` の下に追加）:**

```ts
// draftQ が変わってから 300ms 経ったら URL の q に反映（ページは 1 にリセット）
useEffect(() => {
  const trimmed = draftQ.trim()
  // 既に URL と同じなら何もしない（無限ループと不要なページリセットを防ぐ）
  if (trimmed === q) return

  const timer = setTimeout(() => {
    updateParams({ q: trimmed || null })
  }, 300)
  return () => clearTimeout(timer)
}, [draftQ, q, updateParams])
```

**(d) return オブジェクトに `q`, `draftQ`, `setDraftQ` を追加:**

```ts
return {
  records: state.records,
  totalPages: state.meta?.total_pages ?? 1,
  totalCount: state.meta?.total_count ?? 0,
  isLoading: state.isLoading,
  error: state.error,
  status,
  mediaType,
  sort,
  page,
  allTags,
  selectedTags,
  q,
  draftQ,
  setStatus,
  setMediaType,
  setSort,
  setPage,
  setTags,
  setDraftQ,
}
```

### - [ ] Step 2: 型チェックが通ることを確認

Run:
```bash
docker compose exec frontend npm run typecheck
```

Expected: エラーなし（LibraryPage.tsx は次のタスクで更新するので、まだ `draftQ` / `setDraftQ` を使わなくても OK）。

### - [ ] Step 3: コミットしない

次のタスクで `LibraryPage` 統合と一緒にコミットする。

---

## Task 7: フロントエンド — `LibraryPage` に `SearchInput` を配置し、テスト拡張

**Files:**
- Modify: `frontend/src/pages/LibraryPage/LibraryPage.tsx`
- Modify: `frontend/src/pages/LibraryPage/LibraryPage.test.tsx`

### - [ ] Step 1: LibraryPage のテストを拡張して失敗させる

`frontend/src/pages/LibraryPage/LibraryPage.test.tsx` の `describe('LibraryPage', ...)` の末尾（`}`の直前）に以下を追加:

```tsx
describe('検索機能', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('記録があるとき検索バーが表示される', async () => {
    renderPage()
    expect(await screen.findByRole('textbox', { name: 'ライブラリ内検索' })).toBeInTheDocument()
  })

  it('記録が0件かつフィルタなしのとき検索バーは表示されない', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({
      records: [],
      meta: { current_page: 1, total_pages: 0, total_count: 0, per_page: 20 },
    })
    renderPage(['/library?status=all'])
    await waitFor(() => {
      expect(screen.getByText('作品を探して記録しましょう')).toBeInTheDocument()
    })
    expect(screen.queryByRole('textbox', { name: 'ライブラリ内検索' })).not.toBeInTheDocument()
  })

  it('検索入力から 300ms 後に q パラメータ付きで API が呼ばれる', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()
    const input = await screen.findByRole('textbox', { name: 'ライブラリ内検索' })

    await user.type(input, '進撃')
    vi.advanceTimersByTime(300)

    await waitFor(() => {
      expect(recordsApi.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ q: '進撃' }),
      )
    })
  })

  it('クリアボタンで検索が解除される', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage(['/library?status=all&q=進撃'])
    const input = await screen.findByRole('textbox', { name: 'ライブラリ内検索' })
    expect(input).toHaveValue('進撃')

    await user.click(screen.getByRole('button', { name: 'クリア' }))
    vi.advanceTimersByTime(300)

    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })
})
```

### - [ ] Step 2: テストが失敗することを確認

Run:
```bash
docker compose exec frontend npm test -- src/pages/LibraryPage/LibraryPage.test.tsx
```

Expected: 追加した 4 テストが **FAIL**（SearchInput が描画されていない、aria-label が見つからない等）

### - [ ] Step 3: `LibraryPage.tsx` に `SearchInput` を統合

`frontend/src/pages/LibraryPage/LibraryPage.tsx` を以下のように変更:

**(a) import に `SearchInput` を追加:**

```tsx
import { SearchInput } from '../../components/ui/SearchInput/SearchInput'
```

**(b) `useLibrary` の戻り値に `draftQ` / `setDraftQ` を追加:**

```tsx
const {
  records,
  totalPages,
  totalCount,
  isLoading,
  error,
  status,
  mediaType,
  sort,
  page,
  allTags,
  selectedTags,
  draftQ,
  setStatus,
  setMediaType,
  setSort,
  setPage,
  setTags,
  setDraftQ,
} = useLibrary(perPage)
```

**(c) `<SectionTitle>マイライブラリ</SectionTitle>` の直後に `SearchInput` を配置（`isUnfilteredEmpty && records.length === 0` でないときだけ表示）:**

「記録 1 件以上ある」または「フィルタが効いている」場合に検索バーを出す。既存の `isUnfilteredEmpty` 変数は `status === null && mediaType === null` の意味で、初回空ユーザー判定に使われている。検索バーの表示条件は「初回空ユーザーでないこと」なので、`!(isUnfilteredEmpty && records.length === 0 && !isLoading && !error)` を使う。

ただし、isLoading 中や検索絞り込みで 0 件の場合でも検索バーは見せたい。よりシンプルに「記録が総件数 0 件 かつ 他のフィルタが効いていない初回状態」のときだけ隠す:

```tsx
const hideSearchBar = isUnfilteredEmpty && !isLoading && !error && records.length === 0 && !draftQ
```

JSX の `<SectionTitle>` の直後:

```tsx
<SectionTitle>マイライブラリ</SectionTitle>

{!hideSearchBar && (
  <div className={styles.searchBar}>
    <SearchInput
      value={draftQ}
      onChange={setDraftQ}
      placeholder="タイトルで検索..."
      aria-label="ライブラリ内検索"
    />
  </div>
)}

<div className={styles.filters}>
  {/* 既存 */}
</div>
```

### - [ ] Step 4: `LibraryPage.module.css` に `.searchBar` を追加

`frontend/src/pages/LibraryPage/LibraryPage.module.css` に以下を追加（既存スタイルの末尾）:

```css
.searchBar {
  margin-bottom: var(--spacing-md);
}
```

### - [ ] Step 5: 全テストを走らせて通ることを確認

Run:
```bash
docker compose exec frontend npm test -- src/pages/LibraryPage/
```

Expected: 既存テスト + 新規 4 テストの全てが **PASS**

### - [ ] Step 6: 型チェックと lint

Run:
```bash
docker compose exec frontend npm run typecheck && docker compose exec frontend npm run lint -- src/pages/LibraryPage/ src/components/ui/SearchInput/
```

Expected: エラーなし

### - [ ] Step 7: コミット

```bash
git add frontend/src/pages/LibraryPage/ frontend/src/lib/recordsApi.ts 2>/dev/null
git add frontend/src/pages/LibraryPage/useLibrary.ts frontend/src/pages/LibraryPage/LibraryPage.tsx frontend/src/pages/LibraryPage/LibraryPage.module.css frontend/src/pages/LibraryPage/LibraryPage.test.tsx
git commit -m "feat: ライブラリページに検索バーを統合しデバウンス＋URL同期で検索を実装"
```

---

## Task 8: ブラウザで手動スモークテスト

**Files:** なし（動作確認のみ）

### - [ ] Step 1: 開発サーバーを起動

Run:
```bash
docker compose up -d
```

### - [ ] Step 2: ブラウザで `/library` にアクセスし以下を確認

- [ ] 検索バーが SectionTitle の下、フィルタ行の上に表示される
- [ ] タイトルの一部を入力すると 300ms 後に結果が絞られる
- [ ] 大文字小文字を区別しない（英語タイトルの作品があれば）
- [ ] ステータス「見た」フィルタと検索を併用すると AND で絞られる
- [ ] クリアボタン（×）で即座に絞り込みが解除される
- [ ] URL に `?q=xxx` が付く。リロードしても検索状態が保たれる
- [ ] 戻る/進むで検索状態が復元される
- [ ] 0 件マッチ時に「条件に一致する記録がありません」が出る
- [ ] 記録 0 件ユーザー（テスト用に一時的にフィルタで 0 件にするのでなく、本当に記録がない状態）では検索バーが出ず、既存の「作品を探して記録しましょう」が表示される

### - [ ] Step 3: モバイルレスポンシブ確認

DevTools でスマホ幅（375px）にして:
- [ ] 検索バーが横幅いっぱいに収まる
- [ ] クリアボタンが押しやすい（44px 以上のタッチターゲット）
- [ ] フィルタチップと干渉しない

問題があれば `LibraryPage.module.css` の `.searchBar` や `SearchInput.module.css` にメディアクエリで調整を加える。

---

## Task 9: PR 作成

**Files:** なし（git 操作のみ）

### - [ ] Step 1: push

```bash
git push -u origin feat/library-search
```

### - [ ] Step 2: PR 作成

```bash
gh pr create --title "feat: ライブラリのキーワード検索機能を追加" --body "$(cat <<'EOF'
## Summary
- マイライブラリに「タイトル部分一致」のキーワード検索バーを追加
- 既存フィルタ（ステータス／ジャンル／タグ）と AND 結合
- URL パラメータ `?q=xxx` と同期、300ms デバウンス

## 設計
`docs/superpowers/specs/2026-04-22-library-search-design.md`

## 実装計画
`docs/superpowers/plans/2026-04-22-library-search.md`

## Test plan
- [ ] backend: `spec/requests/api/v1/records_search_spec.rb` 全 7 例 PASS
- [ ] backend: 既存 `records_spec.rb` 全 PASS（破壊なし）
- [ ] frontend: `SearchInput.test.tsx` 7 例 PASS
- [ ] frontend: `LibraryPage.test.tsx` 既存 + 新規 4 例 PASS
- [ ] 手動: 部分一致・AND・URL 同期・クリア・モバイル表示

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### - [ ] Step 3: CI（lint, test）が通ることを確認

GitHub 上で CI が PASS することを待つ。
Claude Code Review の初回レビューも自動で走る。

### - [ ] Step 4: レビュー指摘があれば `recolly-git-rules` スキルのフィードバックループに従って対応

---

## 実行時の注意

- **Docker 経由**: lint / test / rubocop は全て `docker compose exec backend|frontend ...` で実行する（CLAUDE.md）
- **lefthook-local.yml を作成・改変しない**（メモリ `feedback_dev_environment.md`）
- **200 行ルール**: 各ファイルが 200 行を超えないか最終確認
- **コミットは小さく、意味のある単位で**（`recolly-git-rules` スキル: Conventional Commits 日本語）
- **「なぜ」コメントだけ書く**（CLAUDE.md）
