# フェーズ2: 記録の充実 — 設計書

## 概要

Recollyの記録機能を拡充し、ユーザーが作品体験をより豊かに記録・整理・振り返れるようにする。フェーズ1で構築した基本的な記録管理（ステータス・評価・進捗）に加え、感想テキスト・タグ・再視聴管理・統計ダッシュボードを追加する。

## スコープ

以下の4機能を優先順に実装する:

1. **話数ごとの感想・評価（EpisodeReviews + 全体感想）**
2. **タグ機能（Tags / RecordTags）**
3. **再視聴回数のUI**
4. **ダッシュボード統計サマリー**

※ 手動作品登録はフェーズ1で実装済みのためスコープ外。

## 1. 話数ごとの感想・全体感想

### 要件

- 全ジャンル共通で**作品全体の感想**（テキスト）を書ける
- 話数があるジャンル（アニメ・ドラマ・漫画）では**話数ごとの感想**も書ける
- 感想はテキストのみ（話数ごとの個別評価なし。作品全体の10点満点評価は既存機能）。既存仕様書（2026-03-20）ではEpisodeReviewに`rating`カラムが定義されているが、ブレインストーミングの結果ratingは不要と判断。既存仕様書は本スペック確定後に更新する
- 長文レビューを想定（数段落の考察・振り返り）
- フェーズ2ではプライベート。フェーズ3で公開/非公開を選べるようにするため、`visibility`カラムを事前に用意

### データモデル

#### Recordモデル（既存に追加）

| カラム | 型 | 説明 |
|--------|-----|------|
| `review_text` | text | 作品全体の感想（nullable、最大10,000文字） |
| `visibility` | integer | enum: `private(0)`, `public(1)` default: 0 |

- フェーズ2では `visibility` はAPIで受け付けない（常に `private`）。フェーズ3で切り替えUI実装時にStrong Parametersに追加する
- `review_text` は既存の `PATCH /api/v1/records/:id` の `record_update_params` に追加

#### EpisodeReviewモデル（新規）

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | bigint | PK |
| `record_id` | references | 所属する記録（外部キー、NOT NULL） |
| `episode_number` | integer | 話数（1始まり、NOT NULL） |
| `body` | text | 感想テキスト（NOT NULL、最大10,000文字） |
| `visibility` | integer | enum: `private(0)`, `public(1)` default: 0 |
| `created_at` | datetime | |
| `updated_at` | datetime | |

- ユニーク制約: `[record_id, episode_number]`
- インデックス: `record_id`

#### リレーション

```
Record has_many :episode_reviews, dependent: :destroy
EpisodeReview belongs_to :record
```

### API

#### 作品全体の感想

既存の `PATCH /api/v1/records/:id` に `review_text` パラメータを追加。新規エンドポイント不要。

#### 話数感想API

| メソッド | エンドポイント | 説明 | レスポンス |
|---------|--------------|------|-----------|
| `GET` | `/api/v1/records/:record_id/episode_reviews` | 話数感想一覧（episode_number昇順） | 200 |
| `POST` | `/api/v1/records/:record_id/episode_reviews` | 話数感想作成 | 201 |
| `PATCH` | `/api/v1/records/:record_id/episode_reviews/:id` | 話数感想更新 | 200 |
| `DELETE` | `/api/v1/records/:record_id/episode_reviews/:id` | 話数感想削除 | 204 |

- 作成時パラメータ: `{ episode_review: { episode_number, body } }`
- 同じ話数に2つ以上の感想は書けない（ユニーク制約によりバリデーション）
- `episode_number` のバリデーション: 1以上。`work.total_episodes` が設定されている場合はその値以下

### UI

#### WorkDetailPage — 作品全体の感想セクション

- あらすじセクションの下に配置
- テキストエリア（複数行対応）+ 保存ボタン
- 未記入時はプレースホルダー「作品の感想を書く...」を表示

#### WorkDetailPage — 話数ごとの感想セクション

- 全体感想セクションの下に配置
- 話数があるジャンル（アニメ・ドラマ・漫画）のみ表示
- 入力フォーム: 話数番号入力 + テキストエリア + 保存ボタン
  - 話数番号のデフォルト値は `current_episode`（現在の進捗話数）
- 過去の感想一覧: 話数降順で表示（新しい話数が上）
  - 各カード: 「第N話」+ 日付 + 感想テキスト
  - 編集・削除機能あり

## 2. タグ機能

### 要件

- ユーザーが自由にタグを作成（「泣ける」「伏線がすごい」など）
- タグは記録（Record）に紐付ける（作品ではなくユーザーの記録に対して）
- 同一ユーザー内でタグ名の重複は不可
- ライブラリページでタグによるフィルタリングが可能
- 将来フェーズ4でタグベースのレコメンドに活用

### データモデル

#### Tagモデル（新規）

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | bigint | PK |
| `name` | string | タグ名（最大30文字、NOT NULL） |
| `user_id` | references | 作成者（外部キー、NOT NULL） |
| `created_at` | datetime | |
| `updated_at` | datetime | |

- ユニーク制約: `[user_id, name]`
- インデックス: `user_id`

#### RecordTagモデル（新規・中間テーブル）

| カラム | 型 | 説明 |
|--------|-----|------|
| `record_id` | references | NOT NULL |
| `tag_id` | references | NOT NULL |

- ユニーク制約: `[record_id, tag_id]`
- タイムスタンプ不要（中間テーブルのため `t.timestamps` は使用しない）

#### リレーション

