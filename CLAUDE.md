# Recolly — プロジェクトルール

## 概要

Recollyは物語性のあるメディア（アニメ、映画、ドラマ、本、漫画、ゲーム）をジャンル横断で記録・分析・共有するWebアプリケーション。

仕様書: `docs/superpowers/specs/2026-03-20-recolly-design.md`

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| バックエンド | Ruby 3.3 / Rails 8（APIモード） |
| フロントエンド | React 19 / TypeScript / Vite |
| データベース | PostgreSQL 16 |
| テスト（BE） | RSpec |
| テスト（FE） | Vitest + React Testing Library |
| リンター（BE） | RuboCop |
| リンター（FE） | ESLint + Prettier |
| インフラ | Docker Compose（開発）/ AWS（本番） |

## ディレクトリ構成

```
recolly/
├── backend/        ← Rails API
├── frontend/       ← React + TypeScript
├── infra/          ← AWS設定
├── docs/           ← 仕様書・設計ドキュメント
├── CLAUDE.md       ← このファイル
└── docker-compose.yml
```

## 開発手法

**SDD（仕様駆動開発）+ TDD（テスト駆動開発）+ Issue駆動開発**
**superpowersスキルを主軸とする。**

### ワークフロー

1. `superpowers:brainstorming`（要件深掘り + スペック作成）
2. GitHub Issue作成（`issue-creator`スキルでスペックからIssue起票）
3. `superpowers:writing-plans`（実装プラン作成）
4. `superpowers:subagent-driven-development`（各タスク内で `superpowers:test-driven-development` を使用）
5. 動作確認（手動 or Playwright MCP自動確認をユーザーに選択させる）
6. `superpowers:finishing-a-development-branch` → ブランチ作成 → PR作成 → Claude Code Review → マージ

※ ステップ5はUI変更またはAPI動作に影響するタスクのみ必須。ドキュメントのみ・設定変更のみの場合はスキップ可。

### 軽量パス

軽微な修正（typo、コメント修正、ドキュメント更新等）はステップ1〜3を省略し、ステップ4〜6のみで可。

### 自動発動ルール

以下のスキルはワークフローのどの段階でも、条件を満たしたら自動で発動する：

| スキル | 発動条件 |
|--------|---------|
| `comprehension-guard` | 技術選定・設計判断が発生したとき |
| `adr` | comprehension-guardでユーザーが判断を確定したとき。「ADRを書きますか？」と聞かず自動作成する |
| `learning-note` | ユーザーが質問してプロジェクトで初めて使う技術・パターン・ライブラリについて説明したとき。説明後に学習ノートを作成する |

### 禁止事項

- mainへの直接プッシュ禁止。ドキュメントのみの変更でも必ずブランチを切ってPR経由でマージする
- 動作確認対象のタスクで動作確認を省略しない

### `/clear`後のコンテキスト復元

以下を順に読むことでコンテキストを復元する：

1. `CLAUDE.md`（プロジェクトルール）
2. `docs/TODO.md`（全体進捗）
3. 該当タスクの spec（`docs/superpowers/specs/`）+ plan（`docs/superpowers/plans/`）
4. `git log`（直近の作業内容）

### ドキュメント管理

- ドキュメントは `docs/superpowers/` に一元管理（specs/, plans/）

## コードレビュー

<!-- AI（ローカルのClaude Code）が書いたコードをAI（GitHub上のClaude Code Actions）がレビューする。
     同じモデルでも、実装コンテキストを持たない別セッションが差分だけを読むことで、
     確証バイアスのない客観的なレビューが可能になる。 -->

### フロー

1. ローカルで実装 + テスト + コミット
2. `git push` + PR作成
3. **Claude Code Review が自動でPRをレビュー**（GitHub Actions）
4. 指摘事項を解消（ローカルのClaude Codeで修正）
5. CI全パス + レビュー指摘解消 → マージ

### ルール

- 全PRにClaude Code Reviewを必須とする（CI経由で自動実行）
- レビュー指摘を全て解消してからマージする
- レビュー指摘の修正はローカルのClaude Codeで行い、再pushする

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

- ワークフロー: `.github/workflows/claude-review.yml`
- レビュー設定の変更は上記ファイルの `prompt` パラメータを編集する

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

