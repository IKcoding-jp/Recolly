# 漫画の進捗管理を話数から巻数に変更

## 概要

漫画の進捗管理で、AniListから取得するデータを `chapters`（話数）から `volumes`（巻数）に変更する。
合わせて、連載中作品の自動完了を防止し、新刊通知UIを追加する。

## 背景・動機

現状の問題:
- フロントエンドは「巻」と表示しているが、実際に取得しているのは話数（chapters）
  - 例: ナルトは「700巻」と表示されるが、正しくは72巻
- 連載中の漫画で最新話数に到達すると、自動的に「完了」になってしまう

## 変更箇所

### 1. AniList GraphQLクエリの変更

**ファイル:** `backend/app/services/external_apis/anilist_adapter.rb`

GraphQLクエリに `volumes` フィールドを追加する。

```graphql
query ($search: String) {
  Page(perPage: 20) {
    media(search: $search, isAdult: false, sort: POPULARITY_DESC) {
      id
      title { romaji native english }
      description(asHtml: false)
      coverImage { large }
      episodes
      chapters
      volumes        # 追加
      type
      format
      genres
      status
      seasonYear
      popularity
    }
  }
}
```

### 2. normalize メソッドの変更

**ファイル:** `backend/app/services/external_apis/anilist_adapter.rb`

漫画の場合、`total_episodes` にマッピングする値を変更する。

| メディアタイプ | 現在 | 変更後 |
|--------------|------|--------|
| anime | `episodes` | `episodes`（変更なし） |
| manga | `chapters` | `volumes` |

```ruby
# 変更前
item['episodes'] || item['chapters']

# 変更後
def total_episodes_for(item, media_type)
  if media_type == 'manga'
    item['volumes']
  else
    item['episodes']
  end
end
```

### 3. AniListの作品ステータスをWorkに保存

**ファイル:** `backend/app/services/external_apis/anilist_adapter.rb`

AniListの `status` フィールド（`FINISHED`, `RELEASING`, `NOT_YET_RELEASED`, `CANCELLED`, `HIATUS`）を `metadata` に保存する。

現在 `build_metadata` で `status` は取得済みだが、Work作成時に `metadata` が渡されていない。

**ファイル:** `backend/app/controllers/api/v1/records_controller.rb`

`find_or_create_from_external` で `metadata` も受け渡すようにする。

### 4. SearchResult に metadata を含めてフロントに返す

**ファイル:** `backend/app/controllers/api/v1/works_controller.rb`

検索結果の `to_h` に `metadata` を含める（現在は含まれている）。

**ファイル:** `frontend/src/lib/types.ts`

Work型の `metadata` に `anilist_status` を型定義する。

```typescript
export interface WorkMetadata {
  status?: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS'
  genres?: string[]
  season_year?: number
  popularity?: number
  title_english?: string
  title_romaji?: string
}
```

### 5. 自動完了ロジックの変更

**ファイル:** `backend/app/models/record.rb`

`auto_complete_on_episode_reach` メソッドを変更し、完結作品のみ自動完了する。

```ruby
def auto_complete_on_episode_reach
  return unless current_episode_changed?
  return if status == 'completed'
  return if work.total_episodes.blank?
  return unless current_episode >= work.total_episodes
  return unless work.metadata&.dig('status') == 'FINISHED'  # 追加

  self.status = 'completed'
  self.completed_at ||= Date.current
  self.started_at ||= Date.current
end
```

### 6. フロントエンド：連載中バッジの表示

**ファイル:** `frontend/src/components/ui/ProgressControl/ProgressControl.tsx`

連載中の漫画には「連載中」バッジを表示する。

Props に `isOngoing?: boolean` を追加。
- `isOngoing = true` の場合、進捗ラベルの横に「連載中」バッジを表示

### 7. フロントエンド：未読バッジの表示

**ファイル:** `frontend/src/components/WatchingListItem/WatchingListItem.tsx`

ホーム画面の WatchingListItem に「未読 X巻」バッジを追加する。

