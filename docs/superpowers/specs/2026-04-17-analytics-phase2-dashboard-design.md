# Analytics Phase 2 + PostHog Dashboard — 設計仕様書

**作成日**: 2026-04-17
**前提仕様書**: `docs/superpowers/specs/2026-04-13-analytics-tracking-design.md`（Phase 1）
**背景文書**: `docs/product-marketing-context.md`
**関連 TODO**: `docs/TODO.md` フェーズ5 の「PostHog Dashboard / Insight の作成」「Phase 2 イベント追加」

---

## 1. 概要

### 1.1 目的

Recolly の計測基盤を「Phase 1 実装済み」状態から「計測基盤の完成」状態に引き上げる。具体的には以下の 2 つを同時達成する：

1. **Phase 2 の 4 イベントを追加**して、Phase 1 では測れなかった「検索 → 記録」ファネル・「進捗更新の頻度」・「ステータス遷移パターン」・「レコメンドクリック率」を計測可能にする。
2. **PostHog Dashboard と Insight を自動作成するスクリプト**を追加し、Phase 1〜2 のイベントから意味のある指標を可視化する。

### 1.2 目指す状態

PR マージ後、IK が以下の手順を踏むだけで、計測基盤が完全に稼働する：

1. `scripts/posthog/.env.local` に PostHog Personal API Key、Project ID、Host を設定する。
2. `cd scripts/posthog && npx tsx sync-dashboard.ts` を実行する。
3. PostHog UI で「Recolly Main Dashboard」が作成されており、本仕様で定義した 9 本の Insight（表 §4.2 参照、#3-a と #3-b を含む） が表示されていることを確認する。

### 1.3 スコープ外

- Backend (Rails) 側での PostHog イベント発火（Phase 1 と同じく frontend のみ）。ただし、User Property の算出に必要な情報を返す小さな API は本仕様のスコープ内に含む。
- Phase 3 以降のイベント（`discussion_created`, `comment_posted`, `work_detail_viewed` 等）。
- PostHog の機能フラグ / セッション録画 / A/B テスト。
- EU GDPR 対応の Cookie consent banner。

---

## 2. Phase 2 イベント定義

### 2.1 `search_performed`

| 項目 | 値 |
|---|---|
| 発火場所 | `frontend/src/pages/SearchPage/SearchPage.tsx` — 検索 API のレスポンス成功時 |
| 発火タイミング | `setResults()` が完了した直後（結果が UI に反映されたタイミング） |
| プロパティ | `query_length: number`（クエリ文字列の長さ） / `genre_filter: 'all' \| 'anime' \| 'movie' \| 'drama' \| 'book' \| 'manga' \| 'game'` / `result_count: number` |
| 目的 | 検索使用頻度・ジャンル選好・「検索結果ゼロ」問題の検出 |
| 注意 | **クエリ本文は送信しない**（プライバシー方針）。長さと絞り込みジャンル、ヒット件数のみ。 |

### 2.2 `episode_progress_updated`

| 項目 | 値 |
|---|---|
| 発火場所 | HomePage のジャンル別クイックアクション（+1 話 / +1 巻 / 観た / 読了 / クリア）、および WorkDetailPage の進捗編集 |
| 発火タイミング | 進捗更新の PATCH API 成功レスポンス後 |
| プロパティ | `media_type: MediaType` / `increment_type: 'episode' \| 'volume' \| 'watched' \| 'read' \| 'cleared'` / `new_value: number`（更新後の値） |
| 目的 | 日々の記録習慣の定着度、ジャンル別のクイックアクション使用頻度 |
| `record_status_changed` との関係 | HomePage の「観た / 読了 / クリア」クイックアクションは、ステータス遷移も伴う。その場合は **本イベントと `record_status_changed` の両方を発火する**（重複ではなく、視点の異なる2軸の計測）。「+1 話」「+1 巻」はステータス遷移を伴わないので本イベントのみ発火。 |

### 2.3 `record_status_changed`

