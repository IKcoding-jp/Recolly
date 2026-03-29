# 独自ドメイン（recolly.net）設定 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recollyの本番URLを `d1libv2nochxfe.cloudfront.net` から `recolly.net` に変更する

**Architecture:** Route 53でドメイン購入後、ACM（us-east-1）でSSL証明書を発行し、CloudFrontにカスタムドメイン・証明書を紐付け、Route 53でDNSレコードを設定する。wwwリダイレクトはCloudFront Functionsで実装する。

**Tech Stack:** Terraform (AWS Provider), Route 53, ACM, CloudFront, CloudFront Functions

**Issue:** #74

---

## 前提: ドメイン購入（手動・Terraform外）— 完了済み

- [x] Route 53で `recolly.net` を購入済み（$17/年、自動更新有効）
- [ ] ホストゾーンIDを確認して `terraform.tfvars` に設定

---

### Task 1: us-east-1プロバイダーの追加 + ドメイン変数の定義 — 完了済み

- [x] main.tfにus-east-1プロバイダーを追加
- [x] variables.tfにドメイン変数を追加

### Task 2: ACM SSL証明書の作成

**Files:**
- Create: `infra/acm.tf`

### Task 3: Route 53 DNSレコードの作成

**Files:**
- Create: `infra/route53.tf`

### Task 4: wwwリダイレクト用CloudFront Functionsの作成

**Files:**
- Create: `infra/cloudfront_functions.tf`

### Task 5: CloudFrontにドメイン・証明書・wwwリダイレクトを紐付け

**Files:**
- Modify: `infra/cloudfront.tf`

### Task 6: S3 CORS・SSM・outputsの更新

**Files:**
- Modify: `infra/s3.tf`
- Modify: `infra/ssm.tf`
- Modify: `infra/outputs.tf`

### Task 7: Rails production設定の更新

**Files:**
- Modify: `backend/config/environments/production.rb:55`

### Task 8: Terraform apply + 手動設定

**Files:** なし（AWSコンソール・CLI操作）
