# フェーズ0: 開発環境整備 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recollyプロジェクトの開発環境をゼロから構築し、Docker上でRails API + React + PostgreSQLが動作し、lint・テスト・Git hooksが機能する状態にする

**Architecture:** モノレポ構成でbackend（Rails 8 APIモード）とfrontend（React 19 + TypeScript + Vite）を管理。Docker Composeで全サービス（PostgreSQL, Rails, React）をオーケストレーション。CLAUDE.mdとGit hooks（lefthook）でコード品質のガードレールを確立する。

**Tech Stack:** Ruby 3.3 / Rails 8 / PostgreSQL 16 / React 19 / TypeScript 5 / Vite 6 / Docker / lefthook

---

## スコープ

- このプランはフェーズ0「開発環境整備」のうち、インフラ・環境構築をカバーする
- **デザインシステム（共通コンポーネント）は別プランとして作成予定**（フェーズ0b）
- MCP設定（Playwright, Serena, Context7, DB接続）はユーザーのIDE設定のため、コードベースに含めず別途手動で行う

## 仕様書参照

- メイン仕様書: `docs/superpowers/specs/2026-03-20-recolly-design.md`

## 判断メモ

| 判断 | 理由 |
|------|------|
| Vitest を採用（Jest互換） | ViteプロジェクトではVitestがネイティブ動作。Jest互換APIのため仕様書の意図を満たす |
| lefthook を採用 | Ruby/JS両方に対応するgit hooks管理ツール。husky（Node専用）よりモノレポ向き |
| Docker Compose で全サービス管理 | 開発環境の再現性を担保。PostgreSQLのローカルインストール不要 |
| API prefix: `/api/v1` | バージョニングのベストプラクティス |
| アプリ生成はone-shot Docker | Dockerfile作成前にアプリ雛形が必要なため、使い捨てコンテナで生成 |

## ファイル構成

新規作成するファイル一覧（Rails/React自動生成ファイルは省略）:

```
recolly/
├── backend/
│   ├── Dockerfile                                    [Task 4]
│   ├── .rubocop.yml                                  [Task 8]
│   ├── config/database.yml                           [Task 5]（更新）
│   ├── config/routes.rb                              [Task 7]（更新）
│   ├── app/controllers/api/v1/health_controller.rb   [Task 7]
│   └── spec/requests/api/v1/health_spec.rb           [Task 7]
├── frontend/
│   ├── Dockerfile                                    [Task 4]
│   ├── .prettierrc                                   [Task 9]
│   ├── vite.config.ts                                [Task 4, 10]（更新）
│   ├── src/test-setup.ts                             [Task 10]
│   └── src/App.test.tsx                              [Task 10]
├── docker-compose.yml                                [Task 4]
├── CLAUDE.md                                         [Task 11]
├── lefthook.yml                                      [Task 12]
└── package.json                                      [Task 12]（ルートレベル）
```

---

### Task 1: モノレポ ディレクトリ構成

**Files:**
- Create: `infra/.keep`
- Modify: `.gitignore`（Docker関連を追加）

> backend/ と frontend/ は Task 2, 3 でアプリ生成時に自動作成される

- [ ] **Step 1: infra ディレクトリを作成**

```bash
mkdir -p infra
touch infra/.keep
```

- [ ] **Step 2: .gitignore にDocker関連を追加**

`.gitignore` の末尾に以下を追加:

```gitignore

# Docker
docker-compose.override.yml
```

- [ ] **Step 3: コミット**

```bash
git add infra/.keep .gitignore
git commit -m "chore: モノレポのディレクトリ構成を作成"
```

---

### Task 2: Rails API 生成

**Files:**
- Create: `backend/` 配下に Rails アプリケーション一式

**前提:** Docker Desktop がインストール・起動済みであること

- [ ] **Step 1: Rails アプリケーションを生成**

使い捨てDockerコンテナで `rails new` を実行:

```bash
docker run --rm -v "$(pwd)/backend:/app" -w /app ruby:3.3 bash -c \
  "gem install rails -v '~> 8.0' --no-document && \
   rails new . --api --database=postgresql --skip-git --skip-docker \
   --skip-action-mailbox --skip-action-text --skip-active-storage --skip-action-cable"
```

> **Windows (Git Bash) でパスエラーが出る場合:**
> ```bash
> MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd)/backend:/app" -w /app ruby:3.3 bash -c \
>   "gem install rails -v '~> 8.0' --no-document && \
>    rails new . --api --database=postgresql --skip-git --skip-docker \
>    --skip-action-mailbox --skip-action-text --skip-active-storage --skip-action-cable"
> ```