| 項目 | 値 |
|---|---|
| 発火場所 | 記録ステータスを変更する UI（WorkDetailPage、LibraryPage、HomePage から開く記録詳細モーダル） |
| 発火タイミング | ステータス変更 PATCH API 成功レスポンス後 |
| プロパティ | `media_type: MediaType` / `from_status: string` / `to_status: string` |
| 目的 | 「観たい → 観てる → 観た」の遷移率、途中挫折率（watching → dropped）の検出 |
| 注意 | `from_status` / `to_status` の値は `MediaType` ごとに既存の型定義に従う（anime なら `watching` / `watched`、book なら `reading` / `read` など）。spec では文字列として扱い、Insight 側で集計時に識別する。 |

### 2.4 `recommendation_clicked`

| 項目 | 値 |
|---|---|
| 発火場所 | `frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx` — おすすめ作品カードクリック時 |
| 発火タイミング | カードクリック時、画面遷移前（遷移で発火が失われないように） |
| プロパティ | `media_type: MediaType` / `position: number`（リスト内の位置、1 始まり） / `has_reason: boolean`（おすすめ理由が表示されていたか） |
| 目的 | レコメンド機能のクリック率、位置バイアス、「理由あり」の有無で CTR 差があるか |
| 注意 | **おすすめ理由の本文は送信しない**（PII 方針に準拠）。存在有無のみ。 |

### 2.5 共通プロパティ（PostHog 側で自動付与）

- `distinct_id`（identify 済みユーザーなら user_id、匿名なら PostHog 生成の anonymous ID）
- `$current_url`
- `$browser`, `$os`, `$device_type`
- `$time`

### 2.6 User Property の追加

`record_created` 発火後に以下の User Property を更新する（**本仕様で新規追加**）：

| プロパティ名 | 値 | 更新タイミング |
|---|---|---|
| `distinct_media_types_count` | 当該ユーザーが過去に記録した distinct な media_type の個数（1〜6） | `record_created` 成功後、後述のバックエンド API から最新値を取得して PostHog `$set` で更新 |

---

## 3. モジュール構成

### 3.1 フロントエンドの変更

```
frontend/src/lib/analytics/
├── posthog.ts           ← 既存ラッパーを流用（変更は最小）
├── events.ts            ← Phase 2 イベントの型定義を追加
└── posthog.test.ts      ← Phase 2 プロパティのテストを追加
```

#### `events.ts` の追加内容（イメージ）

```typescript
export const ANALYTICS_EVENTS = {
  PAGEVIEW: '$pageview',
  SIGNUP_COMPLETED: 'signup_completed',
  RECORD_CREATED: 'record_created',
  // 以下、Phase 2 で追加
  SEARCH_PERFORMED: 'search_performed',
  EPISODE_PROGRESS_UPDATED: 'episode_progress_updated',
  RECORD_STATUS_CHANGED: 'record_status_changed',
  RECOMMENDATION_CLICKED: 'recommendation_clicked',
} as const

export type SearchPerformedProps = {
  query_length: number
  genre_filter: 'all' | 'anime' | 'movie' | 'drama' | 'book' | 'manga' | 'game'
  result_count: number
}

export type EpisodeProgressUpdatedProps = {
  media_type: MediaType
  increment_type: 'episode' | 'volume' | 'watched' | 'read' | 'cleared'
  new_value: number
}

export type RecordStatusChangedProps = {
  media_type: MediaType
  from_status: string
  to_status: string
}

export type RecommendationClickedProps = {
  media_type: MediaType
  position: number
  has_reason: boolean
}
```

#### `posthog.ts` に追加する関数

User Property 更新用の薄いラッパーを追加する：

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

### 3.2 バックエンドの変更（新規 API）

`GET /api/v1/users/me/media_types`

| 項目 | 値 |
|---|---|
| 認証 | 必須（未認証は 401） |
| レスポンス形式 | `{ "media_types": ["anime", "book", "movie"] }`（distinct な media_type の配列） |
| ロジック | `current_user.records` から `.distinct.pluck(:media_type)` |
| 空の場合 | `{ "media_types": [] }` を返す |

**この API を追加する理由**: `distinct_media_types_count` User Property をフロント側で算出するには、localStorage 方式だと別デバイスで値が壊れる。真実のソースはバックエンド DB なので、そこから取得する。

配置:
- コントローラー: `backend/app/controllers/api/v1/users/me/media_types_controller.rb`
- ルーティング: `backend/config/routes.rb` に追加
- リクエストスペック: `backend/spec/requests/api/v1/users/me/media_types_spec.rb`

### 3.3 スクリプト（新規）

