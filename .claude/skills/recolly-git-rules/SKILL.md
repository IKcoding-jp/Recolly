---
name: recolly-git-rules
description: RecollyプロジェクトのGit運用ルール（コミット規約、マージ戦略、PRルール、コードレビュー）。以下の場面で使うこと：(1) コミット作成時、(2) PR作成時、(3) マージ時、(4) コードレビュー対応時、(5) `superpowers:finishing-a-development-branch` の発動時。
---

# Recolly Git運用ルール

## コミットメッセージ

Conventional Commits（日本語）:

```
feat: ユーザー登録機能を追加
fix: ログイン時のバリデーションエラーを修正
chore: RuboCopの設定を更新
test: 作品検索のテストを追加
docs: API仕様書を更新
refactor: 認証ロジックを整理
```

## マージ戦略

- **全PRをMerge commitで統一する**
- Squash and merge は使用しない
- Rebase and merge は使用しない
- mainへの直接プッシュは禁止。ドキュメントのみの変更でも必ずブランチを切ってPR経由でマージする

## PRルール

- PRタイトルはConventional Commits形式（例: `feat: ○○`, `fix: ○○`, `docs: ○○`）

## コードレビュー

### フロー

1. ローカルで実装 + テスト + コミット
2. `git push` + PR作成
3. **Claude Code Review が自動でPRをレビュー**（GitHub Actions）
4. 指摘事項を解消（ローカルのClaude Code または PR上で @claude メンションで修正）
5. CI全パス + レビュー指摘解消 → マージ

### ルール

- 全PRにClaude Code Reviewを必須とする（CI経由で自動実行）
- レビュー指摘を全て解消してからマージする
- レビュー指摘の修正はローカルのClaude Code または PR上で @claude メンションで行う

### レビュー観点

| 観点 | チェック内容 |
|------|------------|
| CLAUDE.md準拠 | コーディング規約、命名規則、ファイルサイズ（200行以内）等 |
| コード品質 | DRY / YAGNI原則、ベストプラクティス |
| バグ・セキュリティ | SQLインジェクション、XSS、認証漏れ、Strong Parameters |
| パフォーマンス | N+1クエリ、不要な再レンダリング、メモリリーク |
| 保守性・可読性 | 変数名、コメント（「なぜ」の説明）、ファイル分割 |
| テスト | カバレッジ、エッジケース、TDD遵守 |
| 設計・アーキテクチャ | thin controller、コンポーネント設計、責務の分離 |

### 設定ファイル

- ワークフロー: `.github/workflows/claude-code-review.yml`

## PR前セルフチェック

PR作成前に [references/pr-self-check.md](references/pr-self-check.md) のチェックリストを確認すること。
