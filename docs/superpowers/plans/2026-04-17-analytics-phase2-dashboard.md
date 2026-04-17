# Analytics Phase 2 + PostHog Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PostHog の Phase 2 イベント 4 種（`search_performed` / `episode_progress_updated` / `record_status_changed` / `recommendation_clicked`）を発火させ、さらにスクリプトで PostHog Dashboard / Insight を自動作成して「計測基盤の完成」状態に到達させる。

**Architecture:** フロント側は既存の PostHog ラッパー（`frontend/src/lib/analytics/posthog.ts`）を拡張し、発火箇所に `captureEvent` を追加する。ジャンル横断率用の User Property `distinct_media_types_count` は、新規バックエンド API `GET /api/v1/users/me/media_types` が返す distinct な media_types 配列の長さを `posthog.people.set()` で送る。PostHog Dashboard / Insight はリポジトリルート配下の新規 `scripts/posthog/` ディレクトリで TypeScript + `tsx` 実行するスクリプトで管理し、PostHog REST API を叩いてべき等に作成・更新する。

**Tech Stack:** TypeScript (frontend + scripts/posthog) / React 19 / Vitest / Ruby 3.3 / Rails 8 (API mode) / RSpec / PostHog (`posthog-js` 既存 + REST API 新規) / Node 22 + `tsx` (scripts のみ) / `zod` (PostHog API レスポンスの型バリデーション)

