# マイライブラリ（一覧・フィルタ）設計スペック

## 概要

ユーザーが自分の記録を一覧表示し、ステータス・ジャンルでフィルタリング、ソート、ページネーションで閲覧できるページ。

**パス:** `/library`（要認証）

## 要件

### 機能要件

- 記録一覧をリスト形式で表示
- ステータス別フィルタ（視聴中/完了/中断/一時停止/視聴予定）
- ジャンル別フィルタ（アニメ/映画/ドラマ/本/漫画/ゲーム）
- ステータス×ジャンルのAND条件フィルタ
- ソート（更新日/評価/タイトル）
- ページネーション（20件/ページ）
- フィルタ・ソート・ページ状態をURLクエリパラメータに反映
- カバー画像 or タイトルクリックで `/works/:id` へ遷移
- 記録0件時のイラスト付き空状態表示

### デフォルト状態

- ステータス: `watching`（視聴中）。URLに `status` パラメータが無い場合は `watching` として扱う
- ジャンル: なし（全ジャンル）
- ソート: `updated_at`（更新日降順）
- ページ: `1`

### ステータスフィルタの「全ステータス」

- ステータスフィルタには「すべて」選択肢を提供する
- 「すべて」選択時はURLから `status` パラメータを削除し、全ステータスの記録を表示
- 初回アクセス時（URLに `status` なし）はデフォルトの `watching` を適用

## URLクエリパラメータ

```
/library?status=watching&media_type=anime&sort=updated_at&page=1
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|---|----------|------|
| `status` | `RecordStatus \| null` | `watching` | ステータスフィルタ |
| `media_type` | `MediaType \| null` | なし（全ジャンル） | ジャンルフィルタ |
| `sort` | `SortOption` | `updated_at` | ソート順 |
| `page` | `number` | `1` | ページ番号 |

## アーキテクチャ

### アプローチ: カスタムフック集約型

WorkDetailPageの `useWorkDetail` パターンを踏襲。`useLibrary` カスタムフックに全ロジックを集約し、`LibraryPage` はUIの描画のみを担当する。

### ファイル構成

```
frontend/src/
├── pages/LibraryPage/
│   ├── LibraryPage.tsx          ← ページコンポーネント（UIのみ）
│   ├── LibraryPage.module.css
│   ├── useLibrary.ts            ← カスタムフック（全ロジック集約）
│   └── LibraryPage.test.tsx
├── components/
│   ├── StatusFilter/
│   │   ├── StatusFilter.tsx     ← ステータスフィルタ（ピル群、「すべて」付き）
│   │   ├── StatusFilter.module.css
│   │   └── StatusFilter.test.tsx
│   ├── RecordListItem/
│   │   ├── RecordListItem.tsx   ← 記録カード（リスト行）
│   │   ├── RecordListItem.module.css
│   │   └── RecordListItem.test.tsx
│   ├── MediaTypeFilter/
│   │   ├── MediaTypeFilter.tsx  ← ジャンルフィルタ（ピル群）
│   │   ├── MediaTypeFilter.module.css
│   │   └── MediaTypeFilter.test.tsx
│   ├── SortSelector/
│   │   ├── SortSelector.tsx     ← ソート選択（ピル群）
│   │   ├── SortSelector.module.css
│   │   └── SortSelector.test.tsx
│   └── ui/Pagination/
│       ├── Pagination.tsx       ← ページネーション（汎用、他ページでも再利用可）
│       ├── Pagination.module.css
│       └── Pagination.test.tsx
```

## カスタムフック `useLibrary`

### インターフェース

```typescript
// UI上の表示名とAPIに送るパラメータのマッピング
// - 更新日: sort=updated_at（降順）
// - 評価: sort=rating（降順、高い順）
// - タイトル: sort=title_asc（昇順、A→Z）
type SortOption = 'updated_at' | 'rating' | 'title_asc'

interface PaginationMeta {
  current_page: number
  total_pages: number
  total_count: number
  per_page: number
}

