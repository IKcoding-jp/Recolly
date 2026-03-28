# 画像アップロード機能 設計スペック

> 手動登録機能にカバー画像アップロードを追加する。署名付きURL方式でフロントエンドからS3に直接アップロード。

## 1. 概要

### 目的

手動登録時に作品のカバー画像をアップロードできるようにする。技術課題の設計書（`docs/画像アップロード処理_詳細設計書.md`）をもとに、署名付きURL方式で自前実装する。

### スコープ

- 手動登録フォームにカバー画像アップロードUIを追加
- 作品詳細画面からカバー画像の変更・削除を可能にする
- 署名付きURL方式でS3に直接アップロード
- images テーブル新設（ポリモーフィック関連）
- 即時ロールバック + 定期バッチによる孤立ファイルクリーンアップ

### スコープ外

- プロフィール画像、感想添付画像（将来拡張としてポリモーフィック関連で対応可能）
- 画像の一覧表示・ページネーション（カバー画像は1作品1枚）
- 画像のリサイズ・最適化

## 2. データモデル

### images テーブル

| カラム | 型 | 制約 | 意味 |
|--------|------|------|------|
| id | bigint (PK) | NOT NULL | 主キー |
| imageable_type | string | NOT NULL | 紐づくテーブル名（"Work"等） |
| imageable_id | bigint | NOT NULL | 紐づくレコードのID |
| s3_key | string | NOT NULL, UNIQUE | S3上の保存パス |
| file_name | string | NOT NULL | 元のファイル名（表示用） |
| content_type | string | NOT NULL | ファイル形式（image/jpeg等） |
| file_size | integer | NOT NULL | ファイルサイズ（バイト） |
| created_at | datetime | NOT NULL | 作成日時 |
| updated_at | datetime | NOT NULL | 更新日時 |

**インデックス:** `(imageable_type, imageable_id)` 複合インデックス

### モデル関連

```ruby
# Image
belongs_to :imageable, polymorphic: true
# バリデーション: s3_key, file_name, content_type, file_size, imageable presence
# content_type: image/jpeg, image/png, image/gif, image/webp のみ
# file_size: 10MB以下

# Work
has_many :images, as: :imageable, dependent: :destroy
# カバー画像ヘルパー: 最新の1枚を返す
```

### 既存テーブルへの影響

- `works.cover_image_url` — 新規アップロードでは使用しない。images テーブルから取得する。既存カラムは残す。

## 3. APIエンドポイント

全エンドポイントに認証チェック必須。

### POST /api/v1/images/presign

署名付きURL発行。

**リクエスト:**
```json
{
  "image": {
    "file_name": "cover.jpg",
    "content_type": "image/jpeg",
    "file_size": 1200000
  }
}
```

**バリデーション:**
- content_type が JPEG/PNG/GIF/WebP のいずれか
- file_size が 10MB以下

**注:** imageable_type/imageable_id は presign 時点では不要。手動登録ではWorkがまだ存在しないため、メタデータ登録（POST /api/v1/images）時に指定する。

**レスポンス (200):**
```json
{
  "presigned_url": "https://s3.../...",
  "s3_key": "uploads/images/a3f8b2c1-e4d5-6789.jpg"
}
```

**S3キー生成ルール:** `uploads/images/{uuid}.{拡張子}`
- UUIDはバックエンドで生成（パストラバーサル・XSS対策）
- imageable に依存しないフラットな構造（手動登録時にWorkが未作成のため）

### POST /api/v1/images

メタデータ登録。S3アップロード完了後に呼ぶ。

**リクエスト:**
```json
{
  "image": {
    "s3_key": "uploads/works/1/a3f8b2c1-e4d5-6789.jpg",
    "file_name": "cover.jpg",
    "content_type": "image/jpeg",
    "file_size": 1200000,
    "imageable_type": "Work",
    "imageable_id": 1
  }
}
```

**レスポンス (201):**
```json
{
  "image": {
    "id": 1,
    "s3_key": "uploads/works/1/a3f8b2c1-e4d5-6789.jpg",
    "file_name": "cover.jpg",
    "content_type": "image/jpeg",
    "file_size": 1200000,
    "imageable_type": "Work",
    "imageable_id": 1,
    "created_at": "2026-03-28T12:00:00Z"
  }
}
```

**エラー時:** メタデータ登録失敗 → S3のファイルを削除（即時ロールバック）

### DELETE /api/v1/images/:id

DB削除 → S3削除の順。

**所有者チェック:** imageable 経由で、操作ユーザーが所有者かを確認。

**レスポンス (204):** No Content

**S3削除失敗時:** DBは削除済み。ユーザーに影響なし。定期バッチで掃除。

## 4. フロントエンド設計

### 4.1 コンポーネント構成

```
ManualWorkForm（既存を拡張）
├── タイトル入力（既存）
├── ジャンル選択（既存）
├── ImageUploader（新規・共通コンポーネント）
│   ├── ドラッグ&ドロップエリア
│   ├── 画像プレビュー（100x140px）
│   └── プログレスバー
├── 説明入力（既存）
└── 登録ボタン（既存）
```

ImageUploader は独立した共通コンポーネント。ManualWorkForm と作品詳細画面の両方で再利用する。

### 4.2 ImageUploader ステート管理

| ステート | UI表示 |
|---------|--------|
| `idle` | ドロップゾーン（点線枠、D&D対応）+ プレビュー枠（NO IMAGE） |
| `uploading` | 画像プレビュー + プログレスバー（%表示） |
| `done` | 画像プレビュー + 「アップロード完了」 + 「画像を削除」リンク |
| `error` | エラーメッセージ + リトライ可能なドロップゾーン |

### 4.3 アップロードフロー（3ステップ）