**Spec:** `docs/superpowers/specs/2026-04-17-analytics-phase2-dashboard-design.md`
**Issue:** [#157](https://github.com/IKcoding-jp/Recolly/issues/157)

---

## 実装進捗（次セッションへの引き継ぎ）

最終更新: 2026-04-17

| Task | ステータス | コミット |
|---|---|---|
| Task 1: events.ts に Phase 2 型定義追加 | ✅ 完了 | `a41b040`, `cbdb71a`（MediaType共通化リファクタ） |
| Task 2: posthog.ts に setUserProperty 追加 | ✅ 完了 | `f76fe27` |
| Task 3: GET /api/v1/users/me/media_types API | ✅ 完了 | `3869c7c` |
| Task 4: updateMediaTypesCount ヘルパー | ✅ 完了 | `77271f0` |
| Task 5: search_performed 発火 | ✅ 完了 | `0c0355e`, `dcb8673`（handleGenreChange対応） |
| Task 6〜21 | 未着手 | — |

### 次セッション開始時の手順

1. `git log --oneline feat/analytics-phase2-dashboard-issue-157 -10` で最新状態を確認
2. この plan の Task 6 以降を `superpowers:subagent-driven-development` スキルで継続実行
3. 残タスク中、特に注意する実装情報:
   - `useDashboard.ts` の `handleAction`（line 28-65）が HomePage のクイックアクションのロジック。`episode_progress_updated` / `record_status_changed` の発火ポイント
   - `useWorkDetail.ts` の `handleStatusChange` / `handleEpisodeChange`（デバウンス経由）が WorkDetail の発火ポイント
   - SearchPage の現在の state 変数名: クエリ=`query`, ジャンル=`genre`, 型=`GenreFilter`
   - RecommendationsPage は `handleOpenModal` 内で `recommendation_clicked` 発火（Task 9）
   - `record_created` は現在 SearchPage（2箇所）と RecommendationsPage（1箇所）で発火中。Task 10 でこの 3 箇所に `updateMediaTypesCount()` を追加
4. Docker が起動していない場合は `docker compose up -d` を IK さんに依頼してから進める
5. `lefthook-local.yml` は絶対に作成・改変しない（subagent にも伝える）
6. backend のテストは factory_bot 未導入なので `User.create!` 等のモデル直接生成を使う

### Task 11 でまとめて拾うべき Nit

- `SearchPage.test.tsx` 1件目のテストで `'search_performed'` 文字列リテラル使用 → `ANALYTICS_EVENTS.SEARCH_PERFORMED` に統一

---

## File Structure

### 新規作成

| ファイルパス | 責務 |
|---|---|
| `scripts/posthog/package.json` | scripts 専用の npm プロジェクト（frontend と依存を分離） |
| `scripts/posthog/tsconfig.json` | Node 環境用 TS 設定 |
| `scripts/posthog/.env.example` | Personal API Key / Project ID / Host のプレースホルダー |
| `scripts/posthog/.gitignore` | `.env.local` / `node_modules/` 除外 |
| `scripts/posthog/client.ts` | PostHog REST API の薄いクライアント |
| `scripts/posthog/client.test.ts` | `client.ts` の fetch モックを使ったユニットテスト |
| `scripts/posthog/insights.ts` | Dashboard に載せる 9 本の Insight 定義（TypeScript オブジェクト配列） |
| `scripts/posthog/sync-dashboard.ts` | エントリポイント: Dashboard + Insight をべき等に作成・更新 |
| `scripts/posthog/sync-dashboard.test.ts` | `sync-dashboard.ts` のユニットテスト |
| `scripts/posthog/README.md` | 実行手順書（Personal API Key 取得方法含む） |
| `backend/app/controllers/api/v1/users/me/media_types_controller.rb` | `GET /api/v1/users/me/media_types` のアクション |
| `backend/spec/requests/api/v1/users/me/media_types_spec.rb` | リクエストスペック |
| `frontend/src/lib/analytics/userProperties.ts` | `updateMediaTypesCount()` ヘルパー（バックエンド API を呼んで `$set` する） |
| `frontend/src/lib/analytics/userProperties.test.ts` | `userProperties.ts` のユニットテスト |
| `docs/posthog-dashboard.md` | Dashboard と 9 本の Insight の運用メモ |

### 修正

| ファイルパス | 変更内容 |
|---|---|
| `frontend/src/lib/analytics/events.ts` | Phase 2 イベント 4 種の定数と型定義を追加 |
| `frontend/src/lib/analytics/posthog.ts` | `setUserProperty()` を追加 |
| `frontend/src/lib/analytics/posthog.test.ts` | `setUserProperty` のテストと Phase 2 プロパティのテストを追加 |
| `frontend/src/lib/usersApi.ts` | `getMyMediaTypes()` を追加 |
| `frontend/src/pages/SearchPage/SearchPage.tsx` | `search_performed` 発火 + 既存の record_created 後に `updateMediaTypesCount` 呼び出し |
| `frontend/src/pages/SearchPage/SearchPage.test.tsx` | 上記のテストを追加 |
| `frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx` | `recommendation_clicked` 発火 + record_created 後に `updateMediaTypesCount` 呼び出し |
| `frontend/src/pages/RecommendationsPage/RecommendationsPage.test.tsx` | 上記のテストを追加 |
| `frontend/src/hooks/useDashboard.ts` | `episode_progress_updated` と `record_status_changed` を発火 |
| `frontend/src/hooks/useDashboard.test.ts` | 既存のテストファイルに追記（存在しなければ新規作成） |
| `frontend/src/hooks/useDebouncedRecordUpdate.ts` | `onSuccess` コールバック引数を追加（WorkDetail で発火させるため） |
| `frontend/src/hooks/useDebouncedRecordUpdate.test.ts` | `onSuccess` の呼び出しテスト追加（既存または新規） |
| `frontend/src/pages/WorkDetailPage/useWorkDetail.ts` | `handleStatusChange` で `record_status_changed` 発火、`handleEpisodeChange` のデバウンス後に `episode_progress_updated` 発火 |
| `frontend/src/pages/WorkDetailPage/WorkDetailPage.test.tsx` | 上記のテストを追加 |
| `frontend/src/pages/PrivacyPage/PrivacyPage.tsx` | Phase 2 計測内容を追記 |
| `backend/config/routes.rb` | 新規 API のルーティング追加 |
| `docs/TODO.md` | 完了した TODO 項目をチェック済みに更新 |

---

## 実装順序の原則

1. **基盤を先に作る**（Task 1〜4）: 型定義・API 側の下準備・共通ヘルパー。これがないと発火側を書けない。
2. **発火側を追加**（Task 5〜11）: 4 イベント + 既存 record_created のヘルパー統合。各ページ・hook 単位で順番に。
3. **Dashboard スクリプト**（Task 12〜16）: フロント・バックエンドから独立しているので、いつでも着手可能。
4. **ドキュメント更新**（Task 17〜19）: プライバシーポリシー / 運用メモ / TODO.md。
5. **手動検証**（Task 20）: 全てをローカルで動かして PostHog UI で確認。

全タスクで **TDD の 5 ステップ**を踏む：テスト書く → 失敗確認 → 実装 → 成功確認 → コミット。

---

## Task 1: `events.ts` に Phase 2 の型定義を追加

**Files:**
- Modify: `frontend/src/lib/analytics/events.ts`
- Test: 型レベル検証のため別ファイルのテストは不要（TypeScript の型チェックで担保）

- [ ] **Step 1: 型定義を追加**

`frontend/src/lib/analytics/events.ts` を以下に置き換える:

```typescript
/**
 * PostHog に送信するイベント名の定数定義。
 * 文字列リテラルの typo を防ぐため、発火側は必ずこの定数経由で指定する。
 * Spec: docs/superpowers/specs/2026-04-17-analytics-phase2-dashboard-design.md §2.1
 */
export const ANALYTICS_EVENTS = {
  PAGEVIEW: '$pageview',
  SIGNUP_COMPLETED: 'signup_completed',
  RECORD_CREATED: 'record_created',
  SEARCH_PERFORMED: 'search_performed',
  EPISODE_PROGRESS_UPDATED: 'episode_progress_updated',
  RECORD_STATUS_CHANGED: 'record_status_changed',
  RECOMMENDATION_CLICKED: 'recommendation_clicked',
} as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

/** signup_completed のプロパティ */
export type SignupCompletedProps = {
  method: 'email' | 'google'
}

/** record_created のプロパティ */
export type RecordCreatedProps = {
  media_type: 'anime' | 'movie' | 'drama' | 'book' | 'manga' | 'game'
}

/** search_performed のプロパティ */
export type SearchPerformedProps = {
  query_length: number
  genre_filter: 'all' | 'anime' | 'movie' | 'drama' | 'book' | 'manga' | 'game'
  result_count: number
}

/** episode_progress_updated のプロパティ */
export type EpisodeProgressUpdatedProps = {
  media_type: 'anime' | 'movie' | 'drama' | 'book' | 'manga' | 'game'
  increment_type: 'episode' | 'volume' | 'watched' | 'read' | 'cleared'
  new_value: number
}

/** record_status_changed のプロパティ */
export type RecordStatusChangedProps = {
  media_type: 'anime' | 'movie' | 'drama' | 'book' | 'manga' | 'game'
  from_status: string
  to_status: string
}

/** recommendation_clicked のプロパティ */
export type RecommendationClickedProps = {
  media_type: 'anime' | 'movie' | 'drama' | 'book' | 'manga' | 'game'
  position: number
  has_reason: boolean
}
```

- [ ] **Step 2: 型チェックで確認**

Run: `cd frontend && npm run typecheck`
Expected: 型エラーなし（`ANALYTICS_EVENTS.SEARCH_PERFORMED` などは既存コードから参照されていないので、追加自体は型安全）

- [ ] **Step 3: 既存テスト実行で既存機能が壊れていないか確認**

Run: `cd frontend && npx vitest run src/lib/analytics/posthog.test.ts`
Expected: PASS（既存 3 イベントのテストは影響を受けない）

- [ ] **Step 4: コミット**

```bash
git add frontend/src/lib/analytics/events.ts
git commit -m "feat(analytics): Phase 2 イベント 4 種の型定義を追加

spec §2.1 に準拠。search_performed / episode_progress_updated /
record_status_changed / recommendation_clicked の ANALYTICS_EVENTS
定数と TypeScript 型定義を追加する。発火コードの追加は後続タスクで行う。"
```

---

## Task 2: `posthog.ts` に `setUserProperty` を追加

**Files:**
- Modify: `frontend/src/lib/analytics/posthog.ts`
- Test: `frontend/src/lib/analytics/posthog.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/lib/analytics/posthog.test.ts` の末尾（`__resetForTest` の直前あたり）に以下を追加:

```typescript
  describe('setUserProperty', () => {
    it('initialized=false の状態では何もしない', () => {
      __resetForTest()
      setUserProperty({ foo: 'bar' })
      expect(posthog.people.set).not.toHaveBeenCalled()
    })

    it('initialized=true のときに posthog.people.set を呼ぶ', () => {
      initAnalytics({ key: 'phc_test', host: 'https://us.i.posthog.com' })
      setUserProperty({ distinct_media_types_count: 3 })
      expect(posthog.people.set).toHaveBeenCalledWith({ distinct_media_types_count: 3 })
    })

    it('posthog.people.set が例外を投げても伝播しない', () => {
      initAnalytics({ key: 'phc_test', host: 'https://us.i.posthog.com' })
      vi.mocked(posthog.people.set).mockImplementation(() => {
        throw new Error('boom')
      })
      expect(() => setUserProperty({ foo: 'bar' })).not.toThrow()
    })
  })
```

ファイル先頭の import に `setUserProperty` を追加:

```typescript
import { initAnalytics, identifyUser, resetAnalytics, captureEvent, capturePageview, setUserProperty, __resetForTest } from './posthog'
```

また、`posthog-js` のモック定義で `people.set` が存在するように拡張する（既存のモックに追記）:

```typescript
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
    people: {
      set: vi.fn(),
    },
  },
}))
```

- [ ] **Step 2: テストを実行して失敗することを確認**

Run: `cd frontend && npx vitest run src/lib/analytics/posthog.test.ts`
Expected: FAIL with `setUserProperty is not a function` or similar

- [ ] **Step 3: 実装を追加**

`frontend/src/lib/analytics/posthog.ts` の末尾、`__resetForTest` の直前に以下を追加:

```typescript
export function setUserProperty(properties: Record<string, unknown>): void {
  if (!initialized) return
  try {
    posthog.people.set(properties)
  } catch (error) {
    console.warn('[analytics] setUserProperty failed:', error)
  }
}
```

- [ ] **Step 4: テストを実行して成功することを確認**

Run: `cd frontend && npx vitest run src/lib/analytics/posthog.test.ts`
Expected: PASS（全テスト）

- [ ] **Step 5: コミット**

```bash
git add frontend/src/lib/analytics/posthog.ts frontend/src/lib/analytics/posthog.test.ts
git commit -m "feat(analytics): setUserProperty を追加

PostHog の User Property を更新する薄いラッパー。distinct_media_types_count
の更新に使う。既存の captureEvent と同じ方針で、initialized=false ならサイレント、
例外は握りつぶして console.warn のみ。"
```

---

## Task 3: バックエンド `GET /api/v1/users/me/media_types` 実装

**Files:**
- Create: `backend/app/controllers/api/v1/users/me/media_types_controller.rb`
- Create: `backend/spec/requests/api/v1/users/me/media_types_spec.rb`
- Modify: `backend/config/routes.rb`

- [ ] **Step 1: 失敗するリクエストスペックを書く**

`backend/spec/requests/api/v1/users/me/media_types_spec.rb`:

```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'GET /api/v1/users/me/media_types', type: :request do
  let(:user) { create(:user) }

  context '未認証の場合' do
    it '401 を返す' do
      get '/api/v1/users/me/media_types'
      expect(response).to have_http_status(:unauthorized)
    end
  end

  context '認証済みで記録がない場合' do
    before { sign_in user }

    it '空配列を返す' do
      get '/api/v1/users/me/media_types'
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq({ 'media_types' => [] })
    end
  end

  context '認証済みで複数ジャンルの記録がある場合' do
    before do
      sign_in user
      anime_work = create(:work, media_type: 'anime')
      book_work  = create(:work, media_type: 'book')
      movie_work = create(:work, media_type: 'movie')
      create(:record, user: user, work: anime_work)
      create(:record, user: user, work: book_work)
      create(:record, user: user, work: movie_work)
      # 同じ media_type の重複記録があっても distinct は変わらないことを確認するため追加
      another_anime = create(:work, media_type: 'anime')
      create(:record, user: user, work: another_anime)
    end

    it 'distinct な media_types を返す' do
      get '/api/v1/users/me/media_types'
      expect(response).to have_http_status(:ok)
      media_types = response.parsed_body['media_types']
      expect(media_types).to contain_exactly('anime', 'book', 'movie')
    end
  end

  context '他ユーザーの記録は含まない' do
    before do
      other_user = create(:user)
      other_work = create(:work, media_type: 'game')
      create(:record, user: other_user, work: other_work)
      sign_in user
    end

    it '自分の記録のみ集計する' do
      get '/api/v1/users/me/media_types'
      expect(response.parsed_body['media_types']).to eq([])
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗することを確認**

Run: `cd backend && bundle exec rspec spec/requests/api/v1/users/me/media_types_spec.rb`
Expected: FAIL with routing error（`No route matches`）

- [ ] **Step 3: ルートを追加**

`backend/config/routes.rb` の `resource :current_user` の直下あたりに追記:

```ruby
      # 認証済みユーザー自身の記録から集計した情報
      namespace :users do
        namespace :me do
          get :media_types, to: 'media_types#index'
        end
      end
```

（もし Rails の慣習上 `scope '/users/me'` のほうがシンプルなら以下でも可：
```ruby
      scope '/users/me' do
        get :media_types, to: 'users/me/media_types#index'
      end
```
実装時に `rails routes` で `/api/v1/users/me/media_types` が出ることを確認すること。）

- [ ] **Step 4: コントローラーを実装**

`backend/app/controllers/api/v1/users/me/media_types_controller.rb`:

```ruby
# frozen_string_literal: true

module Api
  module V1
    module Users
      module Me
        # 認証済みユーザー自身の distinct な media_type 一覧を返す。
        # PostHog の User Property 「distinct_media_types_count」算出に使う。
        # Spec: docs/superpowers/specs/2026-04-17-analytics-phase2-dashboard-design.md §3.2
        class MediaTypesController < ApplicationController
          before_action :authenticate_user!

          def index
            media_types = current_user.records
                                      .joins(:work)
                                      .distinct
                                      .pluck('works.media_type')
            render json: { media_types: media_types }
          end
        end
      end
    end
  end
end
```

（注意: `current_user.records` が works と join 可能な構造か事前に確認。もし `Record.belongs_to :work` で関連があれば上記でよい。実装時に `rails console` で確認してもよい。）

- [ ] **Step 5: テストを実行して成功することを確認**

Run: `cd backend && bundle exec rspec spec/requests/api/v1/users/me/media_types_spec.rb`
Expected: PASS（全 4 テスト）

- [ ] **Step 6: RuboCop 実行**

Run: `cd backend && bundle exec rubocop app/controllers/api/v1/users/me/media_types_controller.rb spec/requests/api/v1/users/me/media_types_spec.rb`
Expected: no offenses

- [ ] **Step 7: コミット**

```bash
git add backend/app/controllers/api/v1/users/me/media_types_controller.rb \
        backend/spec/requests/api/v1/users/me/media_types_spec.rb \
        backend/config/routes.rb
git commit -m "feat(backend): GET /api/v1/users/me/media_types を追加

認証済みユーザーの distinct な media_type 一覧を返す。
PostHog User Property distinct_media_types_count の算出に使う。
Spec §3.2 参照。"
```

---

## Task 4: `usersApi.getMyMediaTypes` と `updateMediaTypesCount` ヘルパーを追加

**Files:**
- Modify: `frontend/src/lib/usersApi.ts`
- Create: `frontend/src/lib/analytics/userProperties.ts`
- Create: `frontend/src/lib/analytics/userProperties.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/lib/analytics/userProperties.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateMediaTypesCount } from './userProperties'
import { setUserProperty } from './posthog'
import { usersApi } from '../usersApi'