- [ ] **Step 2: 生成結果を確認**

```bash
ls backend/
```

Expected: `Gemfile`, `Rakefile`, `app/`, `config/`, `db/`, `lib/` などが存在する

- [ ] **Step 3: コミット**

```bash
git add backend/
git commit -m "chore: Rails 8 APIアプリケーションを生成"
```

---

### Task 3: React + TypeScript 生成

**Files:**
- Create: `frontend/` 配下に React + TypeScript + Vite アプリケーション一式

- [ ] **Step 1: React アプリケーションを生成**

```bash
docker run --rm -v "$(pwd)/frontend:/app" -w /app node:22 bash -c \
  "npm create vite@latest . -- --template react-ts && npm install"
```

> **Windows (Git Bash) の場合:** Task 2 と同様に `MSYS_NO_PATHCONV=1` を先頭に付ける

- [ ] **Step 2: 生成結果を確認**

```bash
ls frontend/
```

Expected: `package.json`, `vite.config.ts`, `src/`, `tsconfig.json` などが存在する

- [ ] **Step 3: コミット**

```bash
git add frontend/
git commit -m "chore: React + TypeScript + Viteアプリケーションを生成"
```

---

### Task 4: Docker環境構築

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `docker-compose.yml`
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: backend/Dockerfile を作成**

```dockerfile
FROM ruby:3.3-slim

RUN apt-get update -qq && \
    apt-get install -y build-essential libpq-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Gemfile Gemfile.lock ./
RUN bundle install

COPY . .

EXPOSE 3000

CMD ["bin/rails", "server", "-b", "0.0.0.0"]
```

- [ ] **Step 2: frontend/Dockerfile を作成**

```dockerfile
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
```

- [ ] **Step 3: docker-compose.yml を作成**

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    environment:
      DB_HOST: db
      DB_USERNAME: postgres
      DB_PASSWORD: password
      RAILS_ENV: development
    volumes:
      - ./backend:/app
      - bundle_cache:/usr/local/bundle
    stdin_open: true
    tty: true

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules

volumes:
  postgres_data:
  bundle_cache:
```

- [ ] **Step 4: vite.config.ts をDocker対応に更新**

`frontend/vite.config.ts` を以下の内容に置換:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://backend:3000',
        changeOrigin: true,
      },
    },
  },
})
```

> `host: true` — Docker内から外部アクセスを許可
> `usePolling: true` — Windows Dockerのファイル監視問題を回避
> `proxy` — フロントエンドからのAPI呼び出しをバックエンドに転送

- [ ] **Step 5: ビルド確認**

```bash
docker compose build
```

Expected: 全サービスが正常にビルドされる（エラーなし）

- [ ] **Step 6: コミット**

```bash
git add docker-compose.yml backend/Dockerfile frontend/Dockerfile frontend/vite.config.ts
git commit -m "chore: Docker Compose環境を構築"
```

---

### Task 5: PostgreSQL接続 + DB作成

**Files:**
- Modify: `backend/config/database.yml`

- [ ] **Step 1: database.yml を環境変数対応に更新**

`backend/config/database.yml` を以下の内容に置換:

```yaml
default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  host: <%= ENV.fetch("DB_HOST") { "localhost" } %>
  username: <%= ENV.fetch("DB_USERNAME") { "postgres" } %>
  password: <%= ENV.fetch("DB_PASSWORD") { "password" } %>

development:
  <<: *default
  database: recolly_development

test:
  <<: *default
  database: recolly_test

production:
  <<: *default
  database: recolly_production
  url: <%= ENV["DATABASE_URL"] %>
```

- [ ] **Step 2: DBサービスを起動してデータベースを作成**

```bash
docker compose up -d db
docker compose run --rm backend bin/rails db:create
```

Expected: `Created database 'recolly_development'` と `Created database 'recolly_test'`

- [ ] **Step 3: 接続確認**

```bash
docker compose run --rm backend bin/rails db:version
```

Expected: `Current version: 0`

- [ ] **Step 4: コミット**

```bash
git add backend/config/database.yml
git commit -m "chore: PostgreSQL接続設定を構成"
```

---

### Task 6: RSpec セットアップ

**Files:**
- Modify: `backend/Gemfile`
- Create: `backend/.rspec`（自動生成）
- Create: `backend/spec/spec_helper.rb`（自動生成）
- Create: `backend/spec/rails_helper.rb`（自動生成）

- [ ] **Step 1: Gemfile に rspec-rails を追加**

