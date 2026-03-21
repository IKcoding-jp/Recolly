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

**SDD（仕様駆動開発）+ TDD（テスト駆動開発）**

1. 仕様書を `docs/` に作成
2. テストを書く（この時点ではテストは失敗する）
3. テストが通る最小限の実装を書く
4. リファクタリング

## コードレビュー

<!-- AI（ローカルのClaude Code）が書いたコードをAI（GitHub上のClaude Code Actions）がレビューする。
     同じモデルでも、実装コンテキストを持たない別セッションが差分だけを読むことで、
     確証バイアスのない客観的なレビューが可能になる。 -->

### フロー

1. ローカルで実装 + テスト + コミット
2. `git push` + PR作成
3. **Claude Code Review が自動でPRをレビュー**（GitHub Actions）
4. 指摘事項を解消（PR上で `@claude` メンションによる修正も可）
5. CI全パス + レビュー指摘解消 → マージ

### ルール

- 全PRにClaude Code Reviewを必須とする（CI経由で自動実行）
- レビュー指摘を全て解消してからマージする
- `@claude` でPR上から直接修正を依頼できる

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

## コーディング規約

### 共通

- 1ファイル200行以内を目安。超える場合は分割を検討
- コメントは「なぜそうしているか」を書く（何をしているかではない）
- 未使用のimport・変数・関数を残さない
- マジックナンバー禁止。定数として定義する
- APIキー・シークレットは環境変数で管理。ハードコード禁止
- コメント・コミットメッセージは日本語

### Ruby / Rails

- RuboCopの全ルールに準拠
- APIエンドポイントは `/api/v1/` プレフィックスを使用
- コントローラーはthin controller原則（ロジックはモデルまたはサービスオブジェクトに）
- N+1クエリ対策: `includes` / `eager_load` を必ず考慮
- Strong Parameters を必ず使用
- 全APIエンドポイントに認証チェック必須（ヘルスチェックを除く）

### TypeScript / React

- ESLint + Prettierの全ルールに準拠
- `any` 型の使用禁止
- コンポーネントは関数コンポーネント + hooks パターン
- 外部APIのレスポンスは必ず型定義・バリデーションする
- デザイントークン（色・フォントサイズ等）はCSS変数のみ使用。ハードコード禁止
- 新規ページ作成時は必ず既存の共通コンポーネントを使用。新規スタイル直書き禁止

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