vi.mock('./posthog', () => ({
  setUserProperty: vi.fn(),
}))

vi.mock('../usersApi', () => ({
  usersApi: {
    getMyMediaTypes: vi.fn(),
  },
}))

describe('updateMediaTypesCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('API のレスポンス長を distinct_media_types_count として setUserProperty に渡す', async () => {
    vi.mocked(usersApi.getMyMediaTypes).mockResolvedValue({
      media_types: ['anime', 'book', 'movie'],
    })
    await updateMediaTypesCount()
    expect(setUserProperty).toHaveBeenCalledWith({ distinct_media_types_count: 3 })
  })

  it('媒体が 0 のときは 0 を送る', async () => {
    vi.mocked(usersApi.getMyMediaTypes).mockResolvedValue({ media_types: [] })
    await updateMediaTypesCount()
    expect(setUserProperty).toHaveBeenCalledWith({ distinct_media_types_count: 0 })
  })

  it('API 失敗時はサイレントに握りつぶす（例外を投げない）', async () => {
    vi.mocked(usersApi.getMyMediaTypes).mockRejectedValue(new Error('network error'))
    await expect(updateMediaTypesCount()).resolves.toBeUndefined()
    expect(setUserProperty).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: テストを実行して失敗することを確認**

Run: `cd frontend && npx vitest run src/lib/analytics/userProperties.test.ts`
Expected: FAIL with `Cannot find module './userProperties'` もしくは `getMyMediaTypes is not a function`

- [ ] **Step 3: `usersApi.ts` に `getMyMediaTypes` を追加**

`frontend/src/lib/usersApi.ts` に追記:

```typescript
export type MyMediaTypesResponse = {
  media_types: Array<'anime' | 'movie' | 'drama' | 'book' | 'manga' | 'game'>
}

// usersApi オブジェクトにメソッドを追加（既存オブジェクトの末尾に追記）
  getMyMediaTypes(): Promise<MyMediaTypesResponse> {
    return request<MyMediaTypesResponse>('/users/me/media_types')
  },
```

- [ ] **Step 4: `userProperties.ts` を作成**

`frontend/src/lib/analytics/userProperties.ts`:

```typescript
import { usersApi } from '../usersApi'
import { setUserProperty } from './posthog'

/**
 * バックエンドから自分の distinct media_types を取得し、
 * PostHog の User Property distinct_media_types_count を更新する。
 *
 * 呼び出しタイミング: record_created 発火直後。ジャンル横断率 Insight
 * （spec §4.3）の User Property 方式で使う。
 *
 * 失敗時はサイレント（Phase 1 の既存方針と同じ）。記録作成自体の成功体験を阻害しない。
 */
export async function updateMediaTypesCount(): Promise<void> {
  try {
    const { media_types } = await usersApi.getMyMediaTypes()
    setUserProperty({ distinct_media_types_count: media_types.length })
  } catch (error) {
    console.warn('[analytics] updateMediaTypesCount failed:', error)
  }
}
```

- [ ] **Step 5: テストを実行して成功することを確認**

Run: `cd frontend && npx vitest run src/lib/analytics/userProperties.test.ts`
Expected: PASS（全 3 テスト）

- [ ] **Step 6: コミット**

```bash
git add frontend/src/lib/usersApi.ts \
        frontend/src/lib/analytics/userProperties.ts \
        frontend/src/lib/analytics/userProperties.test.ts
git commit -m "feat(analytics): updateMediaTypesCount ヘルパーを追加

記録作成時に GET /api/v1/users/me/media_types を呼び、
distinct な media_type 数を User Property として PostHog に送る。
ジャンル横断率 Insight の User Property 方式 (spec §4.3) の実装。"
```

---

## Task 5: `search_performed` 発火（SearchPage）

**Files:**
- Modify: `frontend/src/pages/SearchPage/SearchPage.tsx`
- Test: `frontend/src/pages/SearchPage/SearchPage.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`SearchPage.test.tsx` の既存テストスイートの中に追加:

```typescript
  it('検索成功時に search_performed イベントが発火する', async () => {
    vi.mocked(worksApi.search).mockResolvedValue({
      results: [mockWorkA, mockWorkB],
    })
    renderSearchPage()

    const input = screen.getByPlaceholderText(/作品タイトル/i)
    await userEvent.type(input, '進撃')
    await userEvent.click(screen.getByRole('button', { name: '検索' }))

    await waitFor(() => {
      expect(captureEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.SEARCH_PERFORMED,
        { query_length: 2, genre_filter: 'all', result_count: 2 },
      )
    })
  })

  it('検索失敗時は search_performed を発火しない', async () => {
    vi.mocked(worksApi.search).mockRejectedValue(new Error('api error'))
    renderSearchPage()

    const input = screen.getByPlaceholderText(/作品タイトル/i)
    await userEvent.type(input, 'x')
    await userEvent.click(screen.getByRole('button', { name: '検索' }))

    await waitFor(() => {
      expect(vi.mocked(worksApi.search)).toHaveBeenCalled()
    })
    expect(captureEvent).not.toHaveBeenCalledWith(
      ANALYTICS_EVENTS.SEARCH_PERFORMED,
      expect.anything(),
    )
  })
```

（`mockWorkA` / `mockWorkB` / `renderSearchPage` は既存テストのヘルパーがあればそれを使う。無ければ追加する。`captureEvent` と `ANALYTICS_EVENTS` のインポートも test 先頭に追加する。）

- [ ] **Step 2: テスト実行で失敗確認**

Run: `cd frontend && npx vitest run src/pages/SearchPage/SearchPage.test.tsx`
Expected: FAIL（新規テスト 2 件）

- [ ] **Step 3: 実装を追加**

`SearchPage.tsx` の検索ハンドラー内、`setResults(response.results)` の直後あたりに追加:

```tsx
      const results = response.results
      setResults(results)
      captureEvent(ANALYTICS_EVENTS.SEARCH_PERFORMED, {
        query_length: query.length,
        genre_filter: genreFilter,
        result_count: results.length,
      })
```

（既存の state 変数名 `query` / `genreFilter` / `setResults` はファイル内の実装に合わせる。）

- [ ] **Step 4: テスト実行で成功確認**

Run: `cd frontend && npx vitest run src/pages/SearchPage/SearchPage.test.tsx`
Expected: PASS（全テスト）

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/SearchPage/SearchPage.tsx \
        frontend/src/pages/SearchPage/SearchPage.test.tsx
git commit -m "feat(analytics): search_performed イベントを SearchPage から発火

クエリ本文は送らず query_length / genre_filter / result_count のみ送る
(spec §2.1)。検索成功時のみ発火し、失敗時は発火しない。"
```

---

## Task 6: `episode_progress_updated` と `record_status_changed` を useDashboard に追加

**Files:**
- Modify: `frontend/src/hooks/useDashboard.ts`
- Test: `frontend/src/hooks/useDashboard.test.ts`（なければ新規作成）

HomePage のワンクリック操作は 2 種類に分かれる（`useDashboard.ts` L28-65 参照）:
- `hasEpisodes(mediaType)` が true: current_episode をインクリメント → `episode_progress_updated` 発火。さらに自動で status='completed' になった場合は `record_status_changed` も発火。
- `hasEpisodes(mediaType)` が false: status='completed' に直接更新 → `record_status_changed` 発火。

- [ ] **Step 1: テストファイルの存在確認と準備**

Run: `cd frontend && ls src/hooks/useDashboard.test.ts 2>/dev/null && echo EXISTS || echo MISSING`

存在しない場合は新規作成する（`renderHook` + `act` パターンで useDashboard を検証）。既存であれば追記。

- [ ] **Step 2: 失敗するテストを書く**

`frontend/src/hooks/useDashboard.test.ts`（例、新規作成時）:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useDashboard } from './useDashboard'
import { recordsApi } from '../lib/recordsApi'
import { captureEvent } from '../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../lib/analytics/events'

vi.mock('../lib/recordsApi')
vi.mock('../lib/analytics/posthog', () => ({
  captureEvent: vi.fn(),
}))

const animeRecord = {
  id: 1,
  status: 'watching' as const,
  current_episode: 3,
  work: { id: 10, media_type: 'anime' as const, title: 'X', total_episodes: 12 },
  // 他の必須フィールドは省略（実際のテストでは完全な型で）
} as const

const bookRecord = {
  id: 2,
  status: 'watching' as const,
  current_episode: 0,
  work: { id: 11, media_type: 'book' as const, title: 'Y', total_episodes: null },
} as const

describe('useDashboard handleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: [animeRecord, bookRecord] } as never)
  })

  it('アニメ記録の +1 話で episode_progress_updated が発火する', async () => {
    vi.mocked(recordsApi.update).mockResolvedValue({
      record: { ...animeRecord, current_episode: 4 },
    } as never)

    const { result } = renderHook(() => useDashboard())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleAction(animeRecord as never)
    })

    expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.EPISODE_PROGRESS_UPDATED, {
      media_type: 'anime',
      increment_type: 'episode',
      new_value: 4,
    })
  })

  it('+1 話で自動 completed になった場合は record_status_changed も発火する', async () => {
    const lastEpisode = { ...animeRecord, current_episode: 11 }
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: [lastEpisode] } as never)
    vi.mocked(recordsApi.update).mockResolvedValue({
      record: { ...lastEpisode, current_episode: 12, status: 'completed' },
    } as never)

    const { result } = renderHook(() => useDashboard())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleAction(lastEpisode as never)
    })

    expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.EPISODE_PROGRESS_UPDATED, expect.any(Object))
    expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.RECORD_STATUS_CHANGED, {
      media_type: 'anime',
      from_status: 'watching',
      to_status: 'completed',
    })
  })

  it('話数のないメディアの完了アクションで record_status_changed が発火する', async () => {
    vi.mocked(recordsApi.update).mockResolvedValue({
      record: { ...bookRecord, status: 'completed' },
    } as never)

    const { result } = renderHook(() => useDashboard())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleAction(bookRecord as never)
    })

    expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.RECORD_STATUS_CHANGED, {
      media_type: 'book',
      from_status: 'watching',
      to_status: 'completed',
    })
    expect(captureEvent).not.toHaveBeenCalledWith(
      ANALYTICS_EVENTS.EPISODE_PROGRESS_UPDATED,
      expect.anything(),
    )
  })

  it('API 失敗時はイベントを発火しない', async () => {
    vi.mocked(recordsApi.update).mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useDashboard())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleAction(animeRecord as never)
    })

    expect(captureEvent).not.toHaveBeenCalledWith(
      ANALYTICS_EVENTS.EPISODE_PROGRESS_UPDATED,
      expect.anything(),
    )
  })
})
```

- [ ] **Step 3: テスト実行で失敗確認**

Run: `cd frontend && npx vitest run src/hooks/useDashboard.test.ts`
Expected: FAIL（4 テスト全て）

- [ ] **Step 4: 実装を修正**

`frontend/src/hooks/useDashboard.ts` の先頭に import 追加:

```typescript
import { captureEvent } from '../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../lib/analytics/events'
```

`handleAction` の実装を以下のように変更（既存の L28-65）:

```typescript
  const handleAction = useCallback(async (record: UserRecord) => {
    const mediaType = record.work.media_type

    if (hasEpisodes(mediaType)) {
      const totalEpisodes = record.work.total_episodes
      if (totalEpisodes !== null && record.current_episode >= totalEpisodes) {
        return
      }

      const newEpisode = record.current_episode + 1
      setRecords((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, current_episode: newEpisode } : r)),
      )
      try {
        const { record: updated } = await recordsApi.update(record.id, {
          current_episode: newEpisode,
        })
        // 進捗更新イベント（episode カウントアップ）
        captureEvent(ANALYTICS_EVENTS.EPISODE_PROGRESS_UPDATED, {
          media_type: mediaType,
          increment_type: 'episode',
          new_value: newEpisode,
        })
        if (updated.status === 'completed') {
          // 自動 completed の場合はステータス変更イベントも発火
          captureEvent(ANALYTICS_EVENTS.RECORD_STATUS_CHANGED, {
            media_type: mediaType,
            from_status: record.status,
            to_status: 'completed',
          })
          setRecords((prev) => prev.filter((r) => r.id !== record.id))
        }
      } catch {
        setRecords((prev) =>
          prev.map((r) =>
            r.id === record.id ? { ...r, current_episode: record.current_episode } : r,
          ),
        )
        setError('進捗の更新に失敗しました')
      }
    } else {
      try {
        await recordsApi.update(record.id, { status: 'completed' })
        // ステータス遷移イベント
        captureEvent(ANALYTICS_EVENTS.RECORD_STATUS_CHANGED, {
          media_type: mediaType,
          from_status: record.status,
          to_status: 'completed',
        })
        setRecords((prev) => prev.filter((r) => r.id !== record.id))
      } catch {
        setError('ステータスの更新に失敗しました')
      }
    }
  }, [])