```
scripts/posthog/
├── sync-dashboard.ts    ← エントリポイント
├── insights.ts          ← Insight 定義（本仕様の §4 を TypeScript で表現）
├── client.ts            ← PostHog REST API クライアント（fetch ラッパー）
├── README.md            ← 実行手順書（Personal API Key の取得方法・実行コマンド）
├── package.json         ← tsx と zod のみ
├── tsconfig.json        ← node 用
├── .env.example         ← プレースホルダー
└── .gitignore           ← .env.local を除外（ルートの .gitignore でも重複対応）
```

#### 責務

- `client.ts`:
  - `getInsightByName(name)` / `createInsight(payload)` / `updateInsight(id, payload)`
  - `getDashboardByName(name)` / `createDashboard(payload)` / `addInsightToDashboard(dashboardId, insightId)`
  - 全て Personal API Key を Authorization ヘッダーに付けて fetch。
- `insights.ts`:
  - Insight 9 本の定義を TypeScript オブジェクトの配列として export。
  - 各定義は `{ name, description, query, dashboardName }` の形式。
- `sync-dashboard.ts`:
  - Dashboard を name で検索 → なければ作成 → ID を取得。
  - 各 Insight を name で検索 → なければ作成、あれば query のみ更新。
  - 作成した Insight を Dashboard に紐付ける（既に紐付け済みならスキップ）。

#### べき等性の担保

- 既存 Insight / Dashboard は `name` で完全一致検索して再利用する。
- 重複作成は絶対に発生しない。

### 3.4 ドキュメント

```
docs/posthog-dashboard.md  ← 新規: Dashboard と各 Insight が何を測るかの運用メモ
```

`/privacy` ページのプライバシーポリシーにも Phase 2 の計測内容を追記する（§5.2 参照）。

---

## 4. PostHog Dashboard / Insight 定義

### 4.1 Dashboard

- **名前**: `Recolly Main Dashboard`
- **説明**: `Recolly の主要 KPI を一覧する。spec: 2026-04-17-analytics-phase2-dashboard-design.md`

### 4.2 Insight 一覧

| # | Insight 名 | Insight Type | イベント / 式 | 目的 |
|---|---|---|---|---|
| 1 | `Active Users (DAU/WAU/MAU)` | Trends | `$pageview` を `dau` / `wau` / `mau` で集計（3 本線） | 利用アクティビティ |
| 2 | `Cumulative Records Created` | Trends | `record_created` の total count（cumulative） | 累計記録件数 |
| 3-a | `Cross-genre Users (Numerator)` | Trends (user property filter) | User Property `distinct_media_types_count >= 2` の unique user 数 | ジャンル横断率の分子 |
| 3-b | `All Identified Users (Denominator)` | Trends | identify 済み全 unique user 数 | ジャンル横断率の分母 |
| 4 | `Funnel: Signup to First Record` | Funnel | `signup_completed` → `record_created`（14日間ウィンドウ） | アクティベーション率 |
| 5 | `Funnel: Search to Record Created` | Funnel | `search_performed` → `record_created`（30分以内） | 検索機能の有効性 |
| 6 | `Retention (Day 1/7/30)` | Retention | Performed event: `$pageview` / Returning event: `$pageview` | 継続率 |
| 7 | `Status Transition Distribution` | Trends (breakdown) | `record_status_changed` を `from_status` と `to_status` のペアでブレイクダウン | 途中挫折・完了パターン |
| 8 | `Records by Media Type` | Trends (breakdown) | `record_created` を `media_type` でブレイクダウン | ジャンル別比率 |

### 4.3 ジャンル横断率（Insight #3-a / #3-b）の実装方針

**採用方式**: **案 B-1（User Property + バックエンド API）**

Insight は 2 本に分割して Dashboard 上に並置する（分子: `#3-a`、分母: `#3-b`）。PostHog の Trends には「比率」用の Insight Type が無いため、目視で両者を並べて割合を把握する方式。将来 HogQL で 1 本化したくなった場合は別タスクで対応する。

不採用にした案:
- **案 A（HogQL 直接計算）**: クエリエディタが重く、運用時に修正コストが高い。個人開発には不向き。
- **案 B-2（localStorage で算出）**: 別デバイスログインで値が壊れる。真実のソースがバックエンド DB なので、そこから取る。

