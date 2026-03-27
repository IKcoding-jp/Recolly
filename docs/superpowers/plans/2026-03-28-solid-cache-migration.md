# Solid Cache移行 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本番環境のキャッシュストアを `memory_store` から `solid_cache_store` に移行する

**Architecture:** Solid Cacheは既存PostgreSQLの `solid_cache_entries` テーブルにキャッシュを保存する。Rails 8のマルチDB機能を使い、`database.yml` に `cache` データベースエントリを追加する（物理的には同一DB）。開発・テスト環境のキャッシュストアは変更しない。

**Tech Stack:** Rails 8 / Solid Cache 1.0.10 / PostgreSQL 16

**スペック:** `docs/superpowers/specs/2026-03-28-solid-cache-migration-design.md`

---

### Task 1: database.ymlをマルチDB形式に更新

**Files:**
- Modify: `backend/config/database.yml`

現在のフラット形式をRails 8マルチDB形式に変換し、`cache` エントリを追加する。`cache` は `primary` と同じ物理DBを指す（単一DB構成）。

- [ ] **Step 1: database.ymlをマルチDB形式に書き換え**

`backend/config/database.yml` を以下の内容に書き換える:

```yaml
default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  host: <%= ENV.fetch("DB_HOST") { "localhost" } %>
  username: <%= ENV.fetch("DB_USERNAME") { "postgres" } %>
  password: <%= ENV.fetch("DB_PASSWORD") { "password" } %>

development:
  primary:
    <<: *default
    database: recolly_development
  cache:
    <<: *default
    database: recolly_development
    migrations_paths: db/cache_migrate

test:
  primary:
    <<: *default
    database: recolly_test
  cache:
    <<: *default
    database: recolly_test
    migrations_paths: db/cache_migrate

production:
  primary:
    <<: *default
    database: recolly_production
    url: <%= ENV["DATABASE_URL"] %>
  cache:
    <<: *default
    database: recolly_production
    url: <%= ENV["DATABASE_URL"] %>
    migrations_paths: db/cache_migrate
```

**ポイント:**
- 各環境で `primary:` と `cache:` をネスト。フラット形式の `<<: *default` + `database:` を `primary:` の下に移動
- `cache:` は同じDB名を指す（単一DB構成）。将来DB分離する場合はここだけ変更すればよい
- `migrations_paths: db/cache_migrate` でSolid Cacheのマイグレーションが `db/cache_migrate/` に格納されることを指定
- production の `url: <%= ENV["DATABASE_URL"] %>` は primary と cache の両方に設定

- [ ] **Step 2: Dockerコンテナでdatabase.ymlの設定を検証**

Run: `docker compose run --rm backend bin/rails runner "puts ActiveRecord::Base.configurations.configs_for(env_name: 'development').map(&:name)"`

Expected: `primary` と `cache` の2つが表示される

- [ ] **Step 3: コミット**

```bash
git add backend/config/database.yml
git commit -m "chore: database.ymlをマルチDB形式に変換（Solid Cache準備） (#46)"
```

---

### Task 2: Solid Cacheマイグレーションを作成・実行

**Files:**
- Create: `backend/db/cache_migrate/XXXXXXXXXX_create_solid_cache_entries.rb`（タイムスタンプは自動生成）

`solid_cache:install` で公式マイグレーションを生成し、実行する。

- [ ] **Step 1: solid_cache:installを実行してマイグレーションを生成**

Run: `docker compose run --rm backend bin/rails solid_cache:install`

このコマンドは `db/cache_migrate/` ディレクトリにマイグレーションファイルを生成する。`config/cache.yml` や `database.yml` も上書きされる可能性がある。

- [ ] **Step 2: 生成されたファイルを確認**

Run: `ls backend/db/cache_migrate/`

Expected: `XXXXXXXXXX_create_solid_cache_entries.rb` のようなマイグレーションファイルが存在する

- [ ] **Step 3: database.ymlが上書きされていないか確認**

Run: `git diff backend/config/database.yml`

もし `solid_cache:install` が `database.yml` を上書きしていたら、Task 1で作成した内容に戻す:
```bash
git checkout backend/config/database.yml
```
そしてTask 1 Step 1の内容で再度書き換える。

- [ ] **Step 4: マイグレーションを実行**

Run: `docker compose run --rm backend bin/rails db:migrate`

Expected: `solid_cache_entries` テーブルが作成される

