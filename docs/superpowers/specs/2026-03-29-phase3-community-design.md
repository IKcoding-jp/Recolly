# フェーズ3: コミュニティ機能 — 設計仕様書

## 1. 概要

Recollyにコミュニティ機能を追加する。作品ごとのディスカッション掲示板とユーザープロフィール公開ページの2つの柱で構成される。

### 1.1 スコープ

- 作品ごとのディスカッション掲示板（Discussions）
- 話数ごとのスレッド
- コメント機能（Comments）
- ユーザープロフィール（/users/:id — 公開ページ）

### 1.2 スコープ外

- フォロー/フォロワー機能
- 通知機能
- メンション（@ユーザー名）
- コメントのネスト（返信ツリー）
- ディスカッションのキーワード検索
- ディスカッション履歴のプロフィール表示

---

## 2. 権限モデル

| 操作 | 権限 |
|------|------|
| ディスカッション閲覧 | 全ユーザー（未ログインでもOK） |
| コメント閲覧 | 全ユーザー（未ログインでもOK） |
| ディスカッション作成 | ログイン済み + その作品のrecordを持つユーザーのみ |
| コメント投稿 | ログイン済み + その作品のrecordを持つユーザーのみ |
| ディスカッション編集・削除 | 投稿者本人のみ |
| コメント編集・削除 | 投稿者本人のみ |
| プロフィール閲覧 | 全ユーザー（未ログインでもOK） |
| 公開ライブラリ閲覧 | 全ユーザー（未ログインでもOK） |

「記録済みユーザーのみ投稿可能」というルールにより、実際にその作品を体験しているユーザー同士の議論を保証する。

---

## 3. データモデル

### 3.1 新規テーブル

#### discussions（ディスカッションスレッド）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | bigint (PK) | |
| work_id | FK → works | 対象作品 |
| user_id | FK → users | スレッド作成者 |
| episode_number | integer (null可) | 話数指定（nullなら作品全体） |
| title | string | スレッドタイトル（必須、最大100文字） |
| body | text | 本文（必須、最大5000文字） |
| has_spoiler | boolean (default: false) | ネタバレフラグ |
| comments_count | integer (default: 0) | コメント数のカウンターキャッシュ |
| created_at | datetime | |
| updated_at | datetime | |

**インデックス**: `[work_id, created_at]`, `[user_id]`

#### comments（コメント）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | bigint (PK) | |
| discussion_id | FK → discussions | 所属スレッド |
| user_id | FK → users | コメント投稿者 |
| body | text | コメント本文（必須、最大3000文字） |
| created_at | datetime | |
| updated_at | datetime | |

**インデックス**: `[discussion_id, created_at]`, `[user_id]`

### 3.2 リレーション

```
Work → 複数の Discussion（1対多）
User → 複数の Discussion（1対多）
Discussion → 複数の Comment（1対多）
User → 複数の Comment（1対多）
```

### 3.3 バリデーション

**Discussion:**
- title: 必須、最大100文字
- body: 必須、最大5000文字
- episode_number: null可。指定時はwork.total_episodes以下（total_episodesがnullの場合は正の整数であればOK）
- 作成権限: current_userがwork_idに対応するrecordを持つこと

**Comment:**
- body: 必須、最大3000文字
- 作成権限: current_userがdiscussionの属するworkのrecordを持つこと

### 3.4 カウンターキャッシュ

`discussions.comments_count` はRailsの `counter_cache` 機能で自動管理する。コメントの作成・削除時にdiscussionsテーブルのcomments_countが自動的に増減するため、一覧表示時にCOUNTクエリが不要になる。

---

## 4. API設計

