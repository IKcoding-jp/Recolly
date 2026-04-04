# Recolly（レコリー）

**物語性のあるメディアを、ジャンルの壁を越えて記録する。**

アニメ、映画、ドラマ、本、漫画、ゲーム — 好きなコンテンツを1つのアプリでまとめて管理できるWebアプリケーションです。

**本番環境:** https://recolly.net

---

## なぜ作ったのか

アニメはAnilist、映画はFilmarks、本は読書メーター、ゲームはPULSE...。コンテンツを記録するサービスはジャンルごとに分断されています。

しかし「物語が好きな人」は、ジャンルを横断してコンテンツを楽しんでいます。アニメを観た後に原作漫画を読み、映画化されたらそれも観る。そういう体験を1つの場所で記録・振り返りたいという課題を解決するために、Recollyを開発しました。

## 主な機能

### ジャンル横断の作品検索

4つの外部APIと連携し、6ジャンルの作品をキーワード1つで横断検索できます。

| ジャンル | 外部API |
|---------|--------|
| 映画・ドラマ | TMDB |
| アニメ・漫画 | AniList (GraphQL) |
| 本 | Google Books |
| ゲーム | IGDB (Twitch認証) |

APIにない作品は手動登録フォームから追加可能です。

### 記録・進捗管理

- ステータス管理（視聴中 / 完了 / 中断 / 予定）
- 10点満点の評価
- 話数・巻数の進捗トラッキング
- ステータス変更時の自動処理（完了日の自動セット、話数の自動同期）

### マイライブラリ

- ステータス別・ジャンル別フィルタ
- 更新日・評価・タイトルでのソート
- ページネーション（URLクエリパラメータと同期）

### ダッシュボード

- 進行中コンテンツの一覧表示
- ワンクリック進捗更新（「+1話」「+1巻」「観た」「読了」「クリア」）

### 認証

- メール + パスワード認証（devise）
- Google OAuth（OmniAuth）
- アカウント設定画面（OAuth連携管理、パスワード設定）

---

## 技術スタック

| レイヤー | 技術 | 選定理由 |
|---------|------|---------|
| バックエンド | Ruby 3.3 / Rails 8（APIモード） | 高速なAPI開発、豊富なエコシステム |
| フロントエンド | React 19 / TypeScript / Vite | 型安全なSPA開発、高速なHMR |
| データベース | PostgreSQL 16 | 信頼性、条件付きインデックス等の高度な機能 |
| キャッシュ | Redis 7（開発）/ Solid Cache（本番予定） | 外部API検索結果のキャッシュ |
| 認証 | devise + OmniAuth | セッションCookie認証、OAuth拡張が容易 |
| テスト（BE） | RSpec | request spec中心の統合テスト |
| テスト（FE） | Vitest + React Testing Library | 高速なコンポーネントテスト |
| リンター | RuboCop / ESLint + Prettier | コード品質の自動担保 |
| インフラ | AWS（EC2, RDS, S3, CloudFront） | 本番環境のフル構成 |
| IaC | Terraform | インフラのコード管理 |
| CI/CD | GitHub Actions | lint, test, security scan, 自動デプロイ |
| コードレビュー | Claude Code Actions | AIによる自動コードレビュー |
| 開発環境 | Docker Compose | 環境差異のないローカル開発 |

---

## アーキテクチャ

```
                         ┌─────────────┐
                         │  CloudFront │
                         │   (CDN)     │
                         └──────┬──────┘
                                │
                  ┌─────────────┼─────────────┐
                  │             │             │
           ┌──────▼──────┐ ┌───▼────┐ ┌──────▼──────┐
           │  S3 Bucket  │ │  EC2   │ │             │
           │ (React SPA) │ │(Rails) │ │   ブラウザ   │
           └─────────────┘ └───┬────┘ └─────────────┘
                               │
                  ┌────────────┼────────────┐
                  │            │            │
           ┌──────▼──────┐ ┌──▼───┐ ┌──────▼──────┐
           │    RDS      │ │Redis │ │  外部API     │
           │(PostgreSQL) │ │      │ │ TMDB/AniList │
           └─────────────┘ └──────┘ │ Google Books │
                                    │ IGDB         │
                                    └──────────────┘
```

### バックエンド（Rails API）

- APIモード（HTMLレンダリングなし、JSONレスポンスのみ）
- deviseによるセッションCookie認証 + OmniAuth OAuth
- 外部APIクライアントはアダプタパターンで統一インターフェース化（ADR-0011）
- thin controller原則（ビジネスロジックはサービスオブジェクトに分離）