```

- [ ] **Step 5: テスト実行で成功確認**

Run: `cd frontend && npx vitest run src/hooks/useDashboard.test.ts`
Expected: PASS（全テスト）

- [ ] **Step 6: 既存の統合テストも回して回帰なし確認**

Run: `cd frontend && npx vitest run src/pages/HomePage/HomePage.test.tsx`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add frontend/src/hooks/useDashboard.ts frontend/src/hooks/useDashboard.test.ts
git commit -m "feat(analytics): HomePage のクイックアクションから 2 イベント発火

useDashboard.handleAction から以下を発火:
- episode_progress_updated (話数のあるメディアの +1 話)
- record_status_changed (自動 completed、または話数なしメディアの完了)

話数のあるメディアが自動で completed に遷移した場合は両イベントを発火する
(spec §2.2 『episode_progress_updated と record_status_changed の関係』)。"
```

---

## Task 7: `useDebouncedRecordUpdate` に onSuccess コールバックを追加

**Files:**
- Modify: `frontend/src/hooks/useDebouncedRecordUpdate.ts`
- Test: `frontend/src/hooks/useDebouncedRecordUpdate.test.ts`（存在しなければ新規）

WorkDetailPage からの episode_progress_updated 発火は、デバウンス（300ms）後の API 成功時である必要がある。そのために `useDebouncedRecordUpdate` にコールバックオプションを追加する。

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/hooks/useDebouncedRecordUpdate.test.ts` を確認し、なければ新規作成。以下のテストを追加:

```typescript
it('onSuccess コールバックが API 成功時に呼ばれる', async () => {
  vi.mocked(recordsApi.update).mockResolvedValue({
    record: { ...initialRecord, current_episode: 5 },
  } as never)
  const onSuccess = vi.fn()

  const { result } = renderHook(() =>
    useDebouncedRecordUpdate({
      record: initialRecord,
      setState,
      delayMs: 10,
      onSuccess,
    }),
  )
  act(() => {
    result.current({ current_episode: 5 })
  })
  // デバウンス経過を待つ
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  expect(onSuccess).toHaveBeenCalledWith(
    { ...initialRecord, current_episode: 5 },
    { current_episode: 5 },
  )
})

it('onSuccess は API 失敗時には呼ばれない', async () => {
  vi.mocked(recordsApi.update).mockRejectedValue(new Error('boom'))
  const onSuccess = vi.fn()

  const { result } = renderHook(() =>
    useDebouncedRecordUpdate({
      record: initialRecord,
      setState,
      delayMs: 10,
      onSuccess,
    }),
  )
  act(() => {
    result.current({ current_episode: 5 })
  })
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(onSuccess).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: テスト実行で失敗確認**

Run: `cd frontend && npx vitest run src/hooks/useDebouncedRecordUpdate.test.ts`
Expected: FAIL（`onSuccess` がまだ型にない）

- [ ] **Step 3: 実装を修正**

`useDebouncedRecordUpdate.ts` の `UseDebouncedRecordUpdateParams` に追加:

```typescript
type UseDebouncedRecordUpdateParams = {
  record: UserRecord | null
  setState: React.Dispatch<React.SetStateAction<WorkDetailState>>
  delayMs?: number
  /** API 成功時に呼ばれる。更新後のレコードと送信した params を引数にとる。 */
  onSuccess?: (updated: UserRecord, params: DebouncedFields) => void
}
```

関数シグネチャと destructuring を修正:

```typescript
export function useDebouncedRecordUpdate({
  record,
  setState,
  delayMs = DEBOUNCE_DELAY_MS,
  onSuccess,
}: UseDebouncedRecordUpdateParams): (params: DebouncedFields) => void {
```

`.then((res) => { ... })` の中、`setState` の後に以下を追加:

```typescript
          .then((res) => {
            if (generationRef.current !== generation) return
            setState((prev) => {
              if (!prev.record) return prev
              return { ...prev, record: res.record }
            })
            onSuccess?.(res.record, mergedParams)
          })
```

- [ ] **Step 4: テスト実行で成功確認**

Run: `cd frontend && npx vitest run src/hooks/useDebouncedRecordUpdate.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/hooks/useDebouncedRecordUpdate.ts \
        frontend/src/hooks/useDebouncedRecordUpdate.test.ts
git commit -m "feat(hooks): useDebouncedRecordUpdate に onSuccess コールバックを追加

API 成功時に呼び出し側で追加処理（analytics 発火など）ができるように。
既存の呼び出し側は onSuccess を渡さなければ挙動変更なし。"
```

---

## Task 8: WorkDetailPage から `episode_progress_updated` / `record_status_changed` を発火

**Files:**
- Modify: `frontend/src/pages/WorkDetailPage/useWorkDetail.ts`
- Test: `frontend/src/pages/WorkDetailPage/WorkDetailPage.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`WorkDetailPage.test.tsx` に以下を追加（既存ヘルパーを再利用）:

```typescript
  it('ステータス変更時に record_status_changed が発火する', async () => {
    vi.mocked(recordsApi.update).mockResolvedValue({
      record: { ...mockAnimeRecord, status: 'completed' },
    } as never)

    renderWorkDetailPage(mockAnimeRecord)
    await screen.findByText(mockAnimeRecord.work.title)

    const statusButton = screen.getByRole('button', { name: '完了' })
    await userEvent.click(statusButton)

    await waitFor(() => {
      expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.RECORD_STATUS_CHANGED, {
        media_type: 'anime',
        from_status: 'watching',
        to_status: 'completed',
      })
    })
  })

  it('話数のデバウンス後 API 成功で episode_progress_updated が発火する', async () => {
    vi.mocked(recordsApi.update).mockResolvedValue({
      record: { ...mockAnimeRecord, current_episode: 5 },
    } as never)

    renderWorkDetailPage(mockAnimeRecord)
    await screen.findByText(mockAnimeRecord.work.title)

    // ProgressControl の +1 ボタンクリック（既存の selector に合わせる）
    const incButton = screen.getByRole('button', { name: '+1話' })
    await userEvent.click(incButton)

    // デバウンス（300ms）+ API レスポンス待ち
    await waitFor(
      () => {
        expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.EPISODE_PROGRESS_UPDATED, {
          media_type: 'anime',
          increment_type: 'episode',
          new_value: 5,
        })
      },
      { timeout: 1000 },
    )
  })
