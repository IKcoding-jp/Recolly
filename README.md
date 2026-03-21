# Recolly

物語性のあるメディア（アニメ、映画、ドラマ、本、漫画、ゲーム）をジャンル横断で記録・分析・共有するWebアプリケーション。

## 特徴

- **オールインワン管理** — 全ジャンルを1つのアプリで記録。既存サービスのようなジャンル分断がない
- **記録・進捗管理** — ステータス、★評価、話数進捗、話数ごとの感想
- **コミュニティ** — 作品・話数ごとのディスカッション掲示板
- **おすすめ** — 記録データに基づくクロスメディアレコメンド

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| バックエンド | Ruby 3.3 / Rails 8（APIモード） |
| フロントエンド | React 19 / TypeScript / Vite |
| データベース | PostgreSQL 16 |
| テスト | RSpec / Vitest + React Testing Library |
| リンター | RuboCop / ESLint + Prettier |
| インフラ | Docker Compose（開発）/ AWS（本番） |
| CI/CD | GitHub Actions |
| コードレビュー | Claude Code Actions |

## セットアップ

### 前提条件

- [Docker Desktop](https://docs.docker.com/desktop/)

### 起動

```bash
# 全サービス起動（PostgreSQL + Rails API + React）
docker compose up

# バックエンドのみ
docker compose up backend
```

- Rails API: http://localhost:3000
- React: http://localhost:5173
- ヘルスチェック: http://localhost:3000/api/v1/health

### テスト

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec
docker compose run --rm frontend npm test
```

### Lint

```bash
docker compose run --rm backend bundle exec rubocop
docker compose run --rm frontend npm run lint
```

### DB操作

```bash
docker compose run --rm backend bin/rails db:create
docker compose run --rm backend bin/rails db:migrate
docker compose run --rm backend bin/rails db:seed
```

## ディレクトリ構成

```
recolly/
├── backend/          Rails API
├── frontend/         React + TypeScript
├── infra/            AWS設定
├── docs/             仕様書・設計ドキュメント
├── .github/          GitHub Actions（CI + Claude Code Review）
├── CLAUDE.md         プロジェクトルール
├── lefthook.yml      Git hooks設定
└── docker-compose.yml
```

## 開発フロー

1. `git checkout -b feature/xxx` でブランチ作成
2. 実装 + テスト + コミット
3. `git push` + `gh pr create` でPR作成
4. CI（lint + test + security）+ Claude Code Review が自動実行
5. レビュー指摘を解消 → マージ

## ドキュメント

- [プロダクト設計仕様書](docs/superpowers/specs/2026-03-20-recolly-design.md)
- [プロジェクトルール](CLAUDE.md)