### フロントエンド（React SPA）

- TypeScriptによる型安全な開発
- CSS Modules + グローバルCSS変数によるデザインシステム
- AuthContextによるセッション管理（Cookie自動送信）
- 共通UIコンポーネント（Button, Typography, Divider等）を全ページで再利用

---

## AI駆動開発

Recollyは**Claude Code**を開発の中核に据えたAI駆動開発で構築しています。

### 開発手法：SDD + TDD

**SDD（仕様駆動開発）** — 全ての実装は仕様書から始まります。

```
仕様書作成 → Issue起票 → 実装プラン作成 → TDD実装 → コードレビュー → マージ
```

各フェーズでClaude Codeの専用スキル（superpowers）を活用しています。

| フェーズ | 使用スキル | 内容 |
|---------|----------|------|
| 要件定義 | brainstorming | 対話形式で要件を深掘り、設計仕様書を作成 |
| 計画 | writing-plans | 仕様書からTDD形式の実装プランを生成 |
| 実装 | subagent-driven-development | タスクごとにサブエージェントを起動、2段階レビュー |
| テスト | test-driven-development | RED → GREEN → REFACTOR サイクル |
| レビュー | Claude Code Actions | PRに対する自動コードレビュー（GitHub Actions経由） |

### 自動コードレビュー

全てのPRにClaude Code Reviewが自動実行されます。レビュー観点:

- CLAUDE.md準拠（コーディング規約、命名規則、ファイルサイズ）
- バグ・セキュリティ（SQLインジェクション、XSS、認証漏れ）
- パフォーマンス（N+1クエリ、不要な再レンダリング）
- テストカバレッジ

### 理解負債の防止

技術選定時には必ず「なぜその技術を選んだか」をADRに記録し、将来の自分やチームメンバーが判断の背景を理解できるようにしています。

---

## 設計判断の記録（ADR）

全ての技術選定はADR（Architecture Decision Record）として記録しています。「何を選んだか」だけでなく「なぜ選んだか」「他に何を検討したか」を残すことで、設計の意図を将来にわたって参照可能にしています。