### 4.1 Discussions API

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/api/v1/works/:work_id/discussions` | 作品のスレッド一覧 | 不要 |
| GET | `/api/v1/discussions` | 全作品横断のスレッド一覧（コミュニティページ用） | 不要 |
| GET | `/api/v1/discussions/:id` | スレッド詳細 | 不要 |
| POST | `/api/v1/works/:work_id/discussions` | スレッド作成 | 必要（記録済みユーザーのみ） |
| PATCH | `/api/v1/discussions/:id` | スレッド編集 | 必要（投稿者のみ） |
| DELETE | `/api/v1/discussions/:id` | スレッド削除 | 必要（投稿者のみ） |

**クエリパラメータ（一覧取得時）:**
- `work_id`: 作品でフィルタ（作品詳細ページからの「すべて見る」遷移用。`/api/v1/discussions` のみ）
- `episode_number`: 話数でフィルタ（指定なしで全スレッド）
- `media_type`: ジャンルフィルタ（コミュニティページ用）
- `sort`: `newest`（新着順、デフォルト）/ `most_comments`（コメント多い順）
- `page`: ページ番号（20件/ページ）

**レスポンス例（一覧）:**
```json
{
  "discussions": [
    {
      "id": 1,
      "title": "最終話の展開について語りたい",
      "body": "第12話見終わりました...",
      "episode_number": 12,
      "has_spoiler": true,
      "comments_count": 15,
      "created_at": "2026-03-29T10:00:00Z",
      "updated_at": "2026-03-29T10:00:00Z",
      "user": { "id": 1, "username": "user123", "avatar_url": null },
      "work": { "id": 10, "title": "進撃の巨人", "media_type": "anime", "cover_image_url": "https://..." }
    }
  ],
  "meta": { "current_page": 1, "total_pages": 3, "total_count": 42 }
}
```

**POSTリクエストボディ:**
```json
{
  "discussion": {
    "title": "最終話の展開について語りたい",
    "body": "第12話見終わりました...",
    "episode_number": 12,
    "has_spoiler": true
  }
}
```

**POST成功時:** `201 Created`

### 4.2 Comments API

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/api/v1/discussions/:discussion_id/comments` | コメント一覧 | 不要 |
| POST | `/api/v1/discussions/:discussion_id/comments` | コメント投稿 | 必要（記録済みユーザーのみ） |
| PATCH | `/api/v1/comments/:id` | コメント編集 | 必要（投稿者のみ） |
| DELETE | `/api/v1/comments/:id` | コメント削除 | 必要（投稿者のみ） |

**クエリパラメータ（一覧取得時）:**
- `page`: ページ番号（20件/ページ）
- ソートは `created_at ASC`（古い順）固定

**レスポンス例（一覧）:**
```json
{
  "comments": [
    {
      "id": 1,
      "body": "わかります！エレンの決断は...",
      "created_at": "2026-03-29T11:00:00Z",
      "updated_at": "2026-03-29T11:30:00Z",
      "edited": true,
      "user": { "id": 2, "username": "anime_fan88", "avatar_url": null }
    }
  ],
  "meta": { "current_page": 1, "total_pages": 1, "total_count": 15 }
}
```

**`edited` フラグ:** `created_at` と `updated_at` が異なる場合に `true` を返す。フロントで「（編集済み）」表示に使用する。

**POSTリクエストボディ:**
```json
{
  "comment": { "body": "コメント本文" }
}
```

**POST成功時:** `201 Created`