表示条件:
- `media_type === 'manga'`
- `work.total_episodes !== null`
- `current_episode < work.total_episodes`
- `work.metadata.status === 'RELEASING'`

未読巻数 = `work.total_episodes - record.current_episode`

バッジのスタイル:
- 背景色: `#e07a5f`（漫画カラー）
- 文字色: `#fff`
- フォントサイズ: `0.65rem`
- 表示例: 「未読 1巻」「未読 3巻」

### 8. 作品詳細ページの新刊アラート

**ファイル:** `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`

連載中の漫画で未読巻がある場合、進捗セクションの下にアラートを表示する。

```
📖 新刊が出ています！ 111巻
```

表示条件: 未読バッジと同じ（未読巻数 > 0 かつ連載中）

### 9. データ更新の仕組み（ハイブリッド方式）

#### 9a. オンデマンド更新

作品詳細ページを開いたとき、前回の更新から24時間以上経過していたらAniListのデータを再取得する。

**新規カラム:** `works.last_synced_at` (datetime)

更新フロー:
1. フロントが作品詳細ページを開く
2. バックエンドが `last_synced_at` を確認
3. 24時間以上経過していたらAniListに問い合わせ
4. `total_episodes`、`metadata.status` を更新
5. `last_synced_at` を現在時刻に更新

**新規エンドポイント:** `POST /api/v1/works/:id/sync`
- AniListからデータを再取得して更新
- レスポンスで更新後のWorkを返す

**フロント側:** 作品詳細ページの読み込み時に `last_synced_at` をチェックし、古ければ sync エンドポイントを呼ぶ。

#### 9b. 週次バッチ更新

Rakeタスクで全漫画作品のデータをAniListからまとめて更新する。

**新規ファイル:** `backend/lib/tasks/sync_anilist.rake`

```ruby
# 週1回実行（cron等で設定）
# AniListの漫画作品を一括更新
rake anilist:sync_manga
```

処理内容:
- `Work.where(media_type: :manga, external_api_source: 'anilist')` を対象
- AniListのAPIで `volumes` と `status` を取得
- 変更があれば更新
- AniListのレートリミット（90リクエスト/分）を考慮してスリープ挿入

### 10. 既存データの移行

既存の漫画作品は `chapters` が `total_episodes` に入っている。
マイグレーション（データ修正用Rakeタスク）で、既存の漫画作品をAniListから `volumes` を再取得して更新する。

## 影響範囲

| 対象 | 影響 |
|------|------|
| バックエンド：AniListAdapter | GraphQLクエリ変更、normalizeメソッド変更 |
| バックエンド：Record モデル | 自動完了ロジックにステータスチェック追加 |
| バックエンド：RecordsController | metadata の受け渡し追加 |
| バックエンド：WorksController | sync エンドポイント追加 |
| バックエンド：マイグレーション | `last_synced_at` カラム追加 |
| バックエンド：Rakeタスク | 週次バッチ + 既存データ移行 |
| フロントエンド：types.ts | WorkMetadata 型追加 |
| フロントエンド：ProgressControl | 連載中バッジ追加 |
| フロントエンド：WatchingListItem | 未読バッジ追加 |
| フロントエンド：WorkDetailPage | 新刊アラート追加、sync呼び出し |

## 影響しないもの

- アニメ・映画・ドラマ・本・ゲームの進捗管理（変更なし）
- 統計ページの集計ロジック（`current_episode` を合算する既存ロジックはそのまま）
- 認証・ユーザー管理

## テスト方針

- AniListAdapter: volumes フィールドの取得、manga の場合に volumes が使われることを確認
- Record モデル: FINISHED の場合のみ自動完了、RELEASING の場合は完了しないことを確認
- sync エンドポイント: 24時間以内は再取得しない、24時間超過で再取得することを確認
- WatchingListItem: 未読バッジの表示条件（連載中 + 未読あり）を確認
- ProgressControl: 連載中バッジの表示を確認
- WorkDetailPage: 新刊アラートの表示条件を確認