- PRの性質に応じてマージ方法を使い分ける
  - 機能追加・ADR付きの大きめPR → Merge commit（開発プロセスの履歴を残す）
  - バグ修正・リファクタ・ドキュメント修正など小さいPR → Squash and merge（履歴をきれいに保つ）
- Rebase and mergeは使用しない
- mainへの直接プッシュは禁止。必ずPRを経由する

## PRルール

- PRタイトルはConventional Commits形式（例: feat: ○○, fix: ○○, docs: ○○）
- Squash時のコミットメッセージはPRタイトルをそのまま使う
- 1PRの変更は原則1つの関心事に絞る

## コーディング規約

### 共通

- 1ファイル200行以内を目安。超える場合は分割を検討
- コメントは「なぜそうしているか」を書く（何をしているかではない）
- 未使用のimport・変数・関数を残さない
- マジックナンバー禁止。定数として定義する
- APIキー・シークレットは環境変数で管理。ハードコード禁止
- コメント・コミットメッセージは日本語
- 自動生成された設定ファイル（gem generator等）は未使用コメントを削除し、変更した設定のみ残す

### Ruby / Rails

- RuboCopの全ルールに準拠
- APIエンドポイントは `/api/v1/` プレフィックスを使用
- コントローラーはthin controller原則（ロジックはモデルまたはサービスオブジェクトに）
- N+1クエリ対策: `includes` / `eager_load` を必ず考慮
- Strong Parameters を必ず使用
- 全APIエンドポイントに認証チェック必須（ヘルスチェックを除く）
- POSTで新規リソースを作成するAPIは `201 Created` を返す（200ではなく）
- 同一メソッドを複数コントローラーに定義しない。共通メソッドは `ApplicationController` または concern に定義

### TypeScript / React

- ESLint + Prettierの全ルールに準拠
- `any` 型の使用禁止
- コンポーネントは関数コンポーネント + hooks パターン
- 外部APIのレスポンスは必ず型定義・バリデーションする
- デザイントークン（色・フォントサイズ等）はCSS変数のみ使用。ハードコード禁止
- 新規ページ作成時は必ず既存の共通コンポーネントを使用。新規スタイル直書き禁止
- async関数を `onClick` に直接渡さない。`() => void fn()` でラップするか try/catch で囲む
- try/catch では `finally` ブロックの使用を検討する（状態クリア等の「必ず実行すべき処理」がある場合）
- フォーム送信前にクライアントサイドで事前チェック可能なバリデーション（パスワード一致等）を実施する

## テスト

- 全機能にテスト必須
- バックエンド: RSpec（request spec 中心）
- フロントエンド: Vitest + React Testing Library
- テストファイルは対象ファイルと同じディレクトリ構造で配置

## セキュリティ

- パスワードのハッシュ化（bcrypt）
- CSRF対策
- SQLインジェクション対策（Railsのパラメータバインディング）
- XSS対策（Reactのエスケープ + 追加対策）
- 入力バリデーションをコントローラーレベルで必ず実施
- 依存パッケージの脆弱性チェック（bundle audit / npm audit）

## Docker コマンド

```bash
# 全サービス起動
docker compose up

# バックエンドのみ
docker compose up backend

# テスト実行
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec
docker compose run --rm frontend npm test

# lint実行
docker compose run --rm backend bundle exec rubocop
docker compose run --rm frontend npm run lint

# DB操作
docker compose run --rm backend bin/rails db:create
docker compose run --rm backend bin/rails db:migrate
docker compose run --rm backend bin/rails db:seed
```

## 理解負債防止

- 技術選定・設計判断では `.claude/skills/comprehension-guard` スキルに従い、必ずユーザーの承認を得てから実装に進む
- 説明はプログラミング初学者を前提とする。専門用語は初出時に平易な説明を添える
- 設計判断は `docs/adr/` にADR（Architecture Decision Record）として記録する
- 新技術の学習は `docs/learning/` にノートとして蓄積する

### PR前セルフチェック（superpowers:finishing-a-development-branchで実施）

- 同一メソッド/関数が複数ファイルに重複していないか（DRY）
- 全ファイルが200行以内か
- CSS/スタイルにハードコード値がないか
- POSTで新規作成するエンドポイントは201を返しているか
- 設定ファイルに未使用コメント/dead codeがないか
- async関数をonClickに直接渡していないか
- 設計判断のADR・学習ノートに記録漏れがないか
