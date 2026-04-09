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

### 初回レビュー（自動）

PR を open すると、`.github/workflows/claude-code-review.yml` により Claude Code Review が自動で走る。トリガーは `pull_request: opened / ready_for_review / reopened` イベントのみ。

### 再レビュー（手動、@claude メンションで発動）

**subsequent push では自動レビューは走らない**。これは設計上の意図：

- 再レビューのいたちごっこ（ping-pong）を防ぐ
- 些細な修正まで毎回レビューすると API コストと待ち時間が無駄
- 「人間が見てほしいと判断したタイミング」で走らせる方がノイズが少ない

再レビューが必要になったら、PR のコメント欄に `@claude` メンションして依頼する。これで `.github/workflows/claude.yml` が発動し、コメントの指示内容に従って Claude がアクションする。

#### 再レビュー依頼コメントの例

**一般的な再レビュー依頼**:

```
@claude 直近のコミットを再レビューしてください
```

**特定ファイル / 観点を限定**:

```
@claude Gemfile の変更だけ見てください。依存 gem の順序が正しいか、バージョン固定が妥当か確認してほしい
```

**指摘への返答と修正依頼**（claude.yml は修正コミットも作れる）:

```
@claude 指摘ありがとうございます。L42 の nil ガードを追加してください
```

### フロー

1. ローカルで実装 + テスト + コミット
2. `git push` + PR 作成
3. **Claude Code Review が初回レビュー**（自動、`claude-code-review.yml`）
4. 指摘事項があれば：
   - **ローカルで修正** → 追加コミット push（自動レビューは走らない）
   - **または PR コメントで @claude メンション** → Claude が修正コミット（`claude.yml`）
5. 追加コミット後に再レビューを受けたい場合のみ、PR コメントで `@claude 再レビューして` と依頼
6. CI 全パス + レビュー指摘解消 → マージ

### ルール

- 全 PR の **初回に** Claude Code Review を必須とする（CI 経由で自動実行）
- レビュー指摘を全て解消してからマージする
- **subsequent push で自動レビューは走らない**（意図的）。必要なら明示的に `@claude` で再依頼
- レビュー指摘の修正はローカルの Claude Code または PR 上で `@claude` メンションで行う

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

- 初回レビュー: `.github/workflows/claude-code-review.yml`（`pull_request: opened / ready_for_review / reopened`）
- オンデマンドレビュー: `.github/workflows/claude.yml`（`@claude` メンションで発動）

## PR前セルフチェック

PR作成前に [references/pr-self-check.md](references/pr-self-check.md) のチェックリストを確認すること。