| # | 決定 |
|---|------|
| 0001 | [バックエンドにRuby on Railsを採用](docs/adr/0001-バックエンドにruby-on-railsを採用.md) |
| 0002 | [フロントエンドにReact + TypeScriptを採用](docs/adr/0002-フロントエンドにreact-typescriptを採用.md) |
| 0003 | [データベースにPostgreSQLを採用](docs/adr/0003-データベースにpostgresqlを採用.md) |
| 0004 | [開発環境にDocker Composeを採用](docs/adr/0004-開発環境にdocker-composeを採用.md) |
| 0005 | [開発手法にSDD + TDDを採用](docs/adr/0005-開発手法にsdd-tddを採用.md) |
| 0006 | [CSSスタイリング方式にCSS Modules + グローバルCSS変数を採用](docs/adr/0006-cssスタイリング方式にcss-modules-グローバルcss変数を採用.md) |
| 0007 | [認証アーキテクチャにdevise + セッションCookieを採用](docs/adr/0007-認証アーキテクチャにdevise-セッションcookieを採用.md) |
| 0008 | [検索キャッシュにRedisを採用](docs/adr/0008-検索キャッシュにredisを採用.md) |
| 0009 | [HTTPクライアントにFaradayを採用](docs/adr/0009-httpクライアントにfaradayを採用.md) |
| 0010 | [AniList GraphQLをHTTP直接クエリで対応](docs/adr/0010-anilist-graphqlをhttp直接クエリで対応.md) |
| 0011 | [外部APIクライアントにアダプタパターンを採用](docs/adr/0011-外部apiクライアントにアダプタパターンを採用.md) |
| 0012 | [本番インフラにAWS フル構成 + Terraformを採用](docs/adr/0012-本番インフラにaws-フル構成-terraformを採用.md) |
| 0013 | [OAuth認証にOmniAuth + サーバーサイドフローを採用](docs/adr/0013-oauth認証にomniauth-サーバーサイドフローを採用.md) |
| 0014 | [PWA + Workboxキャッシュ戦略を採用](docs/adr/0014-pwaとworkboxキャッシュ戦略を採用.md) |
| 0015 | [フロントエンド状態管理にReact標準機能を採用](docs/adr/0015-フロントエンド状態管理にreact標準機能を採用.md) |
| 0016 | [CI/CD基盤にGitHub Actionsを採用](docs/adr/0016-ci-cd基盤にgithub-actionsを採用.md) |
| 0017 | [フロントエンドAPIクライアントにfetch + 独自ラッパーを採用](docs/adr/0017-フロントエンドapiクライアントにfetch-独自ラッパーを採用.md) |
| 0018 | [ビルドツールにViteを採用](docs/adr/0018-ビルドツールにviteを採用.md) |
| 0019 | [テストフレームワークにVitest + RTL / RSpecを採用](docs/adr/0019-テストフレームワークにvitest-rtl-rspecを採用.md) |
| 0020 | [Linter/FormatterにESLint + Prettier / RuboCopを採用](docs/adr/0020-linter-formatterにeslint-prettier-rubocopを採用.md) |
| 0021 | [セキュリティスキャンにBrakeman + bundler-audit + npm auditを採用](docs/adr/0021-セキュリティスキャンにbrakeman-bundler-audit-npm-auditを採用.md) |
| 0022 | [JSONレスポンスをコントローラー直接記述で構築](docs/adr/0022-jsonレスポンスをコントローラー直接記述で構築.md) |
| 0023 | [CORS設定にrack-corsを採用](docs/adr/0023-cors設定にrack-corsを採用.md) |
| 0024 | [Ruby 3.3とNode.js 22を採用](docs/adr/0024-ruby-3.3とnode-22を採用.md) |
| 0025 | [パッケージマネージャにnpmを採用](docs/adr/0025-パッケージマネージャにnpmを採用.md) |
| 0026 | [レスポンシブデザインに3段階ブレークポイントを採用](docs/adr/0026-レスポンシブデザインに3段階ブレークポイントを採用.md) |
| 0027 | [DB制約戦略にRailsバリデーション + DB制約の二重防御を採用](docs/adr/0027-db制約戦略にrailsバリデーションとdb制約の二重防御を採用.md) |
| 0028 | [AWS詳細アーキテクチャの構成判断](docs/adr/0028-aws詳細アーキテクチャの構成判断.md) |
| 0029 | [フロントエンドルーティングにReact Routerを採用](docs/adr/0029-フロントエンドルーティングにreact-routerを採用.md) |
| 0030 | [APIエラーハンドリング戦略](docs/adr/0030-apiエラーハンドリング戦略.md) |
| 0031 | [フォント選定とデザイントークン体系](docs/adr/0031-フォント選定とデザイントークン体系.md) |
| 0032 | [RESTful API設計規約](docs/adr/0032-restful-api設計規約.md) |

---

## セットアップ

### 前提条件

- [Docker Desktop](https://docs.docker.com/desktop/)

### 起動

```bash
# 全サービス起動（PostgreSQL + Redis + Rails API + React）
docker compose up

# バックエンドのみ
docker compose up backend
```

- React: http://localhost:5173
- Rails API: http://localhost:3000
- ヘルスチェック: http://localhost:3000/up

### テスト

```bash
# バックエンド（RSpec）
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec

# フロントエンド（Vitest）
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

---

## ディレクトリ構成

```
recolly/
├── backend/          Rails API
│   ├── app/
│   │   ├── controllers/api/v1/   APIコントローラー
│   │   ├── models/               モデル（User, Work, Record等）
│   │   └── services/             サービスオブジェクト
│   └── spec/                     RSpecテスト
├── frontend/         React + TypeScript
│   └── src/
│       ├── components/           共通UIコンポーネント
│       ├── contexts/             React Context（認証等）
│       ├── lib/                  API通信・型定義
│       └── pages/                ページコンポーネント
├── infra/            Terraform（AWS設定）
├── docs/
│   ├── adr/                      設計判断記録（ADR）
│   └── superpowers/              仕様書・実装プラン
├── .github/          GitHub Actions（CI + Claude Code Review）
├── CLAUDE.md         プロジェクトルール
└── docker-compose.yml
```

---

## ドキュメント

| 種類 | リンク |
|------|--------|
| プロダクト設計仕様書 | [docs/superpowers/specs/2026-03-20-recolly-design.md](docs/superpowers/specs/2026-03-20-recolly-design.md) |
| プロジェクトルール | [CLAUDE.md](CLAUDE.md) |
| 設計判断記録 | [docs/adr/](docs/adr/) |
