# 検索パフォーマンス改善 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SearchPageの初回検索速度を、体感（スケルトンUI + プログレス）と実際の処理速度（API並列化 + キャッシュ延長）の両面から改善する

**Architecture:** バックエンドはWorkSearchServiceのAPI呼び出しと日本語補完をRubyのThreadで並列化し、キャッシュTTLを12時間に延長する。フロントエンドはSearchSkeleton + SearchProgressコンポーネントを新規作成し、SearchPageのローディング表示を置き換える。

**Tech Stack:** Ruby/Rails（Thread並列化）、React/TypeScript（CSS Modules + デザイントークン）、RSpec、Vitest + React Testing Library

**Issue:** #80

---

## ファイル構成

### 新規作成

| ファイル | 責務 |
|---------|------|
| `frontend/src/components/SearchSkeleton/SearchSkeleton.tsx` | スケルトンUIコンポーネント |
| `frontend/src/components/SearchSkeleton/SearchSkeleton.module.css` | スケルトンのスタイル（シマーアニメーション含む） |
| `frontend/src/components/SearchSkeleton/SearchSkeleton.test.tsx` | スケルトンのテスト |
| `frontend/src/components/SearchProgress/SearchProgress.tsx` | プログレス表示コンポーネント |
| `frontend/src/components/SearchProgress/SearchProgress.module.css` | プログレスのスタイル |
| `frontend/src/components/SearchProgress/SearchProgress.test.tsx` | プログレスのテスト |

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `backend/app/services/work_search_service.rb` | API並列化 + 日本語補完並列化 + キャッシュTTL延長 |
| `backend/spec/services/work_search_service_spec.rb` | 並列化・キャッシュTTLのテスト追加 |
| `frontend/src/pages/SearchPage/SearchPage.tsx` | スピナーをSearchSkeleton + SearchProgressに置き換え |
| `frontend/src/pages/SearchPage/SearchPage.module.css` | `.loading` スタイルを削除 |
| `frontend/src/pages/SearchPage/SearchPage.test.tsx` | スケルトン表示のテスト追加 |

---

### Task 1: キャッシュTTLを12時間に延長

**Files:**
- Modify: `backend/app/services/work_search_service.rb:4`
- Modify: `backend/spec/services/work_search_service_spec.rb:255-279`

- [ ] **Step 1: キャッシュTTLのテストを追加**

`backend/spec/services/work_search_service_spec.rb` の `describe 'キャッシュ'` ブロック内に追加:

```ruby
it 'キャッシュTTLが12時間に設定されている' do
  expect(WorkSearchService::CACHE_TTL).to eq(12.hours)
end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/work_search_service_spec.rb -e 'キャッシュTTLが12時間' -f doc`
Expected: FAIL — `expected: 43200 seconds got: 1800 seconds`

- [ ] **Step 3: CACHE_TTLを変更**

`backend/app/services/work_search_service.rb` の4行目を変更:

```ruby
CACHE_TTL = 12.hours
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/work_search_service_spec.rb -e 'キャッシュ' -f doc`
Expected: 全3件PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "perf: 検索キャッシュTTLを30分から12時間に延長 #80"
```

---

### Task 2: 外部API呼び出しの並列化

**Files:**
- Modify: `backend/app/services/work_search_service.rb:6-17`
- Modify: `backend/spec/services/work_search_service_spec.rb`

- [ ] **Step 1: 並列化後も全アダプターが呼び出されるテストを追加**

`backend/spec/services/work_search_service_spec.rb` の `describe '#search'` ブロック内に追加:

```ruby
it 'ジャンル指定なしで全アダプタを並列に呼び出し結果を統合する' do
  movie_result = ExternalApis::BaseAdapter::SearchResult.new(
    'テスト映画', 'movie', '映画の説明', nil, nil, '100', 'tmdb', { popularity: 0.6 }
  )
  allow(tmdb_double).to receive(:safe_search).and_return([movie_result])

  results = service.search('テスト')
  expect(tmdb_double).to have_received(:safe_search).with('テスト')
  expect(anilist_double).to have_received(:safe_search).with('テスト')
  expect(google_books_double).to have_received(:safe_search).with('テスト')
  expect(igdb_double).to have_received(:safe_search).with('テスト')
  expect(results.length).to eq(2)