### 4.3 Users API（プロフィール用）

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/api/v1/users/:id` | ユーザー公開プロフィール（基本情報 + 統計） | 不要 |
| GET | `/api/v1/users/:id/records` | ユーザーの公開記録一覧 | 不要 |

**`/api/v1/users/:id` レスポンス例:**
```json
{
  "user": {
    "id": 1,
    "username": "anime_fan88",
    "bio": "アニメと映画が好きです",
    "avatar_url": "https://...",
    "created_at": "2026-03-20T00:00:00Z"
  },
  "statistics": {
    "total_records": 42,
    "completed_count": 30,
    "watching_count": 8,
    "average_rating": 7.8,
    "by_genre": { "anime": 20, "movie": 15, "book": 7 },
    "by_status": { "completed": 30, "watching": 8, "on_hold": 2, "dropped": 1, "plan_to_watch": 1 }
  }
}
```

**`/api/v1/users/:id/records` のクエリパラメータ:**
- 既存の Records API と同じフィルタ・ソートを流用
- `visibility: public` の記録のみ返す（サーバー側で強制フィルタ）
- `media_type`: ジャンルフィルタ
- `sort`: `updated_at`（デフォルト）/ `rating` / `title`
- `page`: ページ番号（20件/ページ）

### 4.4 認可チェック

- **作成（Discussion/Comment）**: `current_user` がその作品の `record` を持っているかチェック。なければ `403 Forbidden`
- **編集・削除**: `current_user` が投稿者本人かチェック。違えば `403 Forbidden`
- **未認証**: 認証が必要なエンドポイントで未ログインの場合は `401 Unauthorized`

---

## 5. ページ構成

### 5.1 新規ページ

| ページ | パス | 説明 |
|--------|------|------|
| コミュニティ | `/community` | 全作品横断のディスカッション一覧 |
| ディスカッション詳細 | `/discussions/:id` | スレッド本文 + コメント一覧 + コメント投稿 |
| ユーザープロフィール | `/users/:id` | 基本情報 + 統計 + 公開ライブラリ |

### 5.2 既存ページへの変更

| ページ | 変更内容 |
|--------|---------|
| 作品詳細（`/works/:id`） | 下部に「DISCUSSIONS」セクション追加（最新3件 + 全件リンク） |
| グローバルナビバー | 「コミュニティ」タブ追加 |
| モバイル用BottomTabBar | 「コミュニティ」タブ追加（5タブ化） |

### 5.3 ナビゲーション

**PC（グローバルナビバー）:**
ダッシュボード | 検索 | ライブラリ | コミュニティ | マイページ

**モバイル（BottomTabBar）:**
ホーム | 検索 | ライブラリ | コミュニティ | マイページ（5タブ）

---

## 6. UI設計

### 6.1 コミュニティページ（`/community`）

**ヘッダー:** 「COMMUNITY」タイトル

**フィルタ:**
- ジャンルフィルタ: チップUI（すべて / アニメ / 映画 / ドラマ / 本 / 漫画 / ゲーム）。ライブラリページの `MediaTypeFilter` を再利用
- ソート: ドロップダウン（新着順 / コメント多い順）。`SortSelector` を再利用

**スレッドカード:**
- 作品サムネイル（48×64px）
- バッジ: ジャンル、話数（指定時）、ネタバレ警告（赤背景）
- タイトル（太字）
- メタ情報: 作品名 · 投稿者 · 投稿時間（相対表記） · コメント数
- カードクリック → ディスカッション詳細ページへ遷移

**ページネーション:** 20件/ページ。既存の `Pagination` コンポーネントを再利用

### 6.2 ディスカッション詳細ページ（`/discussions/:id`）

**パンくずリスト:** コミュニティ › 作品名 › スレッドタイトル

**作品情報バー:** サムネイル + 作品名 + ジャンル・話数情報 + 話数バッジ + ネタバレ警告。クリック → 作品詳細ページへ

**スレッド本文:**
- 投稿者アバター（36px丸）+ ユーザー名（クリック → プロフィール）+ 投稿時間
- 投稿者本人には ⋯ メニュー（編集・削除）
- タイトル（h2）+ 本文

**コメント一覧:**
- 「コメント（N）」見出し
- フラットリスト（ネストなし）、`created_at ASC` 順
- 各コメント: アバター（32px丸）+ ユーザー名 + 投稿時間 + 「（編集済み）」表示 + 本文
- コメント投稿者本人には ⋯ メニュー（編集・削除）
- ページネーション（20件/ページ）

**コメント投稿フォーム:**
- 記録済みユーザー: テキストエリア + 投稿ボタン
- 未記録ユーザー: 「コメントするには、この作品をライブラリに記録してください」+ 記録ボタン
- 未ログインユーザー: 「コメントするにはログインしてください」+ ログインリンク

### 6.3 ユーザープロフィールページ（`/users/:id`）

**プロフィールヘッダー:** アバター（80px丸）+ ユーザー名 + 自己紹介 + 登録日

**統計カード:** 4列グリッド — 総記録数 / 完了 / 進行中 / 平均評価

**ジャンル別内訳:** チップ形式（「アニメ 20」「映画 15」等）

**公開ライブラリ:**
- セクションタイトル「公開ライブラリ」
- ジャンルフィルタ（チップUI）+ ソートドロップダウン
- カバー画像グリッド（5列）。各カード: カバー画像 + タイトル + 評価 + ステータス
- カバークリック → 作品詳細ページへ遷移
- ページネーション（20件/ページ）

### 6.4 作品詳細ページ — ディスカッションセクション

既存の感想・タグ・話数感想セクションの下に配置。

**セクションヘッダー:** 「DISCUSSIONS」タイトル + 話数フィルタ（ドロップダウン）+ スレッド作成ボタン（記録済みユーザーのみ表示）

**スレッド一覧:** 最新3件のみ表示。各カード: 話数バッジ + ネタバレ警告 + タイトル + メタ情報

**「すべてのディスカッションを見る →」リンク:** クリック → `/community?work_id=:id` でコミュニティページにその作品でフィルタされた状態で遷移

**スレッド作成モーダル:**
- 話数選択（ドロップダウン: 作品全体 / 第1話〜第N話）
- タイトル入力（最大100文字）
- 本文入力（最大5000文字）
- ネタバレチェックボックス
- キャンセル・作成ボタン

### 6.5 ネタバレ表示

- **一覧**: スレッドカードに「⚠ ネタバレ」バッジ（赤背景）を表示
- **詳細ページ**: 作品情報バーに「⚠ ネタバレ」バッジを表示。本文・コメントは通常表示（詳細ページに来た時点で承知の上と判断）

---

## 7. コンポーネント設計

### 7.1 新規コンポーネント

| コンポーネント | 説明 |
|--------------|------|
| `DiscussionCard` | スレッドカード（一覧用） |
| `DiscussionDetail` | スレッド詳細表示（本文 + メタ情報） |
| `CommentList` | コメント一覧 |
| `CommentItem` | 個別コメント表示 |
| `CommentForm` | コメント投稿フォーム |
| `DiscussionCreateModal` | スレッド作成モーダル |
| `DiscussionSection` | 作品詳細ページ用セクション |
| `UserProfileHeader` | プロフィールヘッダー（アバター・名前・bio） |
| `UserStats` | プロフィール統計カード |
| `PublicLibrary` | 公開ライブラリ一覧 |
| `SpoilerBadge` | ネタバレ警告バッジ |
| `EpisodeBadge` | 話数バッジ |
| `Breadcrumb` | パンくずリスト |

### 7.2 既存コンポーネントの再利用

| コンポーネント | 再利用先 |
|--------------|---------|
| `MediaTypeFilter` | コミュニティページ、プロフィール公開ライブラリ |
| `SortSelector` | コミュニティページ、プロフィール公開ライブラリ |
| `Pagination` | コミュニティページ、コメント一覧、プロフィール公開ライブラリ |
| `RecordListItem` / `WorkCard` | プロフィール公開ライブラリ（カバーグリッド表示） |

### 7.3 カスタムフック

| フック | 説明 |
|-------|------|
| `useDiscussions` | ディスカッション一覧取得（フィルタ・ソート・ページネーション） |
| `useDiscussion` | ディスカッション詳細取得 |
| `useComments` | コメント一覧取得（ページネーション） |
| `useUserProfile` | ユーザープロフィール取得 |
| `useUserRecords` | ユーザー公開記録取得（フィルタ・ソート・ページネーション） |

---

## 8. モバイル対応

### 8.1 BottomTabBar

現在4タブ → 5タブに変更:
ホーム | 検索 | ライブラリ | コミュニティ | マイページ

### 8.2 コミュニティページ（モバイル）

- ジャンルフィルタ: 横スクロール式チップ（ライブラリページのモバイル版と同様）
- スレッドカード: 作品サムネを非表示にし、テキスト情報のみでコンパクト表示
- ソート: ドロップダウンはそのまま

### 8.3 ディスカッション詳細ページ（モバイル）

- パンくずリスト: 横スクロール可能
- 作品情報バー: サムネを小さくし（32×44px）、折り返し対応
- コメントフォーム: テキストエリアの幅100%

### 8.4 ユーザープロフィールページ（モバイル）

- 統計カード: 4列 → 2列グリッド
- 公開ライブラリ: 5列 → 3列グリッド
- フィルタ: 横スクロール式チップ

---

## 9. ルーティング

### 9.1 バックエンド（Rails）

```ruby
namespace :api do
  namespace :v1 do
    # 既存ルートに追加
    resources :works do
      resources :discussions, only: [:index, :create]
    end
    resources :discussions, only: [:index, :show, :update, :destroy] do
      resources :comments, only: [:index, :create]
    end
    resources :comments, only: [:update, :destroy]
    resources :users, only: [:show] do
      resources :records, only: [:index], controller: 'user_records'
    end
  end