`backend/Gemfile` の `group :development, :test do` ブロックに追加:

```ruby
  gem "rspec-rails", "~> 7.0"
```

- [ ] **Step 2: bundle install + RSpec 初期化**

```bash
docker compose run --rm backend bash -c "bundle install && bin/rails generate rspec:install"
```

Expected: `create  .rspec`, `create  spec/spec_helper.rb`, `create  spec/rails_helper.rb`

- [ ] **Step 3: RSpec の動作確認**

```bash
docker compose run --rm backend bundle exec rspec
```

Expected: `0 examples, 0 failures`

- [ ] **Step 4: デフォルトの test/ ディレクトリを削除**

```bash
rm -rf backend/test
```

- [ ] **Step 5: コミット**

```bash
git add backend/Gemfile backend/Gemfile.lock backend/.rspec backend/spec/
git commit -m "chore: RSpecをセットアップ"
```

---

### Task 7: ヘルスチェックAPI（TDD）

**Files:**
- Create: `backend/spec/requests/api/v1/health_spec.rb`
- Create: `backend/app/controllers/api/v1/health_controller.rb`
- Modify: `backend/config/routes.rb`

- [ ] **Step 1: テストファイルを作成**

```bash
mkdir -p backend/spec/requests/api/v1
```

`backend/spec/requests/api/v1/health_spec.rb`:

```ruby
require "rails_helper"

RSpec.describe "ヘルスチェックAPI", type: :request do
  describe "GET /api/v1/health" do
    it "ステータス200と{status: ok}を返す" do
      get "/api/v1/health"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["status"]).to eq("ok")
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
docker compose run --rm backend bundle exec rspec spec/requests/api/v1/health_spec.rb
```

Expected: FAIL（ルーティングが存在しないエラー）

- [ ] **Step 3: ルーティングを追加**

`backend/config/routes.rb` を以下に置換:

```ruby
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      get "health", to: "health#show"
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
```

- [ ] **Step 4: コントローラーを作成**

```bash
mkdir -p backend/app/controllers/api/v1
```

`backend/app/controllers/api/v1/health_controller.rb`:

```ruby
module Api
  module V1
    class HealthController < ApplicationController
      def show
        render json: { status: "ok" }
      end
    end
  end
end
```

- [ ] **Step 5: テストが成功することを確認**

```bash
docker compose run --rm backend bundle exec rspec spec/requests/api/v1/health_spec.rb
```

Expected: `1 example, 0 failures`

- [ ] **Step 6: コミット**

```bash
git add backend/spec/requests/api/v1/health_spec.rb \
        backend/app/controllers/api/v1/health_controller.rb \
        backend/config/routes.rb
git commit -m "feat: ヘルスチェックAPIを追加（TDD）"
```

---

### Task 8: RuboCop 設定

**Files:**
- Modify: `backend/Gemfile`
- Create: `backend/.rubocop.yml`

- [ ] **Step 1: Gemfile に RuboCop 関連 gem を追加**

`backend/Gemfile` の `group :development do` ブロック（なければ作成）に追加:

```ruby
  gem "rubocop", require: false
  gem "rubocop-rails", require: false
  gem "rubocop-rspec", require: false
```

- [ ] **Step 2: bundle install**

```bash
docker compose run --rm backend bundle install
```

- [ ] **Step 3: .rubocop.yml を作成**

`backend/.rubocop.yml`:

```yaml
require:
  - rubocop-rails
  - rubocop-rspec

AllCops:
  NewCops: enable
  TargetRubyVersion: 3.3
  Exclude:
    - "bin/**/*"
    - "db/schema.rb"
    - "db/migrate/**/*"
    - "vendor/**/*"
    - "config/**/*"

# 1ファイル200行以内（プロジェクト規約）
Metrics/ClassLength:
  Max: 150

Metrics/MethodLength:
  Max: 20

# 日本語コメントを許可
Style/AsciiComments:
  Enabled: false

# APIモードのモジュールネスト
Style/ClassAndModuleChildren:
  Enabled: false

# Ruby 3.x ではフリーズコメント不要
Style/FrozenStringLiteralComment:
  Enabled: false

# ドキュメントコメントは強制しない
Style/Documentation:
  Enabled: false

Rails:
  Enabled: true
```

- [ ] **Step 4: RuboCop を実行**

```bash
docker compose run --rm backend bundle exec rubocop
```

- [ ] **Step 5: 違反があれば auto-correct で修正**

```bash
docker compose run --rm backend bundle exec rubocop -A
```