end
```

- [ ] **Step 2: テストがパスすることを確認（既存コードでもパスするはず）**

Run: `docker compose exec backend bundle exec rspec spec/services/work_search_service_spec.rb -e '並列に呼び出し' -f doc`
Expected: PASS（結果の統合は既に動いているため）

- [ ] **Step 3: searchメソッドの並列化を実装**

`backend/app/services/work_search_service.rb` の `search` メソッドを変更:

```ruby
def search(query, media_type: nil)
  cache_key = "work_search:#{media_type || 'all'}:#{query}"

  Rails.cache.fetch(cache_key, expires_in: CACHE_TTL) do
    adapters = select_adapters(media_type)
    results = fetch_from_adapters_in_parallel(adapters, query)
    results = results.select { |r| r.media_type == media_type } if media_type.present?
    enrich_anilist_descriptions(results)
    remove_english_descriptions(results)
    sort_by_popularity(results)
  end
end
```

`private` セクションにヘルパーメソッドを追加（`select_adapters` の直前に配置）:

```ruby
# 複数のアダプターを並列にAPI呼び出しし、結果を統合する
# 各アダプターのsafe_searchは個別にエラーハンドリング済みのため、
# 1つのスレッドが失敗しても他のスレッドには影響しない
def fetch_from_adapters_in_parallel(adapters, query)
  threads = adapters.map do |adapter|
    Thread.new { adapter.safe_search(query) }
  end
  threads.flat_map(&:value)
end
```

- [ ] **Step 4: 全テストがパスすることを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/work_search_service_spec.rb -f doc`
Expected: 全件PASS

- [ ] **Step 5: RuboCopがパスすることを確認**

Run: `docker compose exec backend bundle exec rubocop app/services/work_search_service.rb`
Expected: no offenses detected

- [ ] **Step 6: コミット**

```bash
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "perf: 外部API呼び出しをThread並列化 #80"
```

---

### Task 3: 日本語説明補完の並列化

**Files:**
- Modify: `backend/app/services/work_search_service.rb:52-66`
- Modify: `backend/spec/services/work_search_service_spec.rb`

- [ ] **Step 1: 複数AniList結果の補完が動作するテストを追加**

`backend/spec/services/work_search_service_spec.rb` の `describe 'AniList日本語説明補完'` ブロック内に追加:

```ruby
context '複数AniList結果の並列補完' do
  let(:result_a) do
    ExternalApis::BaseAdapter::SearchResult.new(
      '作品A', 'anime', 'English desc A',
      nil, 12, '100', 'anilist',
      { popularity: 0.8, title_english: 'Work A', title_romaji: 'Work A' }
    )
  end

  let(:result_b) do
    ExternalApis::BaseAdapter::SearchResult.new(
      '作品B', 'anime', 'English desc B',
      nil, 24, '200', 'anilist',
      { popularity: 0.6, title_english: 'Work B', title_romaji: 'Work B' }
    )
  end

  before do
    allow(anilist_double).to receive(:safe_search).and_return([result_a, result_b])
    allow(tmdb_double).to receive(:fetch_japanese_description)
      .with('作品A').and_return('作品Aの日本語説明')
    allow(tmdb_double).to receive(:fetch_japanese_description)
      .with('Work A').and_return(nil)
    allow(tmdb_double).to receive(:fetch_japanese_description)
      .with('作品B').and_return('作品Bの日本語説明')
    allow(tmdb_double).to receive(:fetch_japanese_description)
      .with('Work B').and_return(nil)
  end

  it '複数のAniList結果をすべて日本語補完する' do
    results = service.search('作品')
    descriptions = results.map(&:description)
    expect(descriptions).to contain_exactly('作品Aの日本語説明', '作品Bの日本語説明')
  end
end
```

- [ ] **Step 2: テストがパスすることを確認（既存コードでもパスするはず）**

Run: `docker compose exec backend bundle exec rspec spec/services/work_search_service_spec.rb -e '複数のAniList結果をすべて日本語補完する' -f doc`
Expected: PASS

- [ ] **Step 3: enrich_anilist_descriptionsを並列化**

`backend/app/services/work_search_service.rb` の `enrich_anilist_descriptions` メソッドを以下に置き換え:

```ruby
# AniListの結果にTMDB→Wikipediaの順で日本語説明を補完する
# AniListの説明は英語のため、日本語の説明が見つかれば置き換える
# 外部APIへの同時接続数を制限するため、5件ずつのバッチで並列処理する
ENRICHMENT_BATCH_SIZE = 5

def enrich_anilist_descriptions(results)
  anilist_results = results.select { |r| r.external_api_source == 'anilist' }
  return if anilist_results.empty?

  anilist_results.each_slice(ENRICHMENT_BATCH_SIZE) do |batch|
    threads = batch.map do |result|
      Thread.new { enrich_single_description(result) }
    end
    threads.each(&:join)
  end
end
```

既存の `enrich_anilist_descriptions` 内のループ本体を新メソッドに抽出:

```ruby
# スレッドごとに独立したアダプターインスタンスを使用する
# （Faradayコネクションの共有を避けるため）
def enrich_single_description(result)
  tmdb = ExternalApis::TmdbAdapter.new
  wikipedia = ExternalApis::WikipediaClient.new
  description = fetch_japanese_description_from_tmdb(result, tmdb)
  description ||= wikipedia.fetch_extract(result.title)
  result.description = resolve_description(description, result.description)
end
```

- [ ] **Step 4: 全テストがパスすることを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/work_search_service_spec.rb -f doc`
Expected: 全件PASS

- [ ] **Step 5: RuboCopがパスすることを確認**

Run: `docker compose exec backend bundle exec rubocop app/services/work_search_service.rb`
Expected: no offenses detected

- [ ] **Step 6: コミット**

```bash
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "perf: 日本語説明補完を5件バッチの並列処理に変更 #80"
```

---

### Task 4: SearchSkeletonコンポーネント

**Files:**
- Create: `frontend/src/components/SearchSkeleton/SearchSkeleton.tsx`
- Create: `frontend/src/components/SearchSkeleton/SearchSkeleton.module.css`
- Create: `frontend/src/components/SearchSkeleton/SearchSkeleton.test.tsx`

- [ ] **Step 1: テストを書く**

`frontend/src/components/SearchSkeleton/SearchSkeleton.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SearchSkeleton } from './SearchSkeleton'