```

- [ ] **Step 2: テスト実行で失敗確認**

Run: `cd frontend && npx vitest run src/pages/WorkDetailPage/WorkDetailPage.test.tsx`
Expected: FAIL（新規テスト 2 件）

- [ ] **Step 3: `useWorkDetail.ts` の実装を修正**

import 追加:

```typescript
import { captureEvent } from '../../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'
```

`handleStatusChange` を修正（status 変更後に発火）:

```typescript
  const handleStatusChange = useCallback(
    (status: RecordStatus) => {
      if (!state.record) return
      const mediaType = state.record.work.media_type
      const fromStatus = state.record.status
      void updateRecord({ status }).then(() => {
        captureEvent(ANALYTICS_EVENTS.RECORD_STATUS_CHANGED, {
          media_type: mediaType,
          from_status: fromStatus,
          to_status: status,
        })
      })
    },
    [state.record, updateRecord],
  )
```

（注: `updateRecord` が例外を握りつぶしているので、API 失敗時に発火しないようにするため、別の判定が必要。`updateRecord` を `async` のまま resolve 値を見て発火するか、もしくは直接 `recordsApi.update` を呼ぶように書き直す方が筋が良い。以下に書き直し版を示す。）

`useWorkDetail.ts` の `updateRecord` を以下に修正（成功/失敗を呼び出し側に伝える）:

```typescript
  const updateRecord = useCallback(
    async (params: {
      status?: RecordStatus
      rating?: number | null
      current_episode?: number
      review_text?: string | null
      rewatch_count?: number
    }): Promise<UserRecord | null> => {
      if (!state.record) return null
      try {
        const res = await recordsApi.update(state.record.id, params)
        setState((prev) => ({ ...prev, record: res.record }))
        return res.record
      } catch {
        return null
      }
    },
    [state.record],
  )
```

`handleStatusChange` を以下に:

```typescript
  const handleStatusChange = useCallback(
    async (status: RecordStatus) => {
      if (!state.record) return
      const fromStatus = state.record.status
      const mediaType = state.record.work.media_type
      const updated = await updateRecord({ status })
      if (updated) {
        captureEvent(ANALYTICS_EVENTS.RECORD_STATUS_CHANGED, {
          media_type: mediaType,
          from_status: fromStatus,
          to_status: status,
        })
      }
    },
    [state.record, updateRecord],
  )
```

`handleEpisodeChange` を `onSuccess` 経由で発火に変更:

```typescript
  const debouncedUpdate = useDebouncedRecordUpdate({
    record: state.record,
    setState,
    onSuccess: (updated, params) => {
      if (params.current_episode !== undefined) {
        captureEvent(ANALYTICS_EVENTS.EPISODE_PROGRESS_UPDATED, {
          media_type: updated.work.media_type,
          increment_type: 'episode',
          new_value: params.current_episode,
        })
      }
    },
  })
```

**注意**: `StatusSelector` コンポーネントが `onChange` を同期関数として期待している場合、`handleStatusChange` を async にするとコンパイルエラーが出る可能性。その場合は `async` を外し、void で包む:

```typescript
  const handleStatusChange = useCallback(
    (status: RecordStatus) => {
      if (!state.record) return
      const fromStatus = state.record.status
      const mediaType = state.record.work.media_type
      void updateRecord({ status }).then((updated) => {
        if (updated) {
          captureEvent(ANALYTICS_EVENTS.RECORD_STATUS_CHANGED, {
            media_type: mediaType,
            from_status: fromStatus,
            to_status: status,
          })
        }
      })
    },
    [state.record, updateRecord],
  )
```

- [ ] **Step 4: テスト実行で成功確認**

Run: `cd frontend && npx vitest run src/pages/WorkDetailPage/WorkDetailPage.test.tsx`
Expected: PASS

- [ ] **Step 5: 型チェックと lint**

Run: `cd frontend && npm run typecheck && npm run lint`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/WorkDetailPage/useWorkDetail.ts \
        frontend/src/pages/WorkDetailPage/WorkDetailPage.test.tsx
git commit -m "feat(analytics): WorkDetailPage から 2 イベント発火

- handleStatusChange 成功時に record_status_changed
- デバウンスされた current_episode 更新の API 成功時に
  episode_progress_updated (onSuccess コールバック経由)

updateRecord を Promise<UserRecord | null> を返すように変更し、
呼び出し側で成功を検知できるようにした。"
```

---

## Task 9: `recommendation_clicked` を RecommendationsPage から発火

**Files:**
- Modify: `frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx`
- Test: `frontend/src/pages/RecommendationsPage/RecommendationsPage.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

既存テストに以下を追加:

```typescript
  it('作品カードクリック時に recommendation_clicked が発火する', async () => {
    vi.mocked(useRecommendations).mockReturnValue({
      data: {
        items: [
          { ...mockRecommendedAnime, reason: '好きな作家の作品' },
          { ...mockRecommendedBook, reason: null },
        ],
      },
      status: 'ready',
      isLoading: false,
      isRefreshing: false,
      error: null,
      refresh: vi.fn(),
    } as never)

    render(<RecommendationsPage />)

    const card1 = screen.getByRole('button', { name: new RegExp(mockRecommendedAnime.title) })
    await userEvent.click(card1)

    expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.RECOMMENDATION_CLICKED, {
      media_type: 'anime',
      position: 1,
      has_reason: true,
    })
  })

  it('2番目の作品をクリックすると position=2 で発火する', async () => {
    // ... (同様、position 2 のアサート)
  })
```

- [ ] **Step 2: テスト実行で失敗確認**

Run: `cd frontend && npx vitest run src/pages/RecommendationsPage/RecommendationsPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: 実装を修正**

`RecommendationsPage.tsx` の `handleOpenModal` を修正:

```tsx
  const handleOpenModal = (work: RecommendedWork, position: number) => {
    captureEvent(ANALYTICS_EVENTS.RECOMMENDATION_CLICKED, {
      media_type: work.media_type as MediaType,
      position,
      has_reason: Boolean(work.reason),
    })
    setModalWork(work)
  }
```

呼び出し側（作品カードの onClick）で `position` を渡す:

```tsx
{data.items.map((work, index) => (
  <RecommendedWorkCard
    key={`${work.external_api_source}:${work.external_api_id}`}
    work={work}
    onClick={() => handleOpenModal(work, index + 1)}
  />
))}
```

（既存コードの map を確認し、実際の変数名に合わせる。）

- [ ] **Step 4: テスト実行で成功確認**

Run: `cd frontend && npx vitest run src/pages/RecommendationsPage/RecommendationsPage.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx \
        frontend/src/pages/RecommendationsPage/RecommendationsPage.test.tsx
git commit -m "feat(analytics): recommendation_clicked を RecommendationsPage から発火

position (1-indexed) と has_reason を送信。理由本文は送らない
(PII 方針に準拠、spec §2.4)。"
```

---

## Task 10: 既存の `record_created` 発火箇所で `updateMediaTypesCount` を呼ぶ

**Files:**
- Modify: `frontend/src/pages/SearchPage/SearchPage.tsx`
- Modify: `frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx`
- Test: 両ページの既存テスト

- [ ] **Step 1: 失敗するテストを書く**

SearchPage.test.tsx と RecommendationsPage.test.tsx の「記録作成成功」テストに以下を追加:

```typescript
  it('記録作成成功時に updateMediaTypesCount が呼ばれる', async () => {
    // ... 記録作成フローの setup
    await waitFor(() => {
      expect(updateMediaTypesCount).toHaveBeenCalledTimes(1)
    })
  })
```

`updateMediaTypesCount` のモック:

```typescript
vi.mock('../../lib/analytics/userProperties', () => ({
  updateMediaTypesCount: vi.fn(),
}))
```

- [ ] **Step 2: テスト実行で失敗確認**

Run: `cd frontend && npx vitest run src/pages/SearchPage/SearchPage.test.tsx src/pages/RecommendationsPage/RecommendationsPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: SearchPage を修正**

既存の `captureEvent(ANALYTICS_EVENTS.RECORD_CREATED, ...)` の直後（L124-126 と L133-135 の 2 箇所）に追加:

```tsx
        captureEvent(ANALYTICS_EVENTS.RECORD_CREATED, {
          media_type: modalWork.media_type,
        })
        void updateMediaTypesCount()  // 追加
```

ファイル先頭に import 追加:

```tsx
import { updateMediaTypesCount } from '../../lib/analytics/userProperties'
```

- [ ] **Step 4: RecommendationsPage を修正**

同様に `captureEvent(ANALYTICS_EVENTS.RECORD_CREATED, ...)` の直後（L55-57）に追加:

```tsx
      captureEvent(ANALYTICS_EVENTS.RECORD_CREATED, {
        media_type: modalWork.media_type as MediaType,
      })
      void updateMediaTypesCount()  // 追加
```

import 追加。

- [ ] **Step 5: テスト実行で成功確認**

Run: `cd frontend && npx vitest run src/pages/SearchPage/SearchPage.test.tsx src/pages/RecommendationsPage/RecommendationsPage.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/SearchPage/SearchPage.tsx \
        frontend/src/pages/SearchPage/SearchPage.test.tsx \
        frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx \
        frontend/src/pages/RecommendationsPage/RecommendationsPage.test.tsx
git commit -m "feat(analytics): 記録作成時に distinct_media_types_count を更新

