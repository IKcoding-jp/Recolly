# 記録の詳細機能（ステータス変更・評価・進捗管理）— 設計仕様書

## 1. 概要

Recordsの基盤（作成のみ）は実装済み。本機能では記録の閲覧・更新・削除と、それに伴うUI（作品詳細ページ、検索ページの記録モーダル）を実装する。

### 1.1 スコープ

- Records API の CRUD 完成（GET / PATCH / DELETE 追加）
- 記録作成時にステータス・評価を指定可能にする
- 作品詳細ページ（`/works/:id`）の新規作成
- ステータス変更時の自動処理ロジック
- 10点満点評価システム
- 進捗管理（+1/-1ボタン、数字直接入力）
- 記録の削除（確認ダイアログ付き）

### 1.2 スコープ外

- マイライブラリページ（タスクB で実装）
- ダッシュボード（タスクC で実装）
- 話数ごとの感想（フェーズ2）
- タグ機能（フェーズ2）

---

## 2. API設計

### 2.1 既存エンドポイントの変更

**POST /api/v1/records**（記録作成）

パラメータ追加：

```json
{
  "work_id": 1,
  "status": "watching",
  "rating": 7
}
```

- `status`: 省略時は `plan_to_watch`
- `rating`: 省略時は `null`

### 2.2 新規エンドポイント

| メソッド | パス | レスポンス | 用途 |
|---------|------|-----------|------|
| GET | `/api/v1/records` | 200 + records[] | 自分の記録一覧 |
| GET | `/api/v1/records/:id` | 200 + record | 記録詳細（work情報含む） |
| PATCH | `/api/v1/records/:id` | 200 + record | 更新 |
| DELETE | `/api/v1/records/:id` | 204 No Content | 削除 |

### 2.3 GETフィルタ・ソート

```
GET /api/v1/records?status=watching&media_type=anime&sort=updated_at
```

| パラメータ | 説明 | デフォルト |
|-----------|------|-----------|
| `status` | ステータスでフィルタ | なし（全件） |
| `media_type` | ジャンルでフィルタ（work経由） | なし（全件） |
| `work_id` | 特定の作品の記録を取得 | なし |
| `sort` | ソート順 | `updated_at`（降順） |

ソート可能フィールド: `updated_at`, `rating`, `title`（全て降順。昇順が必要な場合は `sort=title_asc` のように `_asc` を付ける）

**WorkDetailPage のデータ取得**: `/works/:id` ページでは `GET /api/v1/records?work_id=:id` で現在のユーザーの記録を取得する。

### 2.4 レスポンス形式

**GET /api/v1/records/:id**

```json
{
  "record": {
    "id": 1,
    "status": "watching",
    "rating": 7,
    "current_episode": 32,
    "rewatch_count": 0,
    "started_at": "2026-01-15",
    "completed_at": null,
    "created_at": "2026-01-15T10:00:00Z",
    "updated_at": "2026-03-20T15:30:00Z",
    "work": {
      "id": 1,
      "title": "進撃の巨人",
      "media_type": "anime",
      "cover_image_url": "https://...",
      "total_episodes": 75,
      "description": "巨人がすべてを支配する世界..."
    }
  }
}
```

**GET /api/v1/records**

```json
{
  "records": [
    { "id": 1, "status": "watching", "rating": 7, "current_episode": 32, "work": { ... } },
    { "id": 2, "status": "completed", "rating": 9, "current_episode": 12, "work": { ... } }
  ]
}
```

### 2.5 更新可能フィールド

**PATCH /api/v1/records/:id**

```json
{
  "status": "completed",
  "rating": 9,
  "current_episode": 75,
  "started_at": "2026-01-15",
  "completed_at": "2026-03-21"
}
```

全フィールド任意。送信されたフィールドのみ更新。

### 2.6 認可

- 全エンドポイントで認証必須
- 自分の記録のみ操作可能（他ユーザーの記録 → 403 Forbidden）

---

## 3. バックエンドロジック

### 3.1 自動処理（モデルコールバック）

| トリガー | 処理 |
|---------|------|
| status → `watching` | `started_at` を今日にセット（未設定の場合のみ） |
| status → `completed` | `completed_at` を今日にセット。`current_episode` を `work.total_episodes` に揃える（total_episodesがある場合のみ） |
| status → `plan_to_watch` | `started_at`・`completed_at` をクリア、`current_episode` を0にリセット、`rating` をnullにリセット |
| `current_episode` が `work.total_episodes` に到達 | status を `completed` に自動変更（→ completedのコールバックも連鎖） |
| 新規記録を `completed` で作成 | `started_at`・`completed_at` 両方を今日にセット |

