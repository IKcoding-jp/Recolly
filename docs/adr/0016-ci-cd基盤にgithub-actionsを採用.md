# ADR-0016: CI/CD基盤にGitHub Actionsを採用

## ステータス
承認済み

## 背景
Recollyの開発では、コード変更時のテスト・リント・セキュリティスキャン・デプロイを自動化する必要がある。手動デプロイは人為的ミスやテスト忘れのリスクがあり、個人プロジェクトでも自動化は必須。RecollyのリポジトリはGitHubでホストしている。

## 選択肢

### A案: GitHub Actions（採用）
- **これは何か:** GitHubが提供するCI/CDサービス。リポジトリ内にYAMLファイル（`.github/workflows/*.yml`）を置くだけで、PR作成時やマージ時に自動でテスト・デプロイが実行される
- **長所:** GitHubと完全統合で追加の連携設定が不要。無料枠が充実（2,000分/月）。OIDC認証でAWS連携が安全（アクセスキー不要）。Claude Code公式アクションが対応。YAMLベースで設定がバージョン管理できる
- **短所:** GitHub以外のリポジトリでは使えない。複雑なパイプラインはYAMLが読みにくくなる

### B案: CircleCI
- **これは何か:** 老舗のCI/CDサービス。GitHub等と連携して使う外部サービス
- **長所:** 並列実行が得意。Docker層キャッシュが優秀。設定の柔軟性が高い
- **短所:** 外部サービスなので別途アカウント・連携設定が必要。無料枠が少ない（約250分/月）。Claude Code公式対応なし

### C案: AWS CodePipeline
- **これは何か:** AWSが提供するCI/CDサービス。AWSリソースとネイティブ連携する
- **長所:** AWSリソースとの統合が強い。IAMロールで認証がシンプル
- **短所:** GitHub連携に追加設定が必要。UIが複雑。学習コストが高い。個人プロジェクトには大仰

### D案: 手動デプロイ（CI/CDなし）
- **これは何か:** SSHでサーバーに入り、手動でコマンドを実行してデプロイする方法
- **長所:** 設定不要。すぐ始められる
- **短所:** 人為的ミスのリスク。テスト忘れ。デプロイ手順の属人化

## 決定
A案（GitHub Actions）を採用。以下の4つのワークフローを構成:

- **CI** (`ci.yml`): PR時にRuboCop、RSpec、ESLint、Prettier、Vitest、Brakeman、bundler-audit、npm auditを実行
- **CD** (`cd.yml`): mainマージ時にフロントエンド（S3+CloudFront）とバックエンド（ECR→EC2）を自動デプロイ
- **Claude Code Review** (`claude-code-review.yml`): PR時にバグ・セキュリティ・N+1・設計違反を自動レビュー（後から追加）
- **Claude Code Action** (`claude.yml`): `@claude`メンションでIssue/PR上からClaudeに作業を依頼（後から追加）

## 理由
- **GitHubリポジトリを使っており、GitHub Actionsに慣れていた。** 外部サービスとの連携設定やアカウント管理が不要で、最も導入コストが低い
- 無料枠（2,000分/月）が個人プロジェクトに十分
- OIDC認証でAWSアクセスキーをGitHubに保存しなくて済むため、セキュリティ面で優れている
- Claude Code Review / Actionは後から追加したが、Anthropic公式がGitHub Actions用アクションを提供しているため、スムーズに統合できた
- CircleCIやCodePipelineは外部サービスの管理が増えるだけで、Recollyの規模では追加の恩恵がない

## 影響
- CI/CDの設定はYAMLファイルとしてリポジトリに含まれるため、設定変更もPRレビューの対象になる
- GitHub Actionsに依存するため、将来GitHubから移行する場合はCI/CDも再構築が必要
- AWSとの連携はOIDC認証に依存しており、IAMロール設定（`infra/iam.tf`）と連動している