record_created イベント発火直後に updateMediaTypesCount を呼び、
PostHog User Property を最新の distinct な media_type 数に更新する。
ジャンル横断率 Insight (#3) で使用 (spec §4.3)。"
```

---

## Task 11: フロント実装の統合確認

**Files:** 変更なし、検証のみ

- [ ] **Step 1: 全テスト実行**

Run: `cd frontend && npx vitest run`
Expected: 全てパス

- [ ] **Step 2: 型チェック**

Run: `cd frontend && npm run typecheck`
Expected: エラーなし

- [ ] **Step 3: lint**

Run: `cd frontend && npm run lint`
Expected: エラーなし

- [ ] **Step 4: 回帰確認**

既存の HomePage / SearchPage / WorkDetailPage / RecommendationsPage の e2e 相当のテストが全てパスすることを確認。失敗があれば修正。

- [ ] **Step 5: 問題なければ次タスクへ（コミット不要、調整時のみコミット）**

---

## Task 12: `scripts/posthog/` プロジェクト初期化

**Files:**
- Create: `scripts/posthog/package.json`
- Create: `scripts/posthog/tsconfig.json`
- Create: `scripts/posthog/.env.example`
- Create: `scripts/posthog/.gitignore`
- Create: `scripts/posthog/README.md`

- [ ] **Step 1: `package.json` を作成**

`scripts/posthog/package.json`:

```json
{
  "name": "recolly-posthog-scripts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "PostHog Dashboard/Insight を作成・更新するスクリプト (spec: 2026-04-17-analytics-phase2-dashboard-design.md)",
  "scripts": {
    "sync": "tsx sync-dashboard.ts",
    "test": "vitest run"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "zod": "^3.23.8"
  }
}
```

- [ ] **Step 2: `tsconfig.json` を作成**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "verbatimModuleSyntax": true,
    "noEmit": true
  },
  "include": ["*.ts"]
}
```

- [ ] **Step 3: `.env.example` を作成**

```dotenv
# PostHog Personal API Key（ローカルからの手動実行用、CI には入れない）
# 取得方法: PostHog Dashboard → Account Settings → Personal API Keys
POSTHOG_PERSONAL_API_KEY=phx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 対象プロジェクトの ID
# 取得方法: PostHog Dashboard URL の /project/{ID}/ 部分
POSTHOG_PROJECT_ID=123456

# API ホスト（既存の VITE_POSTHOG_HOST と同じ値）
POSTHOG_HOST=https://us.i.posthog.com
```

- [ ] **Step 4: `.gitignore` を作成**

```gitignore
node_modules/
.env.local
```

- [ ] **Step 5: ルートの `.gitignore` に追記**

ルートの `.gitignore` に以下が含まれていない場合は追記:

```gitignore
# PostHog scripts 用
scripts/posthog/.env.local
scripts/posthog/node_modules/
```

- [ ] **Step 6: `README.md` を作成**

```markdown
# scripts/posthog

PostHog Dashboard / Insight を作成・更新するスクリプト。

## セットアップ

1. このディレクトリで `npm install` を実行

2. `.env.example` を `.env.local` にコピーし、以下の 3 値を入力:
   - `POSTHOG_PERSONAL_API_KEY`: PostHog → Account Settings → Personal API Keys で発行
   - `POSTHOG_PROJECT_ID`: PostHog の URL `/project/{ID}/` から取得
   - `POSTHOG_HOST`: `https://us.i.posthog.com`（フロントと同じ値）

## 実行

```bash
npm run sync
```

初回は Dashboard + 9 本の Insight を作成する。2 回目以降は既存を検出して更新のみ行う（べき等）。

## 注意

- Personal API Key はプロジェクト全体を操作可能な強い権限を持つ。`.env.local` は Git に含めないこと（`.gitignore` で除外済み）
- CI では自動実行しない方針（spec §5.4）。必要な更新は IK がローカルから手動で実行する
```

- [ ] **Step 7: npm install を実行**

Run: `cd scripts/posthog && npm install`
Expected: 依存パッケージがインストールされる

- [ ] **Step 8: コミット**

```bash
git add scripts/posthog/package.json scripts/posthog/tsconfig.json \
        scripts/posthog/.env.example scripts/posthog/.gitignore \
        scripts/posthog/README.md .gitignore
# scripts/posthog/package-lock.json や node_modules はコミットしない
# （node_modules は .gitignore で除外されるが、package-lock.json は commit 対象）
git add scripts/posthog/package-lock.json
git commit -m "chore(scripts): scripts/posthog ディレクトリを初期化

PostHog Dashboard/Insight を REST API 経由で作成・更新するスクリプトの
プロジェクト骨格。実行は IK がローカルから手動で行う想定 (spec §5.4)。"
```

---

## Task 13: `scripts/posthog/client.ts` — PostHog REST API クライアント

**Files:**
- Create: `scripts/posthog/client.ts`
- Create: `scripts/posthog/client.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`scripts/posthog/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPosthogClient } from './client'

describe('PostHog API Client', () => {
  const fetchMock = vi.fn()
  global.fetch = fetchMock as unknown as typeof fetch

  beforeEach(() => {
    fetchMock.mockReset()
  })

  const client = createPosthogClient({
    apiKey: 'phx_test',
    projectId: '42',
    host: 'https://us.i.posthog.com',
  })

  it('getInsightByName が正しい URL で GET する', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: 1, name: 'X' }] }),
    })
    const result = await client.getInsightByName('X')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://us.i.posthog.com/api/projects/42/insights/?search=X',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer phx_test' }),
      }),
    )
    expect(result).toEqual({ id: 1, name: 'X' })
  })

  it('getInsightByName が結果なしで null を返す', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
    const result = await client.getInsightByName('X')
    expect(result).toBeNull()
  })

  it('createInsight が正しい POST を送る', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 99, name: 'Y' }) })
    const payload = { name: 'Y', query: {}, dashboards: [1] }
    await client.createInsight(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://us.i.posthog.com/api/projects/42/insights/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    )
  })

  it('API がエラーレスポンスを返したら例外を投げる', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' })
    await expect(client.getInsightByName('X')).rejects.toThrow(/400/)
  })
})
```

- [ ] **Step 2: テスト実行で失敗確認**

Run: `cd scripts/posthog && npm test`
Expected: FAIL（モジュール未実装）

- [ ] **Step 3: `client.ts` を実装**

```typescript
import { z } from 'zod'

export type PosthogClientConfig = {
  apiKey: string
  projectId: string
  host: string
}

const listResponseSchema = z.object({
  results: z.array(z.object({ id: z.number(), name: z.string() }).passthrough()),
})

const itemSchema = z.object({ id: z.number(), name: z.string() }).passthrough()

export type PosthogItem = z.infer<typeof itemSchema>

export type InsightPayload = {
  name: string
  description?: string
  query: unknown
  dashboards?: number[]
}

export type DashboardPayload = {
  name: string
  description?: string
}

async function ensureOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`PostHog API ${res.status}: ${body}`)
  }
}

export function createPosthogClient(config: PosthogClientConfig) {
  const base = `${config.host}/api/projects/${config.projectId}`
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  }

  return {
    async getInsightByName(name: string): Promise<PosthogItem | null> {
      const res = await fetch(`${base}/insights/?search=${encodeURIComponent(name)}`, { headers })
      await ensureOk(res)
      const data = listResponseSchema.parse(await res.json())
      return data.results.find((i) => i.name === name) ?? null
    },
    async createInsight(payload: InsightPayload): Promise<PosthogItem> {
      const res = await fetch(`${base}/insights/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      await ensureOk(res)
      return itemSchema.parse(await res.json())
    },
    async updateInsight(id: number, payload: InsightPayload): Promise<PosthogItem> {
      const res = await fetch(`${base}/insights/${id}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      })
      await ensureOk(res)
      return itemSchema.parse(await res.json())
    },
    async getDashboardByName(name: string): Promise<PosthogItem | null> {
      const res = await fetch(`${base}/dashboards/?search=${encodeURIComponent(name)}`, { headers })
      await ensureOk(res)
      const data = listResponseSchema.parse(await res.json())
      return data.results.find((d) => d.name === name) ?? null
    },
    async createDashboard(payload: DashboardPayload): Promise<PosthogItem> {
      const res = await fetch(`${base}/dashboards/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      await ensureOk(res)
      return itemSchema.parse(await res.json())
    },
  }
}
```

- [ ] **Step 4: テスト実行で成功確認**

Run: `cd scripts/posthog && npm test`
Expected: PASS（全 4 テスト）

- [ ] **Step 5: コミット**

```bash
git add scripts/posthog/client.ts scripts/posthog/client.test.ts
git commit -m "feat(scripts): PostHog REST API クライアントを追加

getInsightByName / createInsight / updateInsight / getDashboardByName /
createDashboard を提供。zod でレスポンスを型安全に検証。
API エラー時は例外を投げる (spec §8.2)。"
```

---

## Task 14: `scripts/posthog/insights.ts` — Insight 定義

**Files:**
- Create: `scripts/posthog/insights.ts`

このタスクは純粋な「データ定義」で副作用がないため、TDD は簡易で良い（型チェックで担保する）。

- [ ] **Step 1: `insights.ts` を作成**

9 本の Insight 定義を TypeScript オブジェクト配列として export する。PostHog の query JSON 形式（HogQL もしくは Trends/Funnel/Retention 用）を調べて各 Insight の定義を書く。

```typescript
/**
 * Dashboard に載せる 9 本の Insight 定義。
 * Spec: docs/superpowers/specs/2026-04-17-analytics-phase2-dashboard-design.md §4.2
 *
 * query の構造は PostHog の Query JSON 形式に従う。詳細:
 * https://posthog.com/docs/api/queries
 */
import type { InsightPayload } from './client'

export const DASHBOARD_NAME = 'Recolly Main Dashboard'
export const DASHBOARD_DESCRIPTION =
  'Recolly の主要 KPI を一覧する。spec: 2026-04-17-analytics-phase2-dashboard-design.md'