**実装フロー**:

1. ユーザーが記録を作成（`POST /api/v1/records`）→ 成功レスポンス受信。
2. フロント側で `captureEvent(RECORD_CREATED, { media_type })` を発火（既存）。
3. 続けて `GET /api/v1/users/me/media_types` を呼び出して最新の distinct media_types を取得。
4. `setUserProperty({ distinct_media_types_count: response.media_types.length })` で PostHog の User Property を更新。

**注意**: 失敗時はサイレントにログ出力のみ（Phase 1 の既存方針と同じ）。記録作成自体の成功体験を阻害しない。

---

## 5. プライバシー・セキュリティ

### 5.1 送信する情報・しない情報

**送信する**（PII ではない）:
- `distinct_id`（内部 user ID、外部に露出しない）
- 各イベントのプロパティ: `query_length`, `genre_filter`, `result_count`, `media_type`, `increment_type`, `new_value`, `from_status`, `to_status`, `position`, `has_reason`
- User Property:
  - `signup_method`, `signup_date`（Phase 1 で導入済み、本仕様では変更なし）
  - `distinct_media_types_count`（**本仕様で新規追加**）

**送信しない**（PII）:
- 検索クエリ本文
- おすすめ理由の本文
- 作品の感想本文（`EpisodeReview.body`）
- 掲示板コメント本文
- プロフィール bio
- メールアドレス、パスワード

### 5.2 プライバシーポリシーページの更新

`/privacy` ページに Phase 2 の追加計測を明記する：

> PostHog に送信する内容（Phase 2 追加版）:
> - ログイン状態・操作イベント・ページ遷移（Phase 1 から継続）
> - 検索・進捗更新・ステータス変更・レコメンドクリックの**メタ情報のみ**（クエリ本文・理由本文は送信しません）
> - 記録したジャンルの**種類数**（個別の作品情報は送信しません）

### 5.3 環境変数

| 変数名 | 値の例 | 保存先 | 用途 |
|---|---|---|---|
| `POSTHOG_PERSONAL_API_KEY` | `phx_xxx` | `scripts/posthog/.env.local`（**ローカルのみ**） | Dashboard/Insight 作成 |
| `POSTHOG_PROJECT_ID` | `123456` | 同上 | 対象プロジェクト ID |
| `POSTHOG_HOST` | `https://us.i.posthog.com` | 同上 | API ホスト |

- `.env.local` は `.gitignore` で除外（`scripts/posthog/.gitignore` とルートの `.gitignore` 両方に追加）。
- `.env.example` はコミット対象。プレースホルダーのみ記載。
- **既存の `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST`（フロント用 Project API Key）は変更なし**。

### 5.4 Personal API Key の運用方針

- **CI / GitHub Secrets には入れない**。理由:
  - CI で自動実行されると PR マージの度に Dashboard が更新され、意図しない副作用が出る。
  - Personal API Key は強力な権限（プロジェクト全体を操作可能）を持つため、漏洩リスクを最小化したい。
- **IK がローカルから手動で実行する**運用に限定する。Dashboard の更新頻度は月 1 回未満の想定なので、手動で十分。

---

## 6. テスト戦略

### 6.1 ユニットテスト（Vitest）

| 対象ファイル | テスト内容 |
|---|---|
| `frontend/src/lib/analytics/events.ts` | 新規イベント名定数の存在、型定義の整合性（型レベル検証） |
| `frontend/src/lib/analytics/posthog.test.ts` | `captureEvent` が Phase 2 の各イベントで `posthog.capture` を正しい引数で呼ぶ。`setUserProperty` が `posthog.people.set` を正しく呼ぶ。 |
| `scripts/posthog/client.test.ts` | PostHog API クライアントが正しい URL・ヘッダー・ボディで `fetch` を呼ぶ（`fetch` をモック） |
| `scripts/posthog/sync-dashboard.test.ts` | 既存 Insight が無ければ POST、あれば PATCH（べき等性） |

### 6.2 コンポーネントテスト（Vitest + React Testing Library）

