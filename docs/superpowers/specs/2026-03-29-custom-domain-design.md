# 独自ドメイン設定 仕様書

## 概要

Recollyの本番環境URLを、CloudFrontのデフォルトドメイン（`d1libv2nochxfe.cloudfront.net`）から独自ドメイン（`recolly.net`）に変更する。

### 目的

- ポートフォリオとして面接で「自分のサービスです」と示せるURLにする
- 実サービスとしてユーザーに覚えてもらいやすいURLにする

### 対象ドメイン

- メイン: `recolly.net`
- リダイレクト: `www.recolly.net` → `recolly.net`（301リダイレクト）

## アーキテクチャ

### 現在の構成

```
ユーザー
  ↓ https://d1libv2nochxfe.cloudfront.net
CloudFront（デフォルトSSL証明書）
  ├── /* → S3（React SPA）
  └── /api/* → EC2（Rails API）
```

### 変更後の構成

```
ユーザー
  ↓ https://recolly.net
  ↓ (www.recolly.net → 301リダイレクト)
Route 53 DNS
  ↓ Aレコード（Alias）
CloudFront（ACMカスタムSSL証明書）
  ├── /* → S3（React SPA）
  └── /api/* → EC2（Rails API）
```

- ルーティング構成（パスベース）は変更なし
- CloudFrontに独自ドメインとSSL証明書を追加するのみ

## AWSリソース

### 1. ドメイン購入（手動）

- **購入先**: Route 53
- **ドメイン**: `recolly.net`
- **費用**: 年間 $17
- **自動更新**: 有効にする
- **購入時に自動作成されるもの**: ホストゾーン

### 2. ACM SSL証明書（Terraform新規）

- **リージョン**: us-east-1（バージニア北部）— CloudFront用の証明書はus-east-1に作成する必要がある（AWSの制約）
- **ドメイン名**: `recolly.net`
- **SAN（Subject Alternative Name）**: `www.recolly.net`
- **検証方式**: DNS検証（Route 53に検証用レコードを自動作成）
- **費用**: 無料

### 3. Route 53 DNSレコード（Terraform新規）

| レコード名 | タイプ | 値 | 用途 |
|---|---|---|---|
| `recolly.net` | A（Alias） | CloudFrontディストリビューション | メインサイト |
| `www.recolly.net` | CNAME | `recolly.net` | wwwリダイレクト |
| ACM検証レコード | CNAME | ACMが指定する値 | SSL証明書の所有確認 |

### 4. CloudFront変更（Terraform既存リソース修正）

- `aliases` に `["recolly.net", "www.recolly.net"]` を追加
- `viewer_certificate` をACM証明書に変更（デフォルト証明書 → カスタム証明書）
- `minimum_protocol_version`: `TLSv1.2_2021`

### 5. S3 CORS変更（Terraform既存リソース修正）

- 画像アップロード用バケット（`recolly-images-ap-northeast-1`）のCORS許可オリジンを変更
- `https://d1libv2nochxfe.cloudfront.net` → `https://recolly.net`

## Terraformファイル構成

### 新規ファイル

| ファイル | 内容 |
|---|---|
| `infra/route53.tf` | ホストゾーン参照（data source）+ DNSレコード |
| `infra/acm.tf` | us-east-1用プロバイダー + SSL証明書 + DNS検証 |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `infra/main.tf` | us-east-1用の `aws.us_east_1` プロバイダー追加 |
| `infra/cloudfront.tf` | `aliases` + `viewer_certificate` 追加 |
| `infra/s3.tf` | 画像バケットCORSオリジン変更 |
| `infra/ssm.tf` | `FRONTEND_URL` パラメータ値を `https://recolly.net` に変更 |

## アプリ設定の更新

### 環境変数（SSM Parameter Store）

| パラメータ | 変更前 | 変更後 |
|---|---|---|
| `/recolly/production/FRONTEND_URL` | `https://d1libv2nochxfe.cloudfront.net` | `https://recolly.net` |

### Rails設定

- `backend/config/environments/production.rb`
  - `config.action_mailer.default_url_options` を `{ host: 'recolly.net' }` に変更

### 手動設定（Terraform外）

| 作業 | 場所 | 内容 |
|---|---|---|
| ドメイン購入 | AWSコンソール > Route 53 | `recolly.net` を購入、自動更新有効化 |
| OAuthコールバックURL | Google Cloud Console | `https://recolly.net/api/v1/auth/google_oauth2/callback` に変更 |
| デプロイスクリプト反映 | EC2 SSH | `deploy.sh` の環境変数が新ドメインを使うようにする |

## 変更不要なもの

- **フロントエンドのAPIコール**: 相対URL（`/api/v1`）使用のため変更不要
- **セッションCookie**: `secure: true` + `same_site: :lax` はそのまま動作
- **CloudFrontルーティング**: パスベースルーティング（`/api/*` → EC2、`/*` → S3）は変更なし
- **EC2セキュリティグループ**: CloudFrontマネージドプレフィックスリストによるフィルタリングは変更なし

## コスト

| 項目 | 費用 |
|---|---|
| ドメイン（`recolly.net`） | 年間 $17（約2,500円） |
| Route 53 ホストゾーン | 月額 $0.50（約75円） |
| ACM SSL証明書 | 無料 |
| CloudFront | 追加費用なし |
| **合計** | **年間約 $23（約3,500円）** |

## 注意事項

- DNS浸透に最大48時間かかる場合がある（その間は旧URLと新URLが混在する可能性）
- 旧CloudFrontドメインは当面アクセス可能（急に使えなくなることはない）
- ドメイン自動更新を有効にして失効を防ぐ
- ACM証明書はus-east-1に作成する必要がある（CloudFrontの制約）

## wwwリダイレクトの実装方式

CloudFrontの CloudFront Functions を使用して、`www.recolly.net` へのアクセスを `recolly.net` に301リダイレクトする。

```javascript
// viewer-request で実行
function handler(event) {
  var request = event.request;
  var host = request.headers.host.value;
  if (host.startsWith('www.')) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: { value: 'https://recolly.net' + request.uri }
      }
    };
  }
  return request;
}
```