**手動登録時（Workが未作成）:**
```
① POST /api/v1/images/presign → 署名付きURLとs3_keyを取得
② XHR PUT → 署名付きURLでS3に直接アップロード（プログレスバー表示）
  ── ユーザーがフォームを埋めて「登録する」をクリック ──
③ POST /api/v1/works → Workを作成し、work_idを取得
④ POST /api/v1/images → メタデータをDBに登録（work_idを使用）
```

**既存作品のカバー画像変更時:**
```
① POST /api/v1/images/presign → 署名付きURLとs3_keyを取得
② XHR PUT → 署名付きURLでS3に直接アップロード
③ POST /api/v1/images → メタデータをDBに登録（既存work_idを使用）
④ DELETE /api/v1/images/:old_id → 旧画像を削除
```

- async/await で順番に実行
- ステップ②はXHRを使用（fetchにはアップロード進捗取得機能がないため）
- XHR の `upload.onprogress` イベントでプログレスバーを更新

### 4.4 バリデーション（フロントエンド）

ファイル選択時（changeイベント）に即座にチェック:
- ファイル形式: JPEG, PNG, GIF, WebP のみ（`file.type` で判定）
- ファイルサイズ: 10MB以下（`file.size` で判定）
- エラー時はドロップゾーン内にメッセージ表示

### 4.5 作品詳細画面でのカバー画像変更

- カバー画像の上にホバーで「画像を変更」オーバーレイを表示
- クリックで ImageUploader を表示
- 新画像アップロード成功後、旧画像を DELETE API で削除

## 5. バックエンド設計

### 5.1 コントローラー

```
Api::V1::ImagesController
├── presign  — 署名付きURL発行
├── create   — メタデータ登録（失敗時S3ロールバック）
└── destroy  — DB削除 → S3削除
```

### 5.2 サービスオブジェクト

```
S3PresignService
├── .call(s3_key, content_type) → 署名付きURLを返す

S3DeleteService
├── .call(s3_key) → S3からファイルを削除
```

### 5.3 定期バッチ

```
OrphanedImageCleanupJob
├── S3バケットのファイル一覧を取得
├── DBの s3_key と突き合わせ
└── DBに記録がないS3ファイルを削除
```

Solid Queue で1日1回実行。

### 5.4 gem追加

```ruby
gem 'aws-sdk-s3'
```

## 6. インフラ・セキュリティ

### 6.1 S3バケット

| 環境 | バケット名 | 設定 |
|------|-----------|------|
| 開発 | `recolly-dev-images` | プライベート |
| 本番 | `recolly-prod-images` | プライベート |

### 6.2 CORS設定（S3バケット側）

```json
{
  "AllowedOrigins": ["http://localhost:5173", "https://本番ドメイン"],
  "AllowedMethods": ["PUT"],
  "AllowedHeaders": ["Content-Type"],
  "MaxAgeSeconds": 3600
}
```

### 6.3 署名付きURL有効期限

| 用途 | 操作 | 有効期限 |
|------|------|---------|
| アップロード | PUT | 5分 |
| 閲覧 | GET | 15分 |

### 6.4 環境変数

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION              — ap-northeast-1
S3_BUCKET_NAME          — 環境ごとに切り替え
```

### 6.5 セキュリティ対策

| 脅威 | 対策 |
|------|------|
| パストラバーサル | S3キーにUUID使用。ユーザーのファイル名を使わない |
| XSS（ファイル名経由） | 元ファイル名は表示用のみ。S3キーには使わない |
| 不正アクセス | 全エンドポイントに認証必須。所有者チェック |
| S3バケット公開 | プライベート設定。署名付きURLでのみアクセス |
| 署名付きURL漏洩 | 有効期限5分で失効 |
| AWSキー漏洩 | 環境変数管理。フロントエンドに持たせない |

## 7. テスト戦略

### 7.1 バックエンド（RSpec）

**Request Spec:**
- POST /api/v1/images/presign — 正常系（200）、不正content_type（422）、サイズ超過（422）、未認証（401）
- POST /api/v1/images — 正常系（201）、不正s3_key（422）、未認証（401）
- DELETE /api/v1/images/:id — 正常系（204）、他人の画像（403）、未認証（401）

**Model Spec:**
- Image モデルのバリデーション

**Service Spec:**
- S3PresignService — AWS SDKモックで署名付きURL生成テスト
- S3DeleteService — AWS SDKモックで削除テスト

**Job Spec:**
- OrphanedImageCleanupJob — 孤立ファイル削除テスト

### 7.2 フロントエンド（Vitest + React Testing Library）

**ImageUploader:**
- ドロップゾーン表示、ファイル選択でプレビュー表示
- 不正ファイル形式・サイズ超過でエラー表示
- アップロード中にプログレスバー表示
- 完了後に「画像を削除」リンク表示
- 削除クリックでidleに戻る

**ManualWorkForm:**
- 画像付きで登録できる
- 画像なしでも登録できる（任意）

### 7.3 S3テスト方針

テストではS3に実際にアクセスしない。AWS SDKの呼び出しをモック（stub）して、正しい引数で呼ばれたかを検証する。

## 8. UIデザイン

Recollyのデザインシステム（tokens.css）に準拠。

- 角丸なし（border-radius: 0）
- 2px実線ボーダー
- 背景色: `--color-bg`（#fafaf8）
- テキスト: `--color-text`（#2c2c2c）
- プレビュー枠: 100x140px
- ドロップゾーン: 点線ボーダー、プレビューと同じ高さ（140px）
- プログレスバー: 高さ6px、`--color-text`で塗りつぶし

モックアップ: `.superpowers/brainstorm/31893-1774689381/content/upload-ui-recolly.html`
