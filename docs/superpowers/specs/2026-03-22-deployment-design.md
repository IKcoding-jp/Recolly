# Recolly デプロイ設計仕様書

## 1. 概要

フェーズ1（MVP）完成済みのRecollyを本番環境にデプロイするためのインフラ設計。
AWS上にTerraformで構築し、GitHub Actionsで自動デプロイする。

## 2. 全体アーキテクチャ

```
ユーザーのブラウザ
  ↓ https://d1234abcd.cloudfront.net
CloudFront（CDN + リバースプロキシ）
  ├── /*      → S3（React SPA ビルド成果物）
  └── /api/*  → EC2 t2.micro（Docker → Rails API）
                  ↓
                RDS db.t3.micro（PostgreSQL 16）

インフラ管理:
  ├── Terraform（infra/ に全リソース定義）
  ├── SSM Parameter Store（環境変数・シークレット）
  ├── ECR（Dockerイメージ保管）
  └── GitHub Actions（CI + CD 自動デプロイ）
```

### 設計方針

- フロントエンド（SPA）とバックエンド（API）を完全に分離して配信
- CloudFrontをリバースプロキシとして使い、単一URLで両方を提供
- DBはRDSでAWSが管理（バックアップ、パッチ適用が自動）
- Redisは使わず、キャッシュはRailsの`memory_store`に変更（将来ElastiCacheに移行可能）
- Rails 8デフォルトのSolid Cache / Solid Queueは無効化し、`memory_store` / `:async`に変更
- 全リソースはTerraformでコード管理

## 3. AWSサービス構成

| サービス | 用途 | スペック | 無料枠 |
|---------|------|--------|--------|
| EC2 | Rails APIサーバー | t2.micro（1vCPU, 1GB RAM） | 月750時間（12ヶ月） |
| RDS | PostgreSQLデータベース | db.t3.micro | 月750時間（12ヶ月） |
| S3 | React SPAビルド成果物の保管 | — | 5GB（12ヶ月） |
| CloudFront | CDN + HTTPS + リバースプロキシ | — | 1TBデータ転送（12ヶ月） |
| ECR | Dockerイメージ保管 | — | 500MB（12ヶ月） |
| SSM Parameter Store | 環境変数・シークレット管理 | スタンダード | 無料（無期限） |
| IAM | 権限管理 | — | 無料（無期限） |

## 4. ネットワーク構成

```
VPC（10.0.0.0/16）
  │
  ├── パブリックサブネット（10.0.1.0/24）
  │     └── EC2（Rails API）
  │           ├── インターネットゲートウェイ経由でアクセス可能
  │           └── Elastic IP（固定IPアドレス）
  │
  └── プライベートサブネット × 2（RDSマルチAZ要件）
        ├── 10.0.10.0/24（AZ-a）
        └── 10.0.11.0/24（AZ-c）
              └── RDS（PostgreSQL 16）
                    └── EC2からのみアクセス可能
```

### セキュリティグループ

| 対象 | インバウンド（受信許可） | 説明 |
|------|----------------------|------|
| EC2 | TCP 80（HTTP） | CloudFrontからのみ（マネージドプレフィックスリストで制限）。CloudFrontがSSL終端するため、EC2へはHTTPで転送 |
| EC2 | TCP 22（SSH） | 管理者のIPアドレスのみ |
| RDS | TCP 5432（PostgreSQL） | EC2のセキュリティグループからのみ |

## 5. CloudFrontルーティング

CloudFrontに2つのオリジンを設定し、URLパスで振り分ける。

| パスパターン | 転送先 | 説明 |
|------------|--------|------|
| `/api/*` | EC2（Rails API） | APIリクエスト |
| `/*`（デフォルト） | S3（React SPA） | 静的ファイル配信 |

### メリット

- 同一ドメインのためCORS設定が不要
- 全通信がHTTPS（CloudFrontが自動提供）
- 将来のドメイン追加はCloudFrontに紐づけるだけ

## 6. デプロイフロー（CI/CD）

### 既存CI（変更なし）

PRに対して自動実行：lint + テスト + セキュリティスキャン

### 新規CD（GitHub Actions）

mainブランチへのマージをトリガーに、2つのジョブが並行実行。

**フロントエンド:**
1. `npm run build`（静的ファイル生成）
2. `aws s3 sync`でS3にアップロード
3. CloudFrontキャッシュクリア（invalidation）