```
User has_many :tags
Tag belongs_to :user
Tag has_many :record_tags, dependent: :destroy
Record has_many :record_tags, dependent: :destroy
Record has_many :tags, through: :record_tags
```

### API

| メソッド | エンドポイント | 説明 | レスポンス |
|---------|--------------|------|-----------|
| `GET` | `/api/v1/tags` | 自分のタグ一覧 | 200 |
| `POST` | `/api/v1/records/:record_id/tags` | 記録にタグ付与（未存在なら自動作成） | 201 |
| `DELETE` | `/api/v1/records/:record_id/tags/:tag_id` | 記録からタグ除去 | 204 |
| `DELETE` | `/api/v1/tags/:id` | タグ自体を削除（関連record_tagsも連動削除） | 204 |

- `POST /records/:record_id/tags` は `{ tag: { name: "泣ける" } }` を受け取る
  - 同名タグが既にあればそれを紐付け、なければ新規作成して紐付け
- `GET /api/v1/tags` はタグ名のオートコンプリート用

#### ライブラリAPIの拡張

既存の `GET /api/v1/records` に `tag` クエリパラメータを追加:
- `GET /api/v1/records?tag[]=泣ける` — 指定タグで絞り込み
- 複数タグ指定時はAND条件: `?tag[]=泣ける&tag[]=作画神`
- 既存のフィルタ（`status`, `media_type`）と組み合わせて使用可能

### UI

#### WorkDetailPage — タグセクション

- 日付セクションの下に配置
- 付与済みタグをチップ（バッジ）で表示。各チップに×ボタンで除去可能
- テキスト入力 + 追加ボタンでタグ付与
- 入力時に既存タグのオートコンプリートを表示

#### LibraryPage — タグフィルタ

- ジャンルフィルタの下にタグフィルタ行を追加
- ユーザーが作成済みのタグをチップとして表示
- 複数選択可（AND条件で絞り込み）
- URLクエリパラメータに `tag[]` を追加して同期

#### LibraryPage — 記録カードのタグバッジ

- 記録カードの作品タイトル下にタグバッジを小さく表示

## 3. 再視聴回数のUI

### 要件

- `rewatch_count` カラムは既にRecordモデルに存在（default: 0）
- 作品詳細ページでUIを追加するのみ

### API

既存の `PATCH /api/v1/records/:id` を使用。`record_update_params` に `rewatch_count` を追加する必要がある（DBカラムは存在するがStrong Parametersに未登録）。

### UI

#### WorkDetailPage — 再視聴回数セクション

- 進捗セクションの下に配置
- `-` ボタン + 「N回」表示 + `+` ボタン（ProgressControlと同じ操作感）
- 最小値: 0

## 4. ダッシュボード統計サマリー

### 要件

- ダッシュボードの進行中リストの上に統計セクションを配置
- 表示する統計情報:
  - ジャンル別の記録数（アニメ○本、映画○本…）
  - ステータス別の記録数（視聴中○、完了○…）
  - 月別の完了数推移（直近12ヶ月）
  - 総視聴話数・総読了巻数

### API

| メソッド | エンドポイント | 説明 | レスポンス |
|---------|--------------|------|-----------|
| `GET` | `/api/v1/statistics` | ダッシュボード統計 | 200 |

レスポンス構造:

```json
{
  "by_genre": {
    "anime": 18,
    "movie": 9,
    "drama": 0,
    "book": 3,
    "manga": 7,
    "game": 5
  },
  "by_status": {
    "watching": 10,
    "completed": 23,
    "on_hold": 1,
    "dropped": 2,
    "plan_to_watch": 6
  },
  "monthly_completions": [
    { "month": "2026-03", "count": 5 },
    { "month": "2026-02", "count": 3 },
    { "month": "2026-01", "count": 6 }
  ],
  "totals": {
    "episodes_watched": 245,
    "volumes_read": 30
  }
}
```

- `monthly_completions` は直近12ヶ月分を返す（データがない月は `count: 0`）
- `totals.episodes_watched` はアニメ・ドラマの `current_episode` 合計
- `totals.volumes_read` は漫画・本の `current_episode` 合計
- `by_status` のキーはRecordモデルのenum内部キー（`watching`, `completed`等）を使用。フロントでジャンル別表示ラベルに変換する
- パフォーマンス: 現時点ではキャッシュ不要。将来レコード数が増加した場合のキャッシュ戦略はスコープ外

### UI

#### DashboardPage — 統計サマリーセクション

- 進行中リストの上に配置
- 数値カード4枚（横並びグリッド）: 総記録数、総視聴話数、総読了巻数、今月完了数
- ジャンル別 + ステータス別の横棒グラフ（2カラムレイアウト）
- 月別完了数の縦棒チャート（直近6ヶ月表示）
- モバイルでは数値カードは2×2グリッド、棒グラフは1カラムに切り替え

## 実装順序

1. **話数感想** — 新規モデル + API + UI（最大のスコープ）
2. **タグ機能** — 新規モデル2つ + API + UI + ライブラリ拡張
3. **再視聴回数UI** — フロントエンドのみ（最小スコープ）
4. **ダッシュボード統計** — 集計API + UI

## スコープ外

- 感想のMarkdown対応（プレーンテキストのみ）
- 感想の公開/非公開切り替えUI（フェーズ3で実装。カラムのみ事前準備）
- システム定義タグ
- タグの編集（名前変更）機能
- 統計の期間フィルタリング
- 統計のエクスポート機能
- 統計APIのキャッシュ
- 既存仕様書（2026-03-20）のEpisodeReview定義更新（本スペック確定後に別途更新）
