# Recolly AWSインフラ復元（転職ポートフォリオ用最小構成）設計

## 背景

Recollyは2026-04-17に「収益化しない・自分用ツール兼転職ポートフォリオ」へ方針転換済み（[[recolly_project_monetization_pivot]]）。
その後、AWSリソースは実質的に畳まれ、現状は以下の状態だった（2026-07-01時点でAWS CLIにて確認）。

- **削除済み**: EC2、RDS、CloudFront、ECR、ACM証明書
- **残存**: Route 53ホストゾーン（`recolly.net`）、S3バケット2つ（`recolly-dev-images`, `recolly-terraform-state`）
- `infra/rds.tf` に未コミットの変更あり（`deletion_protection=false`, `skip_final_snapshot=true`）— 削除作業の途中の名残

AWS Billing Consoleで確認した結果、**クレジット残高 $88.33（有効期限 2027-03-22）** が生きていることが判明。
内訳：
- AWS Free Tier: $100発行 / $71.67使用済み / 残$28.33
- Explore AWSクエスト系クレジット×3（各$20・未使用）: $60
  - うち1つは「AWS Budgetsで予算アラートを設定する」ことで解放される

過去の消費ペース（2026-03〜06の実費・クレジット消費実績）から、無対策で運用を続けると数ヶ月でクレジットが枯渇し、実費（月$20〜40程度）が発生し得ることも確認済み。

## 目的

面接官・採用担当が常時 `recolly.net` にアクセスして動作を確認できる状態を、追加コスト（クレジット期限内は実質$0）で復元する。

## スコープ

### 対象

1. **既存Terraformコード（`infra/`）を用いた `terraform apply` によるインフラ再構築**
   - EC2 t2.micro（Rails API、Docker）
   - RDS db.t3.micro（PostgreSQL 16、シングルAZ）
   - S3 + CloudFront（フロントエンド配信）
   - ECR（バックエンドイメージ）
   - Route 53（既存ホストゾーンをそのまま使用）
   - ACM証明書（us-east-1、再発行）
2. **RDS削除保護設定の確定**: `deletion_protection=false` / `skip_final_snapshot=true` を意図的な設定として採用（現在の未コミット変更のまま）。理由：本番データではなくポートフォリオ用途のため、誤操作時の復旧よりも畳みやすさを優先する
3. **AWS Budgetsによる月額コストアラートの新規設定**
   - クレジット枯渇の早期検知が目的
   - 設定により $20 クレジットが追加で解放される
4. **GitHub Actions（`cd.yml`）のSecrets更新**
   - EC2再作成に伴うSSHホスト鍵・IPアドレス等、CDワークフローが参照する値の見直しが必要な場合は更新する

### 対象外

- 新機能追加・UIデザイン変更
- 収益化・ユーザー獲得施策（[[recolly_project_monetization_pivot]] の方針を継続）
- AWS以外のホスティング（Vercel/Render等）への移行 — 検討したが、クレジット残高が十分にあることが判明したため見送り

## リスクと対応

| リスク | 対応 |
|---|---|
| クレジット枯渇後の実費発生（月$20〜40程度と推定） | AWS Budgetsアラートで残高を可視化し、枯渇が近づいたら縮小判断（EC2停止・RDS縮小等）を行う |
| `terraform apply` 時にstate不整合（手動削除分との差異） | `terraform plan` で差分を確認してから `apply` する |
| CD再開時にデプロイスクリプトが古いままの問題（[[recolly_project_deploy_script]]） | EC2再構築後、`infra/scripts/deploy.sh` の同期を手動で確認する |

## 成功基準

- `https://recolly.net` に常時アクセス可能（フロントエンド・API双方が正常応答）
- AWS Budgetsアラートが設定され、通知先が設定されている
- 追加の月額実費が発生していない（クレジットで完全に相殺されている状態）