**バックエンド:**
1. Dockerイメージをビルド
2. ECRにプッシュ
3. EC2にSSH接続
4. 新しいイメージをpull
5. DBマイグレーション実行（必要な場合）
6. コンテナ再起動（マイグレーション完了後）

### GitHub Actions → AWS認証

OIDCフェデレーションを使用。AWSアクセスキーをGitHubに保存しない。

## 7. Terraform構成

```
infra/
  ├── main.tf              ← プロバイダ設定、tfstateバックエンド
  ├── variables.tf          ← 変数定義
  ├── outputs.tf            ← 出力値（EC2のIP、CloudFrontのURL等）
  ├── vpc.tf                ← VPC、サブネット、セキュリティグループ
  ├── ec2.tf                ← EC2インスタンス
  ├── rds.tf                ← RDS（PostgreSQL）
  ├── s3.tf                 ← S3バケット
  ├── cloudfront.tf         ← CloudFrontディストリビューション
  ├── ecr.tf                ← ECR
  ├── iam.tf                ← IAMロール・ポリシー
  ├── ssm.tf                ← SSM Parameter Store
  └── terraform.tfvars      ← 変数の値（.gitignore対象）
```

### 設計方針

- リソースの種類ごとにファイルを分割
- `terraform.tfvars`は`.gitignore`に追加
- `terraform.tfstate`はS3 + DynamoDBでリモート管理
- tfstate用のS3バケットとDynamoDBテーブルはTerraform管理外（初回のみ手動 or ブートストラップスクリプトで作成）

## 8. 環境変数管理

SSM Parameter Store にキーを作成し、EC2起動時に取得する。

```
/recolly/production/
  ├── SECRET_KEY_BASE          ← Railsのセッション暗号化キー（SecureString）
  ├── DATABASE_URL             ← RDSの接続文字列（SecureString）
  ├── RAILS_ENV                ← "production"（String）
  ├── TMDB_API_KEY             ← 映画・ドラマ検索用（SecureString）
  ├── GOOGLE_BOOKS_API_KEY     ← 本検索用（SecureString）
  ├── IGDB_CLIENT_ID           ← ゲーム検索用（SecureString）
  ├── IGDB_CLIENT_SECRET       ← ゲーム検索用（SecureString）
  ├── FRONTEND_URL             ← CloudFrontのURL（String）
  └── RAILS_MASTER_KEY         ← credentials復号キー（SecureString）
```

### セキュリティ

- 秘密情報は`SecureString`型（KMSで暗号化）
- EC2はIAMロール経由でParameter Storeにアクセス（キーのハードコード不要）
- Gitリポジトリに秘密情報は一切含まない

## 9. 本番用Dockerfile

開発用Dockerfileとは別に、`backend/Dockerfile.production`を作成する。

### マルチステージビルド

本番用Dockerfileはマルチステージビルドを使用する。ネイティブ拡張を持つgem（pg, puma等）のビルドにはCコンパイラ（build-essential）が必要だが、実行時には不要。ビルドステージでgemをコンパイルし、ランタイムステージには実行に必要な最小限のライブラリのみコピーする。

| ステージ | 含むもの | 目的 |
|---------|---------|------|
| ビルドステージ | build-essential + libpq-dev + libyaml-dev | gemのコンパイル |
| ランタイムステージ | libpq-dev + libyaml-devのみ | アプリ実行（イメージサイズ削減） |

### フロントエンド

本番用Dockerfileは不要。GitHub Actionsで`npm run build`し、成果物をS3にアップロードする。

### Rails本番設定の変更

Rails 8デフォルトのSolid Cache / Solid Queueは専用DBテーブルが必要で、MVPでは過剰。以下に変更する。

```ruby
# config/environments/production.rb

# Solid Cache → memory_store（Redisを使わない）
config.cache_store = :memory_store

# Solid Queue → async（インプロセス実行、専用DBテーブル不要）
config.active_job.queue_adapter = :async
# config.solid_queue.connects_to 行を削除
```

### SPAルーティング対応

CloudFrontのカスタムエラーレスポンスで、S3の404をindex.htmlにフォールバックさせる。React Routerのクライアントサイドルーティング（`/dashboard`、`/library`等）に対応するため必須。

## 10. スコープ外

以下は今回の設計に含まない。

- 独自ドメイン取得・DNS設定（後から追加可能）
- ElastiCache / Redis（将来の拡張として）
- Auto Scaling / ロードバランサー（複数台構成）
- 詳細な監視・アラート設定（CloudWatch基本モニタリングは自動有効）
- WAF（Web Application Firewall）
- バックアップの詳細なリテンションポリシー