describe('SearchSkeleton', () => {
  it('スケルトンカードが4枚レンダリングされる', () => {
    render(<SearchSkeleton />)
    const cards = screen.getAllByRole('status')
    expect(cards).toHaveLength(4)
  })

  it('各カードにaria-labelが設定されている', () => {
    render(<SearchSkeleton />)
    const cards = screen.getAllByRole('status')
    cards.forEach((card) => {
      expect(card).toHaveAttribute('aria-label', '読み込み中')
    })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec frontend npx vitest run src/components/SearchSkeleton/SearchSkeleton.test.tsx`
Expected: FAIL — モジュールが見つからない

- [ ] **Step 3: CSSを作成**

`frontend/src/components/SearchSkeleton/SearchSkeleton.module.css`:

```css
.container {
  margin-top: var(--spacing-lg);
}

.card {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-bottom: var(--border-width-thin) var(--border-style) var(--color-border-light);
  align-items: flex-start;
}

.card:last-child {
  opacity: 0.5;
  border-bottom: none;
}

.coverPlaceholder {
  flex-shrink: 0;
  width: 80px;
  height: 120px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--color-border-light) 25%, #f1f3f5 50%, var(--color-border-light) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-xs);
}

.line {
  border-radius: 4px;
  background: linear-gradient(90deg, var(--color-border-light) 25%, #f1f3f5 50%, var(--color-border-light) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.lineGenre {
  height: 10px;
  width: 50px;
}

.lineTitle {
  height: 16px;
  width: 65%;
}

.lineDesc {
  height: 12px;
  width: 85%;
}

.lineDescShort {
  height: 12px;
  width: 60%;
}

.buttonPlaceholder {
  flex-shrink: 0;
  width: 72px;
  height: 32px;
  border-radius: 4px;
  margin-top: var(--spacing-lg);
  background: linear-gradient(90deg, var(--color-border-light) 25%, #f1f3f5 50%, var(--color-border-light) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@media (max-width: 768px) {
  .coverPlaceholder {
    width: 48px;
    height: 68px;
  }
}
```

- [ ] **Step 4: コンポーネントを作成**

`frontend/src/components/SearchSkeleton/SearchSkeleton.tsx`:

```tsx
import styles from './SearchSkeleton.module.css'

const SKELETON_COUNT = 4

// 各カードのシマー開始タイミングをずらすためのディレイ
const ANIMATION_DELAYS = ['0s', '0.1s', '0.2s', '0.3s']

export function SearchSkeleton() {
  return (
    <div className={styles.container}>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div
          key={i}
          className={styles.card}
          role="status"
          aria-label="読み込み中"
        >
          <div
            className={styles.coverPlaceholder}
            style={{ animationDelay: ANIMATION_DELAYS[i] }}
          />
          <div className={styles.info}>
            <div
              className={`${styles.line} ${styles.lineGenre}`}
              style={{ animationDelay: ANIMATION_DELAYS[i] }}
            />
            <div
              className={`${styles.line} ${styles.lineTitle}`}
              style={{ animationDelay: ANIMATION_DELAYS[i] }}
            />
            <div
              className={`${styles.line} ${styles.lineDesc}`}
              style={{ animationDelay: ANIMATION_DELAYS[i] }}
            />
            <div
              className={`${styles.line} ${styles.lineDescShort}`}
              style={{ animationDelay: ANIMATION_DELAYS[i] }}
            />
          </div>
          <div
            className={styles.buttonPlaceholder}
            style={{ animationDelay: ANIMATION_DELAYS[i] }}
          />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: テストがパスすることを確認**

Run: `docker compose exec frontend npx vitest run src/components/SearchSkeleton/SearchSkeleton.test.tsx`
Expected: 全2件PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/SearchSkeleton/
git commit -m "feat: SearchSkeletonコンポーネントを追加 #80"
```

---

### Task 5: SearchProgressコンポーネント

**Files:**
- Create: `frontend/src/components/SearchProgress/SearchProgress.tsx`
- Create: `frontend/src/components/SearchProgress/SearchProgress.module.css`
- Create: `frontend/src/components/SearchProgress/SearchProgress.test.tsx`

- [ ] **Step 1: テストを書く**

`frontend/src/components/SearchProgress/SearchProgress.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { SearchProgress } from './SearchProgress'

describe('SearchProgress', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初期表示で「作品を検索しています...」が表示される', () => {
    render(<SearchProgress />)
    expect(screen.getByText('作品を検索しています...')).toBeInTheDocument()
  })

  it('1秒後に「詳細情報を取得しています...」に切り替わる', () => {
    vi.useFakeTimers()
    render(<SearchProgress />)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText('詳細情報を取得しています...')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('2.5秒後に「結果をまとめています...」に切り替わる', () => {
    vi.useFakeTimers()
    render(<SearchProgress />)

    act(() => {
      vi.advanceTimersByTime(2500)
    })

    expect(screen.getByText('結果をまとめています...')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('プログレスバーがレンダリングされる', () => {
    render(<SearchProgress />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec frontend npx vitest run src/components/SearchProgress/SearchProgress.test.tsx`
Expected: FAIL — モジュールが見つからない

- [ ] **Step 3: CSSを作成**

`frontend/src/components/SearchProgress/SearchProgress.module.css`:

```css
.container {
  padding: var(--spacing-sm) 0;
  margin-top: var(--spacing-md);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border-light);
  border-top-color: var(--color-text);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

.message {
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.barTrack {
  height: 2px;
  background: var(--color-border-light);
  border-radius: 2px;
  overflow: hidden;
  margin-top: var(--spacing-sm);
}

.barFill {
  height: 100%;
  background: var(--color-text);
  border-radius: 2px;
  animation: progress 3s ease-in-out infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes progress {
  0% { width: 10%; }
  33% { width: 40%; }
  66% { width: 70%; }
  100% { width: 10%; }
}
```

- [ ] **Step 4: コンポーネントを作成**

`frontend/src/components/SearchProgress/SearchProgress.tsx`:

```tsx
import { useState, useEffect } from 'react'
import styles from './SearchProgress.module.css'

const STEPS = [
  { message: '作品を検索しています...', delay: 0 },
  { message: '詳細情報を取得しています...', delay: 1000 },
  { message: '結果をまとめています...', delay: 2500 },
]

export function SearchProgress() {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const timers = STEPS.slice(1).map((step, i) =>
      setTimeout(() => setStepIndex(i + 1), step.delay),
    )
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.spinner} />
        <span className={styles.message}>{STEPS[stepIndex].message}</span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} role="progressbar" />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: テストがパスすることを確認**

Run: `docker compose exec frontend npx vitest run src/components/SearchProgress/SearchProgress.test.tsx`
Expected: 全4件PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/SearchProgress/
git commit -m "feat: SearchProgressコンポーネントを追加 #80"
```

---

### Task 6: SearchPageへの組み込み

**Files:**
- Modify: `frontend/src/pages/SearchPage/SearchPage.tsx:187`
- Modify: `frontend/src/pages/SearchPage/SearchPage.module.css:74-79`
- Modify: `frontend/src/pages/SearchPage/SearchPage.test.tsx`

- [ ] **Step 1: テストを追加**

`frontend/src/pages/SearchPage/SearchPage.test.tsx` の `describe('SearchPage')` ブロック内に追加:

```tsx
it('検索中にスケルトンUIとプログレスが表示される', async () => {
  renderSearchPage()
  const user = userEvent.setup()

  // 検索APIが解決しないPromiseを返す（ローディング状態を維持）
  mockFetch.mockReturnValueOnce(new Promise(() => {}))

  const searchInput = await screen.findByPlaceholderText('作品を検索...')
  await user.type(searchInput, 'テスト')
  await user.click(screen.getByRole('button', { name: '検索' }))

  // スケルトンカードが表示される
  await waitFor(() => {
    expect(screen.getAllByRole('status')).toHaveLength(4)
  })
  // プログレスメッセージが表示される
  expect(screen.getByText('作品を検索しています...')).toBeInTheDocument()
  // プログレスバーが表示される
  expect(screen.getByRole('progressbar')).toBeInTheDocument()
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec frontend npx vitest run src/pages/SearchPage/SearchPage.test.tsx`
Expected: 新しいテストがFAIL — `role="status"` の要素が見つからない

- [ ] **Step 3: SearchPage.tsxを変更**

import文を追加（ファイル先頭のimport群に追加）:

```tsx
import { SearchSkeleton } from '../../components/SearchSkeleton/SearchSkeleton'
import { SearchProgress } from '../../components/SearchProgress/SearchProgress'
```

187行目の `{isSearching && <p className={styles.loading}>検索中...</p>}` を以下に置き換え:

```tsx
{isSearching && (
  <>
    <SearchProgress />
    <SearchSkeleton />
  </>
)}
```

- [ ] **Step 4: SearchPage.module.cssから不要なスタイルを削除**

`.loading` クラス（74〜79行目）を削除:

```css
/* 以下を削除 */
.loading {
  text-align: center;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  margin-top: var(--spacing-xl);
}
```

- [ ] **Step 5: テストがパスすることを確認**

Run: `docker compose exec frontend npx vitest run src/pages/SearchPage/SearchPage.test.tsx`
Expected: 全5件PASS

- [ ] **Step 6: ESLint + Prettierがパスすることを確認**

Run: `docker compose exec frontend npx eslint src/pages/SearchPage/SearchPage.tsx src/components/SearchSkeleton/SearchSkeleton.tsx src/components/SearchProgress/SearchProgress.tsx && docker compose exec frontend npx prettier --check src/pages/SearchPage/SearchPage.tsx src/components/SearchSkeleton/ src/components/SearchProgress/`
Expected: no errors / All matched files use Prettier code style!

- [ ] **Step 7: コミット**

```bash
git add frontend/src/pages/SearchPage/SearchPage.tsx frontend/src/pages/SearchPage/SearchPage.module.css frontend/src/pages/SearchPage/SearchPage.test.tsx
git commit -m "feat: 検索ローディングをスケルトンUI+プログレス表示に置換 #80"
```

---

### Task 7: 全体テスト + リンター確認

**Files:** なし（確認のみ）

- [ ] **Step 1: バックエンドの全テストを実行**

Run: `docker compose exec backend bundle exec rspec -f doc`
Expected: 全件PASS

- [ ] **Step 2: フロントエンドの全テストを実行**

Run: `docker compose exec frontend npx vitest run`
Expected: 全件PASS

- [ ] **Step 3: RuboCopを実行**

Run: `docker compose exec backend bundle exec rubocop`
Expected: no offenses detected

- [ ] **Step 4: ESLintを実行**

Run: `docker compose exec frontend npx eslint src/`
Expected: no errors