| 対象 | テスト内容 |
|---|---|
| `SearchPage.test.tsx` | 検索実行 → `search_performed` が正しいプロパティで発火 |
| HomePage のクイックアクション test | +1 ボタンクリック → `episode_progress_updated` が発火 |
| ステータス変更モーダル test | ステータス変更 → `record_status_changed` が from/to 両方付きで発火 |
| `RecommendationsPage.test.tsx` | カードクリック → `recommendation_clicked` が発火し、画面遷移が行われる |
| 記録作成コンポーネント test | `record_created` 発火後、`users/me/media_types` API が呼ばれ、`setUserProperty` が呼ばれる |

### 6.3 リクエストスペック（RSpec）

| 対象 | テスト内容 |
|---|---|
| `spec/requests/api/v1/users/me/media_types_spec.rb` | 認証済みユーザー: 自分の distinct media_types を返す（200） / 未認証: 401 / 記録ゼロ: `[]` を返す |

### 6.4 手動検証

1. ローカル環境で各イベントを手動で発火（検索・+1・ステータス変更・おすすめクリック）。
2. PostHog Live events ページで正しいプロパティで届いているか確認。
3. `cd scripts/posthog && npx tsx sync-dashboard.ts` を実行。
4. PostHog UI で「Recolly Main Dashboard」が作成され、9 本の Insight（表 §4.2 参照、#3-a と #3-b を含む） が正しく表示されているか確認。
5. スクリプトを 2 回目実行して重複作成されないこと（べき等性）を確認。

---

## 7. 実装順序（TDD 準拠）

1. **Step 1**: `events.ts` に Phase 2 の型定義を追加（型定義のみ、failing test を先に）。
2. **Step 2**: `search_performed` の発火コード追加（SearchPage の test first）。
3. **Step 3**: バックエンドに `GET /api/v1/users/me/media_types` を追加（request spec first）。
4. **Step 4**: `record_created` 発火後に User Property 更新（コンポーネント test first）。
5. **Step 5**: `episode_progress_updated` / `record_status_changed` / `recommendation_clicked` の順で発火コード追加（各 test first）。
6. **Step 6**: `scripts/posthog/` を新規作成（client → insights → sync-dashboard の順、各 test first）。
7. **Step 7**: 手動検証 → Dashboard を目視確認。
8. **Step 8**: `docs/posthog-dashboard.md` に運用メモを書き起こす。
9. **Step 9**: `/privacy` ページのプライバシーポリシーを更新。

---

## 8. 非機能要件

### 8.1 パフォーマンス

- イベント発火は非同期で、UI をブロックしない（Phase 1 の既存方針を継承）。
- `GET /api/v1/users/me/media_types` は頻度が低い（記録作成時のみ）ため、キャッシュは不要。

### 8.2 失敗時の振る舞い

- PostHog のイベント送信失敗・User Property 更新失敗は `console.warn` で握りつぶす（Phase 1 と同じ）。
- `users/me/media_types` API の失敗時も、記録作成自体の成功体験を阻害しない。User Property の更新を諦めるだけ。
- `sync-dashboard.ts` は API エラー時に例外を投げて即座に終了する（CI ではないため、失敗はその場で IK が気づく）。

### 8.3 ロールバック戦略

- **フロント/バックエンド**: PR revert で即復旧可能。
- **PostHog Dashboard**: PostHog UI から手動で Dashboard を削除すれば元に戻る。データ（イベント）自体は消えない。

---

## 9. Out of Scope（本仕様では扱わない）

- Phase 3 イベント（`discussion_created`, `comment_posted`, `work_detail_viewed` 等）
- Backend 側での PostHog イベント発火
- 機能フラグ / セッション録画 / A/B テスト
- CI での Dashboard 自動更新（Personal API Key を Secrets に入れない方針のため）
- EU GDPR 対応の Cookie consent banner
- 既存ユーザーデータの PostHog への遡及反映（現時点でのユーザーの distinct_media_types は、次回の `record_created` 発火時に自動で更新される）

---

## 10. 関連文書

- 前提: `docs/superpowers/specs/2026-04-13-analytics-tracking-design.md`（Phase 1）
- 背景: `docs/product-marketing-context.md` セクション 11, 12
- TODO: `docs/TODO.md` フェーズ5「マーケティング & マネタイズ」
- ADR: `docs/adr/0041-プロダクト分析ツールにposthogを採用.md`
- 実装後に追加予定: `docs/adr/00XX-posthog-dashboard-をスクリプトで管理.md`（IaC 方針の ADR）