end
```

### 9.2 フロントエンド（React Router）

```
/community              → CommunityPage
/discussions/:id        → DiscussionDetailPage
/users/:id              → UserProfilePage
```

---

## 10. テスト方針

### 10.1 バックエンド（RSpec）

**Request Spec（APIテスト）:**
- DiscussionsController: CRUD全操作、権限チェック（未認証、未記録ユーザー、投稿者以外の編集・削除）、フィルタ・ソート・ページネーション
- CommentsController: CRUD全操作、権限チェック、ページネーション、カウンターキャッシュの動作確認
- UsersController: プロフィール取得、存在しないユーザーの404
- UserRecordsController: 公開記録のみ返ること、非公開記録が含まれないこと

**Model Spec:**
- Discussion: バリデーション（title長さ、body長さ、episode_number範囲）
- Comment: バリデーション（body長さ）、カウンターキャッシュ

### 10.2 フロントエンド（Vitest + React Testing Library）

- CommunityPage: フィルタ切り替え、ソート切り替え、ページネーション
- DiscussionDetailPage: スレッド表示、コメント一覧、コメント投稿フォームの表示/非表示（権限別）
- UserProfilePage: プロフィール情報表示、統計表示、公開ライブラリ表示
- DiscussionSection: 作品詳細ページ内のセクション表示
- DiscussionCreateModal: フォーム入力、バリデーション、送信

---

## 11. セキュリティ

- **認可チェック**: 全POST/PATCH/DELETEエンドポイントで投稿権限・編集権限を検証
- **Strong Parameters**: 許可するパラメータを明示的に指定
- **XSS対策**: ReactのデフォルトエスケープでHTMLタグの埋め込みを防止
- **N+1対策**: 一覧取得時に `includes(:user, :work)` でeager loading
- **レート制限**: 初期段階では未実装（将来的にスパム対策として検討）