- [ ] **Step 6: コミット**

auto-correct で修正されたRubyファイルがあれば、それらも含めてステージングする:

```bash
git add backend/.rubocop.yml backend/Gemfile backend/Gemfile.lock
git add backend/app/ backend/spec/
git commit -m "chore: RuboCopを設定"
```

---

### Task 9: ESLint + Prettier 設定

**Files:**
- Create: `frontend/.prettierrc`
- Modify: `frontend/package.json`（スクリプト追加）
- Modify: `frontend/eslint.config.js`（Prettier統合）

> Vite のテンプレートが生成する `eslint.config.js` をベースに拡張する

- [ ] **Step 1: Prettier と eslint-config-prettier をインストール**

```bash
docker compose run --rm frontend npm install -D prettier eslint-config-prettier
```

- [ ] **Step 2: .prettierrc を作成**

`frontend/.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 3: eslint.config.js に Prettier 設定と厳格ルールを追加**

`frontend/eslint.config.js` を確認し、以下を追加:

1. ファイル先頭のimportに追加:
```javascript
import prettier from 'eslint-config-prettier'
```

2. `export default` の配列の末尾に追加:
```javascript
  prettier,
```

3. rules に以下を追加（既存のrulesブロックに統合）:
```javascript
  '@typescript-eslint/no-explicit-any': 'error',
```

- [ ] **Step 4: package.json にスクリプトを追加**

`frontend/package.json` の `"scripts"` に追加:

```json
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write 'src/**/*.{ts,tsx,css,json}'",
    "format:check": "prettier --check 'src/**/*.{ts,tsx,css,json}'"
```

> `lint` スクリプトが既に存在する場合は上記に置換する

- [ ] **Step 5: format + lint を実行**

```bash
docker compose run --rm frontend npm run format
docker compose run --rm frontend npm run lint
```

Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add frontend/.prettierrc frontend/package.json frontend/package-lock.json \
        frontend/eslint.config.js frontend/src/
git commit -m "chore: ESLint + Prettierを設定"
```

---

### Task 10: Vitest + React Testing Library セットアップ + テスト

**Files:**
- Modify: `frontend/vite.config.ts`（test設定追加）
- Modify: `frontend/tsconfig.app.json`（型追加）
- Modify: `frontend/package.json`（スクリプト追加）
- Create: `frontend/src/test-setup.ts`
- Create: `frontend/src/App.test.tsx`

- [ ] **Step 1: テスト関連パッケージをインストール**

```bash
docker compose run --rm frontend npm install -D \
  vitest \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  jsdom
```

- [ ] **Step 2: vite.config.ts にテスト設定を追加**

`frontend/vite.config.ts` の先頭に追加:

```typescript
/// <reference types="vitest" />
```

`defineConfig` 内に `test` ブロックを追加:

```typescript
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
```

最終的な `frontend/vite.config.ts`:

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://backend:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
```

- [ ] **Step 3: テストセットアップファイルを作成**

`frontend/src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: tsconfig.app.json に vitest の型を追加**

`frontend/tsconfig.app.json` の `compilerOptions` に以下を追加:

```json
    "types": ["vitest/globals"]
```

- [ ] **Step 5: package.json にテストスクリプトを追加**

`frontend/package.json` の `"scripts"` に追加:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 6: App コンポーネントの基本テストを作成**

`frontend/src/App.test.tsx`:

```typescript
import { render } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('エラーなくレンダリングされる', () => {
    const { container } = render(<App />)
    expect(container).toBeTruthy()
  })
})
```

- [ ] **Step 7: テストを実行**

```bash
docker compose run --rm frontend npm test
```

Expected: `1 passed`

- [ ] **Step 8: コミット**

```bash
git add frontend/vite.config.ts frontend/src/test-setup.ts frontend/src/App.test.tsx \
        frontend/package.json frontend/package-lock.json frontend/tsconfig.app.json
git commit -m "chore: Vitest + React Testing Libraryをセットアップ"
```

---

### Task 11: CLAUDE.md 作成

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md を作成**

`CLAUDE.md`:

```markdown
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
docker compose run --rm backend bundle exec rspec
docker compose run --rm frontend npm test

# lint実行
docker compose run --rm backend bundle exec rubocop
docker compose run --rm frontend npm run lint

# DB操作
docker compose run --rm backend bin/rails db:create
docker compose run --rm backend bin/rails db:migrate
docker compose run --rm backend bin/rails db:seed
```
```

- [ ] **Step 2: コミット**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.mdを作成（プロジェクトルール定義）"
```