### 3.2 バリデーション

| フィールド | ルール |
|-----------|--------|
| rating | 1〜10の整数、またはnull |
| current_episode | 0以上の整数。`work.total_episodes` がある場合はそれ以下 |
| status | enum値のみ（watching, completed, on_hold, dropped, plan_to_watch） |
| user_id + work_id | ユニーク制約（既存） |
| started_at | completed_at より前であること（両方設定されている場合） |

### 3.3 DBマイグレーション

rating カラムのバリデーション範囲を 1〜5 から 1〜10 に変更（カラム定義自体は integer のため変更不要。モデルバリデーションのみ修正）。

---

## 4. フロントエンド設計

### 4.1 新規コンポーネント

| コンポーネント | 配置先 | 用途 |
|--------------|--------|------|
| RatingInput | `components/ui/` | 10点満点の評価入力（1〜10のボタン） |
| RatingDisplay | `components/ui/` | 評価表示（`7 / 10` 形式） |
| StatusBadge | `components/ui/` | ステータスのバッジ表示（色分け） |
| StatusSelector | `components/ui/` | ステータス選択UI（ピル型ボタン群） |
| ProgressControl | `components/ui/` | 進捗操作（+1/-1ボタン、数字入力、プログレスバー） |
| RecordModal | `components/` | 検索ページの記録時モーダル（ステータス＋評価設定） |
| RecordDeleteDialog | `components/` | 削除確認ダイアログ |

### 4.2 新規ページ

| ページ | パス | レイアウト |
|-------|------|-----------|
| WorkDetailPage | `/works/:id` | サイドバー型（AniList風）。左にカバー画像・メタデータ、右にステータス・評価・進捗・日付・あらすじ |

### 4.3 既存コンポーネントの変更

| 対象 | 変更内容 |
|------|---------|
| SearchPage | 「記録する」ボタン → RecordModal呼び出しに変更 |
| recordsApi.ts | `update`, `delete`, `getAll`, `getOne` メソッド追加 |
| types.ts | rating の型を1〜10に修正 |

### 4.4 画面フロー

```
検索ページ
  → 「記録する」ボタン
  → RecordModal（ステータス＋評価設定）
  → POST /api/v1/records
  → 記録完了

マイライブラリ（タスクBで実装）
  → カバー画像クリック
  → WorkDetailPage（/works/:id）

WorkDetailPage
  ├── StatusSelector → PATCH /api/v1/records/:id（ステータス変更 + 自動処理）
  ├── RatingInput → PATCH /api/v1/records/:id（評価変更）
  ├── ProgressControl
  │   ├── 「+1」ボタン → PATCH（current_episode + 1）
  │   ├── 「-1」ボタン → PATCH（current_episode - 1）
  │   └── 数字直接入力 → PATCH（current_episode = N）
  ├── 日付表示（started_at / completed_at）
  └── 「記録を削除」→ RecordDeleteDialog → DELETE /api/v1/records/:id
```

### 4.5 WorkDetailPageのレイアウト（サイドバー型）

```
┌──────────────────────────────────────────────┐
│ [←戻る]                                      │
├──────────┬───────────────────────────────────┤
│          │ タイトル                            │
│ カバー    │ 英語タイトル                        │
│ 画像     │                                    │
│          │ [視聴中] [視聴完了] [中断] [停止] [予定] │
│──────────│                                    │
│ 情報      │ 評価: [1][2][3]...[10]  7/10      │
│ 話数: 75  │                                    │
│ 放送: 2013│ 進捗: [-] 32/75話 [+] [__]        │
│ ジャンル   │ ████████████░░░░░░░ 43%           │
│          │                                    │
│          │ 開始日: 2026/01/15                   │
│          │ 完了日: —                            │
│          │                                    │
│          │ あらすじ                              │
│          │ 巨人がすべてを支配する世界...           │
│          │                                    │
│          │ [記録を削除]                          │
└──────────┴───────────────────────────────────┘
```

---

## 5. テスト方針

### 5.1 バックエンド（RSpec）

- **モデル**: 自動処理コールバックの全パターン、バリデーション（rating 1〜10、日付整合性）
- **リクエストスペック**: GET/PATCH/DELETE の正常系・異常系、認可チェック（他ユーザーの記録 → 403）、フィルタ・ソート

### 5.2 フロントエンド（Vitest + React Testing Library）

- **コンポーネント**: RatingInput, StatusSelector, ProgressControl, RecordModal, RecordDeleteDialog
- **ページ**: WorkDetailPage の表示・操作
- **API**: recordsApi の新規メソッド