- [ ] **Step 5: マイグレーション結果を確認**

Run: `docker compose run --rm backend bin/rails runner "puts ActiveRecord::Base.connection.table_exists?('solid_cache_entries')"`

Expected: `true`

- [ ] **Step 6: テスト環境にもマイグレーション適用**

Run: `docker compose run --rm -e RAILS_ENV=test backend bin/rails db:migrate`

- [ ] **Step 7: コミット**

```bash
git add backend/db/cache_migrate/ backend/db/cache_schema.rb
git commit -m "chore: Solid Cacheマイグレーションを追加・実行 (#46)"
```

---

### Task 3: cache.ymlをSolid Cache用に更新

**Files:**
- Modify: `backend/config/cache.yml`

- [ ] **Step 1: cache.ymlを書き換え**

`backend/config/cache.yml` を以下の内容に書き換える:

```yaml
# Solid Cache設定（ADR-0008）
# 本番: solid_cache_store（このファイルの設定を使用）
# 開発: redis_cache_store（このファイルは参照されない）
# テスト: null_store（このファイルは参照されない）
default: &default
  database: cache
  store_options:
    max_age: <%= 1.week.to_i %>
    max_size: <%= 256.megabytes %>
    namespace: <%= Rails.env %>

production:
  <<: *default

development:
  <<: *default

test:
  <<: *default
```

**ポイント:**
- `database: cache` は `database.yml` の `cache` エントリを参照する設定
- `max_age: 1.week` はキャッシュエントリの最大保持期間。WorkSearchServiceのTTL（30分）やIgdbAdapterのTTL（50日）は `Rails.cache.fetch` の `expires_in` で個別に制御されるため、ここは全体の上限値
- 開発（Redis）・テスト（null_store）ではこのファイルは参照されない

- [ ] **Step 2: コミット**

```bash
git add backend/config/cache.yml
git commit -m "chore: cache.ymlをSolid Cache用に更新 (#46)"
```

---

### Task 4: production.rbのcache_storeを変更

**Files:**
- Modify: `backend/config/environments/production.rb:44-45`

- [ ] **Step 1: cache_store設定を変更**

`backend/config/environments/production.rb` の44-45行目を変更:

```ruby
# 変更前
  # MVPではmemory_storeを使用（将来ElastiCacheに移行可能）
  config.cache_store = :memory_store

# 変更後
  # Solid Cache: 既存PostgreSQLにキャッシュを保存（ADR-0008）
  config.cache_store = :solid_cache_store
```

- [ ] **Step 2: 開発・テスト環境が変更されていないことを確認**

Run: `docker compose run --rm backend bin/rails runner "puts Rails.application.config.cache_store"`

Expected: `redis_cache_store`（開発環境のまま）

- [ ] **Step 3: コミット**

```bash
git add backend/config/environments/production.rb
git commit -m "chore: 本番cache_storeをsolid_cache_storeに変更 (#46)"
```

---

### Task 5: 全テスト・リンターの実行

- [ ] **Step 1: RSpecを実行**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec`

Expected: 全テストがパス。テスト環境は `null_store` のため、Solid Cache変更の影響を受けない

- [ ] **Step 2: RuboCopを実行**

Run: `docker compose run --rm backend bundle exec rubocop`

Expected: 違反なし

- [ ] **Step 3: フロントエンドテスト・リンターを実行**

Run: `docker compose run --rm frontend npm test`
Run: `docker compose run --rm frontend npm run lint`

Expected: 全パス（フロントエンドに変更なし。念のため確認）

---

### Task 6: ADR-0008を更新

**Files:**
- Modify: `docs/adr/0008-検索キャッシュにredisを採用.md:58-61`

- [ ] **Step 1: 「現状と必要な移行作業」セクションを更新**

`docs/adr/0008-検索キャッシュにredisを採用.md` の58-61行目を変更:

```markdown
## 現状と必要な移行作業
- ✅ Solid Cache導入完了（Issue #46, 2026-03-28）— 本番キャッシュを memory_store → solid_cache_store に移行
- Solid Queue導入（本番ジョブキューのasync → Solid Queue移行）— 未対応
```

- [ ] **Step 2: コミット**

```bash
git add docs/adr/0008-検索キャッシュにredisを採用.md
git commit -m "docs: ADR-0008のSolid Cache移行ステータスを更新 (#46)"
```
