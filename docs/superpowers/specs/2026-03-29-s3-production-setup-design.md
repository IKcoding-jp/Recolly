# 本番環境S3画像アップロード対応 設計書

## 概要

本番環境で画像アップロード機能が動作しない問題を修正する。
原因: アプリコードは完成しているが、本番AWS環境にS3関連のインフラが未構築。

## 根本原因

PR #68 で画像アップロード機能を実装したが、以下の本番インフラが未設定:

1. 画像保存用S3バケットが未作成
2. S3のCORS設定が未設定（ブラウザからの直接アップロードに必要）
3. EC2ロールにS3操作権限が未付与
4. SSM Parameter Storeに環境変数が未登録
5. デプロイスクリプトが環境変数を渡していない

## 設計方針

- **認証方式:** アクセスキー方式（既存の `aws.rb` 実装をそのまま使用）
- **インフラ管理:** Terraform（既存パターンに合わせる）
- **アプリコード変更:** なし

## 変更対象ファイル

### 1. `infra/s3.tf` — 画像用S3バケット追加

**バケット名:** `recolly-images-ap-northeast-1`

設定内容:
- パブリックアクセス完全ブロック（署名付きURLでのみアクセス）
- CORS設定: CloudFrontドメインからの PUT / GET を許可
  - 署名付きURLでブラウザからS3に直接アップロードするため必要
  - 参考: `docs/画像アップロード処理_詳細設計書.md` セクション7.2

フロントエンド用バケットとの違い:
- CloudFront配信不要（署名付きURL方式のため）
- CORS設定が必要（ブラウザ→S3直接通信のため）

### 2. `infra/iam.tf` — EC2ロールにS3権限追加

`recolly-ec2-role` に以下の権限を追加:

| 操作 | 用途 |
|------|------|
| `s3:PutObject` | 署名付きURL発行（アップロード） |
| `s3:GetObject` | 署名付きURL発行（閲覧） |
| `s3:DeleteObject` | 画像削除 |

対象リソースは画像バケットのみに限定（最小権限の原則）。

### 3. `infra/ssm.tf` — 環境変数4つ追加

| パラメータ名 | 型 | 値 |
|------------|------|-----|
| `AWS_ACCESS_KEY_ID` | SecureString | placeholder（後で手動設定） |
| `AWS_SECRET_ACCESS_KEY` | SecureString | placeholder（後で手動設定） |
| `AWS_REGION` | String | `ap-northeast-1` |
| `S3_BUCKET_NAME` | String | Terraformで自動設定（バケット名を参照） |

### 4. `infra/scripts/deploy.sh` — 環境変数の取得・受け渡し

既存パターンと同じ方法で:
- `get_param` で4つの環境変数をSSMから取得
- `docker run` の `-e` オプションでコンテナに渡す

## デプロイ手順

1. `terraform apply` でインフラ変更を反映（バケット作成、IAM権限、SSMパラメータ）
2. AWS CLIで `AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY` の実際の値をSSMに設定
3. 再デプロイ（Docker コンテナ再起動で環境変数が反映される）

## テスト計画

- デプロイ後、本番環境で手動登録から画像アップロードを実行
- 画像が表示されることを確認
- 画像の削除が動作することを確認