export const INSIGHT_DEFINITIONS: InsightPayload[] = [
  {
    name: 'Active Users (DAU/WAU/MAU)',
    description: '利用アクティビティ。$pageview を DAU/WAU/MAU で 3 本線',
    query: {
      kind: 'TrendsQuery',
      series: [
        { event: '$pageview', math: 'dau', name: 'DAU' },
        { event: '$pageview', math: 'weekly_active', name: 'WAU' },
        { event: '$pageview', math: 'monthly_active', name: 'MAU' },
      ],
    },
  },
  {
    name: 'Cumulative Records Created',
    description: '累計記録件数（record_created の total count を cumulative で表示）',
    query: {
      kind: 'TrendsQuery',
      series: [{ event: 'record_created', math: 'total' }],
      trendsFilter: { display: 'ActionsLineGraphCumulative' },
    },
  },
  {
    name: 'Cross-genre Users (Numerator)',
    description: 'ジャンル横断率の分子。distinct_media_types_count >= 2 の unique user 数',
    query: {
      kind: 'TrendsQuery',
      series: [{ event: '$pageview', math: 'dau', name: 'cross-genre users' }],
      properties: {
        type: 'AND',
        values: [
          {
            type: 'person',
            key: 'distinct_media_types_count',
            operator: 'gte',
            value: 2,
          },
        ],
      },
    },
  },
  {
    name: 'All Identified Users (Denominator)',
    description: 'ジャンル横断率の分母。identify 済み全 unique user 数',
    query: {
      kind: 'TrendsQuery',
      series: [{ event: '$pageview', math: 'dau', name: 'identified users' }],
      properties: {
        type: 'AND',
        values: [
          {
            type: 'person',
            key: 'distinct_media_types_count',
            operator: 'is_set',
          },
        ],
      },
    },
  },
  {
    name: 'Funnel: Signup to First Record',
    description: '登録→初回記録ファネル（14日間ウィンドウ）',
    query: {
      kind: 'FunnelsQuery',
      series: [
        { event: 'signup_completed', order: 0 },
        { event: 'record_created', order: 1 },
      ],
      funnelsFilter: { funnelWindowInterval: 14, funnelWindowIntervalUnit: 'day' },
    },
  },
  {
    name: 'Funnel: Search to Record Created',
    description: '検索→記録作成ファネル（30分以内）',
    query: {
      kind: 'FunnelsQuery',
      series: [
        { event: 'search_performed', order: 0 },
        { event: 'record_created', order: 1 },
      ],
      funnelsFilter: { funnelWindowInterval: 30, funnelWindowIntervalUnit: 'minute' },
    },
  },
  {
    name: 'Retention (Day 1/7/30)',
    description: '継続率。$pageview ベースの retention',
    query: {
      kind: 'RetentionQuery',
      retentionFilter: {
        targetEntity: { id: '$pageview', type: 'events' },
        returningEntity: { id: '$pageview', type: 'events' },
        period: 'Day',
      },
    },
  },
  {
    name: 'Status Transition Distribution',
    description: 'ステータス遷移の分布。from_status × to_status でブレイクダウン',
    query: {
      kind: 'TrendsQuery',
      series: [{ event: 'record_status_changed', math: 'total' }],
      breakdownFilter: {
        breakdown: ['from_status', 'to_status'],
        breakdown_type: 'event',
      },
    },
  },
  {
    name: 'Records by Media Type',
    description: 'メディアタイプ別の記録件数',
    query: {
      kind: 'TrendsQuery',
      series: [{ event: 'record_created', math: 'total' }],
      breakdownFilter: {
        breakdown: 'media_type',
        breakdown_type: 'event',
      },
    },
  },
]
```

**注意**: PostHog の query JSON 形式は API バージョンによって差がある。実装時に [PostHog API docs](https://posthog.com/docs/api/insights) で最新の構文を確認する。上記は 2026-04 時点の推定形式。実行してエラーが出る場合は `kind: 'TrendsQuery'` の構造を dashboard UI からエクスポートするか、Context7 MCP で最新ドキュメントを引く。

- [ ] **Step 2: 型チェック**

Run: `cd scripts/posthog && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add scripts/posthog/insights.ts
git commit -m "feat(scripts): Dashboard に載せる 9 本の Insight 定義を追加