---

### Task 12: Git Hooks 設定（lefthook）

**Files:**
- Create: `package.json`（ルートレベル、lefthook用）
- Create: `lefthook.yml`

- [ ] **Step 1: ルートレベルの package.json を作成**

`package.json`（プロジェクトルート）:

```json
{
  "private": true,
  "scripts": {
    "prepare": "lefthook install"
  },
  "devDependencies": {
    "lefthook": "^1.11.0"
  }
}
```

- [ ] **Step 2: lefthook をインストール**

```bash
npm install
npx lefthook install
```

Expected: `.git/hooks/` 配下にフックファイルが作成される

- [ ] **Step 3: lefthook.yml を作成**

`lefthook.yml`:

```yaml
pre-commit:
  parallel: true
  commands:
    rubocop:
      root: backend/
      glob: "*.rb"
      run: docker compose exec -T backend bundle exec rubocop --force-exclusion {staged_files}
    eslint:
      root: frontend/
      glob: "*.{ts,tsx}"
      run: docker compose exec -T frontend npx eslint {staged_files}
    prettier:
      root: frontend/
      glob: "*.{ts,tsx,css,json}"
      run: docker compose exec -T frontend npx prettier --check {staged_files}

pre-push:
  commands:
    rspec:
      run: docker compose run --rm backend bundle exec rspec
    vitest:
      run: docker compose run --rm frontend npm test
```

> **注意:** hooks はDockerコンテナ内で実行する。コミット・プッシュ時にDocker Composeが起動している必要がある。
> 緊急時は `git commit --no-verify` でスキップ可能だが、通常は使用しないこと。

- [ ] **Step 4: .gitignore にルートの node_modules を確認**

`.gitignore` に `node_modules/` が含まれていることを確認（既に含まれている）。

- [ ] **Step 5: コミット**

```bash
git add package.json package-lock.json lefthook.yml
git commit -m "chore: lefthookでGit hooksを設定"
```

---

### Task 13: 全体動作確認

- [ ] **Step 1: 全サービスを起動**

```bash
docker compose up -d
```

Expected: db, backend, frontend の3サービスが起動

- [ ] **Step 2: サービス状態を確認**

```bash
docker compose ps
```

Expected: 全サービスが `running` 状態

- [ ] **Step 3: PostgreSQL 確認**

```bash
docker compose exec db pg_isready -U postgres
```

Expected: `accepting connections`

- [ ] **Step 4: Rails API 確認**

```bash
curl http://localhost:3000/api/v1/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 5: React 開発サーバー確認**

ブラウザで http://localhost:5173 を開く

Expected: Vite + React のデフォルトページが表示される

- [ ] **Step 6: バックエンドテスト実行**

```bash
docker compose run --rm backend bundle exec rspec
```

Expected: `1 example, 0 failures`

- [ ] **Step 7: フロントエンドテスト実行**

```bash
docker compose run --rm frontend npm test
```

Expected: `1 passed`

- [ ] **Step 8: バックエンドlint実行**

```bash
docker compose run --rm backend bundle exec rubocop
```

Expected: `no offenses detected`

- [ ] **Step 9: フロントエンドlint実行**

```bash
docker compose run --rm frontend npm run lint
```

Expected: エラーなし

- [ ] **Step 10: サービスを停止**

```bash
docker compose down
```

---

## 完了条件

- [ ] モノレポ構成（backend / frontend / infra / docs）が存在する
- [ ] `docker compose up` で全サービスが起動する
- [ ] `curl localhost:3000/api/v1/health` が `{"status":"ok"}` を返す
- [ ] `localhost:5173` でReactアプリが表示される
- [ ] RSpec: 1 example, 0 failures
- [ ] Vitest: 1 passed
- [ ] RuboCop: no offenses
- [ ] ESLint + Prettier: エラーなし
- [ ] Git hooks（lefthook）が設定されている
- [ ] CLAUDE.md がプロジェクトルール全てを含んでいる

## 次のステップ

1. **フェーズ0b: デザインシステム基盤** — CSS変数（デザイントークン）、Typography、Button、Divider、SectionTitleコンポーネントの構築（TDD）
2. **フェーズ1: 基盤 + 記録機能（MVP）** — 認証、作品検索、記録機能、マイライブラリ、ダッシュボード

## 手動設定（プラン対象外）

以下はユーザー固有の設定のため、別途手動で行う:

- **MCP設定**: Playwright, Serena, Context7, DB接続MCPの設定
- **IDE設定**: エディタの拡張機能やフォーマッタ設定