function useLibrary(): {
  // データ
  records: UserRecord[]
  totalPages: number
  isLoading: boolean
  error: string | null

  // フィルタ状態（URLから派生）
  status: RecordStatus | null
  mediaType: MediaType | null
  sort: SortOption
  page: number

  // 操作
  setStatus: (status: RecordStatus | null) => void
  setMediaType: (mediaType: MediaType | null) => void
  setSort: (sort: SortOption) => void
  setPage: (page: number) => void
}
```

### URL同期の仕組み

- `useSearchParams()`（React Router）でURLクエリパラメータを読み書き
- フィルタ変更 → URLを更新 → `useEffect`でURL変更を検知 → API呼び出し
- ステータス/ジャンル/ソート変更時はページを1にリセット

### API呼び出し

- 既存の `recordsApi.getAll(filters)` を拡張して `page`/`per_page` パラメータに対応
- レスポンスの `meta` からページネーション情報を取得

## バックエンド: ページネーション対応

### クエリパラメータ追加

| パラメータ | デフォルト | 最大 | 説明 |
|-----------|----------|------|------|
| `page` | `1` | — | ページ番号 |
| `per_page` | `20` | `100` | 1ページあたりの件数 |

### レスポンス形式の拡張

```json
{
  "records": [...],
  "meta": {
    "current_page": 1,
    "total_pages": 3,
    "total_count": 45,
    "per_page": 20
  }
}
```

### 実装方針

- gem不使用。`offset`/`limit` で手動実装
- `per_page` の上限バリデーション（100超えは100に丸める）
- 既存のフィルタ・ソートパラメータはそのまま共存

### 後方互換性

- `page`/`per_page` パラメータが無い場合は従来通り全件返却（`meta` なし）
- `page` または `per_page` が指定された場合のみページネーション適用（`meta` 付き）
- フロントエンドの `RecordsListResponse` 型に `meta?: PaginationMeta` をオプショナルで追加
- 既存の呼び出し元（`WorkDetailPage` 等）は変更不要

## UIコンポーネント設計

### LibraryPage

- SectionTitle「マイライブラリ」
- フィルタエリア: StatusFilter（新規、「すべて」付き）→ MediaTypeFilter（新規）→ SortSelector（新規）
- 記録リスト: RecordListItem × N件（max-width中央寄せ、1列リスト）
- Pagination
- 空状態 / エラー状態 / ローディング状態の出し分け

### RecordListItem

- 横長カード: カバー画像（50×70px）+ タイトル + ステータスバッジ + 評価（★N）+ 進捗バー（N/M話）
- カード全体がクリッカブル → `/works/:id` へ遷移（`useNavigate`、既存ルーティングと統一）
- 進捗バーは `total_episodes` がある場合のみ表示
- 評価は設定済みの場合のみ表示

### MediaTypeFilter

- StatusSelectorと同じピルボタンパターン
- 選択肢: 「全ジャンル」+ アニメ / 映画 / ドラマ / 本 / 漫画 / ゲーム
- 「全ジャンル」選択時は `mediaType=null`（フィルタ解除）

### SortSelector

- ピルボタンパターン（StatusSelectorと統一）
- 選択肢: 更新日（`updated_at`）/ 評価（`rating`）/ タイトル（`title_asc`、A→Z）
- UI上は「タイトル」と表示し、APIには `title_asc` を送信
- ラベル「並び替え」を左に表示

### Pagination

- 「前へ」「次へ」ボタン + 現在ページ / 総ページ数表示
- 1ページ目で「前へ」無効、最終ページで「次へ」無効

## データフロー

```
URLクエリパラメータ変更
  → useLibrary が useSearchParams() で検知
  → recordsApi.getAll({ status, mediaType, sort, page, perPage }) を呼び出し
  → isLoading: true → レスポンス受信 → records/meta を state に反映 → isLoading: false
```

## エラーハンドリング

| ケース | 処理 |
|-------|------|
| API呼び出し失敗 | `error` stateにメッセージをセット → ページ上部にエラーメッセージ表示 |
| 認証エラー（401） | 既存の `AuthContext` に委譲（ログインページへリダイレクト） |

## 空状態

| 条件 | 表示 |
|------|------|
| フィルタ適用中の0件 | 「条件に一致する記録がありません」（フィルタ解除を促すテキスト） |
| フィルタなしの0件 | アイコン + 「作品を探して記録しましょう」+ 検索ページへのButton |

## ナビゲーション

- 既存ナビゲーションに `/library` へのリンクを追加
- カバー画像 or タイトルクリック → `/works/:id` へ遷移

## スコープ外

- ダッシュボードからの「+1話」ボタン（タスクCで実装）
- 記録の一括操作（削除・ステータス変更等）
- 検索機能（ライブラリ内のタイトル検索）