spec §4.2 の表を TypeScript オブジェクト配列として定義。
PostHog query JSON 形式を使い、Trends/Funnel/Retention の
3 種類を混在させる。ジャンル横断率は分子 (#3-a) と分母 (#3-b) の
2 本を別 Insight として定義。"
```

---

## Task 15: `scripts/posthog/sync-dashboard.ts` — エントリポイント

**Files:**
- Create: `scripts/posthog/sync-dashboard.ts`
- Create: `scripts/posthog/sync-dashboard.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`scripts/posthog/sync-dashboard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncDashboard } from './sync-dashboard'
import type { PosthogItem, InsightPayload } from './client'

describe('syncDashboard', () => {
  const getInsightByName = vi.fn()
  const createInsight = vi.fn()
  const updateInsight = vi.fn()
  const getDashboardByName = vi.fn()
  const createDashboard = vi.fn()
  const client = { getInsightByName, createInsight, updateInsight, getDashboardByName, createDashboard }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Dashboard が未作成のときは作成する', async () => {
    getDashboardByName.mockResolvedValue(null)
    createDashboard.mockResolvedValue({ id: 10, name: 'Recolly Main Dashboard' } as PosthogItem)
    getInsightByName.mockResolvedValue(null)
    createInsight.mockResolvedValue({ id: 1, name: 'X' } as PosthogItem)

    const insights: InsightPayload[] = [{ name: 'X', query: {} }]
    await syncDashboard({ client, insights, dashboardName: 'Recolly Main Dashboard', dashboardDescription: 'desc' })

    expect(createDashboard).toHaveBeenCalledWith({ name: 'Recolly Main Dashboard', description: 'desc' })
    expect(createInsight).toHaveBeenCalledWith(expect.objectContaining({ name: 'X', dashboards: [10] }))
  })

  it('Dashboard が既にあるなら再利用する', async () => {
    getDashboardByName.mockResolvedValue({ id: 10, name: 'Recolly Main Dashboard' } as PosthogItem)
    getInsightByName.mockResolvedValue({ id: 7, name: 'X' } as PosthogItem)
    updateInsight.mockResolvedValue({ id: 7, name: 'X' } as PosthogItem)

    const insights: InsightPayload[] = [{ name: 'X', query: {} }]
    await syncDashboard({ client, insights, dashboardName: 'Recolly Main Dashboard', dashboardDescription: 'desc' })

    expect(createDashboard).not.toHaveBeenCalled()
    expect(createInsight).not.toHaveBeenCalled()
    expect(updateInsight).toHaveBeenCalledWith(7, expect.objectContaining({ name: 'X', dashboards: [10] }))
  })
})
```

- [ ] **Step 2: テスト実行で失敗確認**

Run: `cd scripts/posthog && npm test`
Expected: FAIL

- [ ] **Step 3: `sync-dashboard.ts` を実装**

```typescript
import 'dotenv/config'
import { createPosthogClient, type InsightPayload } from './client'
import { INSIGHT_DEFINITIONS, DASHBOARD_NAME, DASHBOARD_DESCRIPTION } from './insights'

type PosthogClient = ReturnType<typeof createPosthogClient>

export async function syncDashboard(params: {
  client: Pick<
    PosthogClient,
    'getInsightByName' | 'createInsight' | 'updateInsight' | 'getDashboardByName' | 'createDashboard'
  >
  insights: InsightPayload[]
  dashboardName: string
  dashboardDescription: string
}): Promise<void> {
  const { client, insights, dashboardName, dashboardDescription } = params

  // 1. Dashboard を取得 or 作成
  let dashboard = await client.getDashboardByName(dashboardName)
  if (!dashboard) {
    dashboard = await client.createDashboard({ name: dashboardName, description: dashboardDescription })
    console.log(`Created dashboard "${dashboardName}" (id: ${dashboard.id})`)
  } else {
    console.log(`Reusing existing dashboard "${dashboardName}" (id: ${dashboard.id})`)
  }

  // 2. 各 Insight をべき等に同期
  for (const insightDef of insights) {
    const payload: InsightPayload = { ...insightDef, dashboards: [dashboard.id] }
    const existing = await client.getInsightByName(insightDef.name)
    if (existing) {
      await client.updateInsight(existing.id, payload)
      console.log(`  Updated insight "${insightDef.name}" (id: ${existing.id})`)
    } else {
      const created = await client.createInsight(payload)
      console.log(`  Created insight "${insightDef.name}" (id: ${created.id})`)
    }
  }
}

// エントリポイント（直接実行時のみ）
if (import.meta.url === `file://${process.argv[1]}`) {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  const projectId = process.env.POSTHOG_PROJECT_ID
  const host = process.env.POSTHOG_HOST

  if (!apiKey || !projectId || !host) {
    console.error('Missing env vars: POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID, POSTHOG_HOST')
    console.error('See scripts/posthog/README.md')
    process.exit(1)
  }

  const client = createPosthogClient({ apiKey, projectId, host })
  syncDashboard({
    client,
    insights: INSIGHT_DEFINITIONS,
    dashboardName: DASHBOARD_NAME,
    dashboardDescription: DASHBOARD_DESCRIPTION,
  }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
```

`scripts/posthog/package.json` の dependencies に `dotenv` を追加:

```json
  "dependencies": {
    "dotenv": "^16.4.0",
    "zod": "^3.23.8"
  }
```

Run: `cd scripts/posthog && npm install`

- [ ] **Step 4: テスト実行で成功確認**

Run: `cd scripts/posthog && npm test`
Expected: PASS（全 2 テスト）

- [ ] **Step 5: コミット**

```bash
git add scripts/posthog/sync-dashboard.ts scripts/posthog/sync-dashboard.test.ts \
        scripts/posthog/package.json scripts/posthog/package-lock.json
git commit -m "feat(scripts): sync-dashboard エントリポイントを実装

Dashboard と 9 本の Insight をべき等に作成・更新する。
環境変数 POSTHOG_PERSONAL_API_KEY / POSTHOG_PROJECT_ID /
POSTHOG_HOST を読み込み、PostHog REST API を叩く。
CI では実行しない (spec §5.4)。"
```

---

## Task 16: プライバシーポリシー更新

**Files:**
- Modify: `frontend/src/pages/PrivacyPage/PrivacyPage.tsx`
- Test: `frontend/src/pages/PrivacyPage/PrivacyPage.test.tsx`（あれば）

- [ ] **Step 1: 現状確認**

Read: `frontend/src/pages/PrivacyPage/PrivacyPage.tsx`

既存の「送信する情報」「送信しない情報」の記述を見つけ、spec §5.2 の内容を追記する形で編集する。

- [ ] **Step 2: 失敗するテストを書く（既存テストがあれば）**

```typescript
  it('Phase 2 の計測内容が記述されている', () => {
    render(<PrivacyPage />)
    expect(screen.getByText(/検索.*メタ情報/)).toBeInTheDocument()
    expect(screen.getByText(/記録したジャンルの種類数/)).toBeInTheDocument()
  })
```

- [ ] **Step 3: PrivacyPage を更新**

既存の該当セクションに以下を追記:

```tsx
<section>
  <h3>計測している内容（2026-04-17 更新）</h3>
  <ul>
    <li>ログイン状態・操作イベント・ページ遷移</li>
    <li>検索・進捗更新・ステータス変更・レコメンドクリックのメタ情報（クエリ本文・理由本文は送信しません）</li>
    <li>記録したジャンルの種類数（個別の作品情報は送信しません）</li>
  </ul>
</section>
```

既存の実装スタイル（CSS モジュール / デザイントークン）に合わせる。

- [ ] **Step 4: テスト & lint 実行で成功確認**

Run: `cd frontend && npx vitest run src/pages/PrivacyPage/`
Run: `cd frontend && npm run lint`

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/PrivacyPage/
git commit -m "docs(privacy): Phase 2 計測内容をプライバシーポリシーに追記

spec §5.2 に従い、検索/進捗/ステータス/レコメンドのメタ情報と
ジャンル種類数を計測している旨を明記。クエリ本文・理由本文は
送信していないことも改めて記述。"
```

---

## Task 17: 運用ドキュメント作成

**Files:**
- Create: `docs/posthog-dashboard.md`

- [ ] **Step 1: ドキュメントを作成**

`docs/posthog-dashboard.md`:

```markdown
# PostHog Dashboard 運用メモ

Recolly の計測基盤で使っている Dashboard「Recolly Main Dashboard」の内容と運用メモ。

**Spec**: `docs/superpowers/specs/2026-04-17-analytics-phase2-dashboard-design.md`
**作成スクリプト**: `scripts/posthog/sync-dashboard.ts`

## Dashboard 構成（9 本の Insight）

| # | Insight 名 | 種別 | 何を見るか |
|---|---|---|---|
| 1 | Active Users (DAU/WAU/MAU) | Trends | 日次・週次・月次のアクティブユーザー推移 |
| 2 | Cumulative Records Created | Trends | 累計記録件数の推移 |
| 3-a | Cross-genre Users (Numerator) | Trends | ジャンル横断ユーザー（2 種以上記録）の数 |
| 3-b | All Identified Users (Denominator) | Trends | identify 済み全ユーザー数 |
| 4 | Funnel: Signup to First Record | Funnel | 登録 → 初回記録のアクティベーション率 |
| 5 | Funnel: Search to Record Created | Funnel | 検索 → 記録作成のコンバージョン率（30分以内） |
| 6 | Retention (Day 1/7/30) | Retention | 継続率 |
| 7 | Status Transition Distribution | Trends (breakdown) | ステータス遷移の分布（途中挫折・完了パターン） |
| 8 | Records by Media Type | Trends (breakdown) | メディア種別ごとの記録件数 |

## ジャンル横断率の見方

Insight #3-a と #3-b を割り算する。例:
- #3-a = 50、#3-b = 200 → ジャンル横断率 = 25%

目標値: 30% 以上を維持したい（Recolly の差別化の動かぬ証拠）。

## 更新方法

Insight の定義を変えたい場合:
1. `scripts/posthog/insights.ts` を編集
2. `cd scripts/posthog && npm run sync` を実行
3. PostHog UI で反映を確認

Dashboard の name を変える場合は、旧 Dashboard を UI から削除してからスクリプトを実行する（べき等性は name ベースのため）。

## 注意

- Personal API Key は `.env.local` のみ。Git や CI には入れない（spec §5.4）
- Dashboard / Insight を UI から手動編集した場合、次回 `sync` で上書きされる可能性あり。手動編集は避ける
```

- [ ] **Step 2: コミット**

```bash
git add docs/posthog-dashboard.md
git commit -m "docs: PostHog Dashboard の運用メモを追加

Dashboard 構成と各 Insight の意味、ジャンル横断率の見方、
更新方法を記録。spec §3.4 の要件を満たす。"
```

---

## Task 18: TODO.md 更新

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: 該当項目をチェック済みに更新**

`docs/TODO.md` の以下を `- [ ]` → `- [x]` に変更:

```markdown
- [x] PostHog Dashboard / Insight の作成（特に「ジャンル横断率」カスタム指標） — Phase 1 実装後タスク
- [x] Phase 2 イベント追加（`search_performed` / `episode_progress_updated` / `record_status_changed` / `recommendation_clicked`） — 別仕様書で扱う
```

- [ ] **Step 2: コミット**

```bash
git add docs/TODO.md
git commit -m "docs(todo): 計測基盤の完成に伴い 2 項目を完了済みに更新

- PostHog Dashboard / Insight の作成
- Phase 2 イベント追加

Issue #157 / spec 2026-04-17-analytics-phase2-dashboard-design.md で
消化した。"
```

---

## Task 19: 全テスト実行で回帰なし確認

**Files:** 変更なし

- [ ] **Step 1: フロントエンドの全テスト**

Run: `cd frontend && npx vitest run`
Expected: 全テストパス

- [ ] **Step 2: バックエンドの全テスト**

Run: `cd backend && bundle exec rspec`
Expected: 全テストパス

- [ ] **Step 3: scripts/posthog のテスト**

Run: `cd scripts/posthog && npm test`
Expected: 全テストパス

- [ ] **Step 4: lint / 型チェック**

Run: `cd frontend && npm run lint && npm run typecheck`
Run: `cd backend && bundle exec rubocop`
Expected: エラーなし

- [ ] **Step 5: 問題があれば修正、なければ次へ進む（コミット不要）**

---

## Task 20: 手動検証

**Files:** 変更なし

- [ ] **Step 1: フロントの開発サーバーを起動**

Run: `cd frontend && npm run dev`

- [ ] **Step 2: PostHog の Live events ページを別タブで開く**

URL: `https://us.posthog.com/project/{POSTHOG_PROJECT_ID}/events`

- [ ] **Step 3: 各イベントを手動で発火してプロパティを確認**

以下の操作を行い、Live events ページに正しいプロパティ付きで届くことを確認:

1. **検索**: /search でキーワードと任意のジャンルで検索 → `search_performed`（`query_length` / `genre_filter` / `result_count`）
2. **HomePage の +1 話**: アニメの watching 記録で +1 → `episode_progress_updated`（`media_type: 'anime'` / `increment_type: 'episode'` / `new_value` が期待値）
3. **HomePage の自動 completed**: 最終話の +1 で → `episode_progress_updated` + `record_status_changed`（両方）
4. **HomePage の完了ボタン**: book の watching で完了 → `record_status_changed`（anime 以外の完了パス）
5. **WorkDetailPage のステータス変更**: status を変える → `record_status_changed`
6. **WorkDetailPage の進捗スライダー**: 話数を変える → デバウンス後に `episode_progress_updated`
7. **RecommendationsPage のカードクリック**: カードをクリック → `recommendation_clicked`（`position` と `has_reason`）
8. **記録作成**: 検索結果から記録 → `record_created` + User Property `distinct_media_types_count` が更新されていることを PostHog の People ページで確認

- [ ] **Step 4: Dashboard 作成スクリプト実行**

`scripts/posthog/.env.local` を `.env.example` をベースに設定した後:

Run: `cd scripts/posthog && npm run sync`

Expected:
- `Created dashboard "Recolly Main Dashboard" (id: N)` のログ
- 9 本の `Created insight "..."` のログ

- [ ] **Step 5: PostHog UI で Dashboard を確認**

URL: `https://us.posthog.com/project/{POSTHOG_PROJECT_ID}/dashboard`

確認項目:
- [ ] 「Recolly Main Dashboard」が存在する
- [ ] 9 本の Insight が全て表示される
- [ ] 各 Insight にデータが表示されている（Step 3 で発火したイベントが反映）
- [ ] `Cross-genre Users` と `All Identified Users` が並んで表示される

- [ ] **Step 6: べき等性の確認**

Run: `cd scripts/posthog && npm run sync`（もう一度実行）

Expected:
- `Reusing existing dashboard "Recolly Main Dashboard" (id: N)` のログ
- 9 本の `Updated insight "..."` のログ
- PostHog UI で Insight が重複作成されていないことを確認

- [ ] **Step 7: 結果を記録**

手動検証の結果（全項目クリアか、何か問題があったか）を PR の本文に記載する。

---

## Task 21: PR 作成と finishing

**Files:** なし

- [ ] **Step 1: `superpowers:finishing-a-development-branch` スキルを発動**

- [ ] **Step 2: スキルの指示に従って PR 作成、レビュー、マージを進める**

`recolly-git-rules` スキルのルールに従うこと（PR 本文に仕様書・Issue へのリンクを含める等）。

---

## Self-Review Checklist

プラン完成後に自身で確認:

**1. Spec coverage:** spec §2（4 イベント）・§3（モジュール構成・API・スクリプト）・§4（Dashboard/Insight）・§5（プライバシー・env）・§6（テスト戦略）は全てタスクにマッピング済み ✓

**2. Placeholder scan:** "TBD" / "TODO" / "fill in details" の残存なし ✓

**3. Type consistency:** `InsightPayload` / `PosthogClient` / `PosthogItem` などの型名は Task 13 → Task 14 → Task 15 で一貫している ✓

**4. TDD Discipline:** 各タスクに「test 先に書く」「失敗確認」「実装」「成功確認」「commit」の 5 ステップが含まれている ✓
