# Solid Queue 移行 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本番環境のジョブキューアダプタを `:async` から `:solid_queue` に移行する

**Architecture:** Solid Cache（Issue #46）と同じパターンで、database.ymlにqueue DB設定（同一物理DB、別マイグレーションパス）を追加し、Solid Queueのマイグレーションを実行する。production.rbのqueue_adapterを変更し、deploy.shにSOLID_QUEUE_IN_PUMA環境変数を追加する。

**Tech Stack:** Rails 8 / Solid Queue 1.3.2 / PostgreSQL 16

**関連:** Issue #47 / スペック: `docs/superpowers/specs/2026-03-28-solid-queue-migration-design.md`

---

### File Structure

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `backend/config/database.yml` | 修正 | queue DB設定を追加 |
| `backend/db/queue_migrate/20260328000001_create_solid_queue_tables.rb` | 新規 | Solid Queue用テーブル作成マイグレーション |
| `backend/config/environments/production.rb` | 修正 | queue_adapterを:solid_queueに変更 |
| `infra/scripts/deploy.sh` | 修正 | SOLID_QUEUE_IN_PUMA環境変数を追加 |
| `docs/adr/0008-検索キャッシュにredisを採用.md` | 修正 | Solid Queue導入完了に更新 |

---

### Task 1: database.yml に queue DB設定を追加

**Files:**
- Modify: `backend/config/database.yml`

- [ ] **Step 1: database.yml に queue エントリを追加**

Solid Cache（`cache`エントリ）と同じパターンで、各環境に `queue` エントリを追加する。

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
  queue:
    <<: *default
    database: recolly_development
    migrations_paths: db/queue_migrate

test:
  primary:
    <<: *default
    database: recolly_test
  cache:
    <<: *default
    database: recolly_test
    migrations_paths: db/cache_migrate
  queue:
    <<: *default
    database: recolly_test
    migrations_paths: db/queue_migrate

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
  queue:
    <<: *default
    database: recolly_production
    url: <%= ENV["DATABASE_URL"] %>
    migrations_paths: db/queue_migrate
```

- [ ] **Step 2: コミット**

```bash
git add backend/config/database.yml
git commit -m "chore: database.ymlにSolid Queue用のqueue DB設定を追加 (#47)"
```

---

### Task 2: Solid Queue マイグレーションファイル作成

**Files:**
- Create: `backend/db/queue_migrate/20260328000001_create_solid_queue_tables.rb`

- [ ] **Step 1: queue_migrate ディレクトリを作成**

```bash
mkdir -p backend/db/queue_migrate
```

- [ ] **Step 2: マイグレーションファイルを作成**

`db/queue_schema.rb` の定義に基づいて、Solid Queue用の全テーブルを1つのマイグレーションファイルで作成する。Solid Cache移行（`db/cache_migrate/20260328000001_create_solid_cache_entries.rb`）と同じパターン。

```ruby
# Solid Queueが使用するジョブキューテーブル群（ADR-0008）
class CreateSolidQueueTables < ActiveRecord::Migration[7.2]
  def change
    create_table :solid_queue_jobs do |t|
      t.string :queue_name, null: false
      t.string :class_name, null: false
      t.text :arguments
      t.integer :priority, default: 0, null: false
      t.string :active_job_id
      t.datetime :scheduled_at
      t.datetime :finished_at
      t.string :concurrency_key
      t.datetime :created_at, null: false
      t.datetime :updated_at, null: false

      t.index [:active_job_id], name: "index_solid_queue_jobs_on_active_job_id"
      t.index [:class_name], name: "index_solid_queue_jobs_on_class_name"
      t.index [:finished_at], name: "index_solid_queue_jobs_on_finished_at"
      t.index [:queue_name, :finished_at], name: "index_solid_queue_jobs_for_filtering"
      t.index [:scheduled_at, :finished_at], name: "index_solid_queue_jobs_for_alerting"
    end

    create_table :solid_queue_scheduled_executions do |t|
      t.bigint :job_id, null: false
      t.string :queue_name, null: false
      t.integer :priority, default: 0, null: false
      t.datetime :scheduled_at, null: false
      t.datetime :created_at, null: false

      t.index [:job_id], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
      t.index [:scheduled_at, :priority, :job_id], name: "index_solid_queue_dispatch_all"
    end

    create_table :solid_queue_ready_executions do |t|
      t.bigint :job_id, null: false
      t.string :queue_name, null: false
      t.integer :priority, default: 0, null: false
      t.datetime :created_at, null: false

      t.index [:job_id], name: "index_solid_queue_ready_executions_on_job_id", unique: true
      t.index [:priority, :job_id], name: "index_solid_queue_poll_all"
      t.index [:queue_name, :priority, :job_id], name: "index_solid_queue_poll_by_queue"
    end

    create_table :solid_queue_claimed_executions do |t|
      t.bigint :job_id, null: false
      t.bigint :process_id
      t.datetime :created_at, null: false

      t.index [:job_id], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
      t.index [:process_id, :job_id], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
    end

    create_table :solid_queue_blocked_executions do |t|
      t.bigint :job_id, null: false
      t.string :queue_name, null: false
      t.integer :priority, default: 0, null: false
      t.string :concurrency_key, null: false
      t.datetime :expires_at, null: false
      t.datetime :created_at, null: false

      t.index [:concurrency_key, :priority, :job_id], name: "index_solid_queue_blocked_executions_for_release"
      t.index [:expires_at, :concurrency_key], name: "index_solid_queue_blocked_executions_for_maintenance"
      t.index [:job_id], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
    end

    create_table :solid_queue_failed_executions do |t|
      t.bigint :job_id, null: false
      t.text :error
      t.datetime :created_at, null: false

      t.index [:job_id], name: "index_solid_queue_failed_executions_on_job_id", unique: true
    end

    create_table :solid_queue_pauses do |t|
      t.string :queue_name, null: false
      t.datetime :created_at, null: false

      t.index [:queue_name], name: "index_solid_queue_pauses_on_queue_name", unique: true
    end

    create_table :solid_queue_processes do |t|
      t.string :kind, null: false
      t.datetime :last_heartbeat_at, null: false
      t.bigint :supervisor_id
      t.integer :pid, null: false
      t.string :hostname
      t.text :metadata
      t.datetime :created_at, null: false
      t.string :name, null: false

      t.index [:last_heartbeat_at], name: "index_solid_queue_processes_on_last_heartbeat_at"
      t.index [:name, :supervisor_id], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
      t.index [:supervisor_id], name: "index_solid_queue_processes_on_supervisor_id"
    end

    create_table :solid_queue_recurring_executions do |t|
      t.bigint :job_id, null: false
      t.string :task_key, null: false
      t.datetime :run_at, null: false
      t.datetime :created_at, null: false

      t.index [:job_id], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
      t.index [:task_key, :run_at], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
    end

    create_table :solid_queue_recurring_tasks do |t|
      t.string :key, null: false
      t.string :schedule, null: false
      t.string :command, limit: 2048
      t.string :class_name
      t.text :arguments
      t.string :queue_name
      t.integer :priority, default: 0
      t.boolean :static, default: true, null: false
      t.text :description
      t.datetime :created_at, null: false
      t.datetime :updated_at, null: false

      t.index [:key], name: "index_solid_queue_recurring_tasks_on_key", unique: true
      t.index [:static], name: "index_solid_queue_recurring_tasks_on_static"
    end

    create_table :solid_queue_semaphores do |t|
      t.string :key, null: false
      t.integer :value, default: 1, null: false
      t.datetime :expires_at, null: false
      t.datetime :created_at, null: false
      t.datetime :updated_at, null: false

      t.index [:expires_at], name: "index_solid_queue_semaphores_on_expires_at"
      t.index [:key, :value], name: "index_solid_queue_semaphores_on_key_and_value"
      t.index [:key], name: "index_solid_queue_semaphores_on_key", unique: true
    end

    add_foreign_key :solid_queue_blocked_executions, :solid_queue_jobs, column: :job_id, on_delete: :cascade
    add_foreign_key :solid_queue_claimed_executions, :solid_queue_jobs, column: :job_id, on_delete: :cascade
    add_foreign_key :solid_queue_failed_executions, :solid_queue_jobs, column: :job_id, on_delete: :cascade
    add_foreign_key :solid_queue_ready_executions, :solid_queue_jobs, column: :job_id, on_delete: :cascade
    add_foreign_key :solid_queue_recurring_executions, :solid_queue_jobs, column: :job_id, on_delete: :cascade
    add_foreign_key :solid_queue_scheduled_executions, :solid_queue_jobs, column: :job_id, on_delete: :cascade
  end
end
```

- [ ] **Step 3: Docker環境でマイグレーションが正常実行されることを確認**

```bash
docker compose exec backend bin/rails db:migrate:status
```

Expected: queue DBに対して `down  20260328000001  Create solid queue tables` が表示される

```bash
docker compose exec backend bin/rails db:migrate
```

Expected: マイグレーションが正常実行される

- [ ] **Step 4: コミット**

```bash
git add backend/db/queue_migrate/
git commit -m "chore: Solid Queueのマイグレーションファイルを追加 (#47)"
```

---

### Task 3: production.rb の queue_adapter を変更

**Files:**
- Modify: `backend/config/environments/production.rb:47-48`

- [ ] **Step 1: queue_adapter を :solid_queue に変更**

変更前:
```ruby
  # MVPではasyncアダプタを使用（Solid Queueの専用DBテーブル不要）
  config.active_job.queue_adapter = :async
```

変更後:
```ruby
  # Solid Queue: ジョブキューを既存PostgreSQLで管理（ADR-0008）
  config.active_job.queue_adapter = :solid_queue
```

- [ ] **Step 2: 既存テストが全てパスすることを確認**

```bash
docker compose exec backend bundle exec rspec
```

Expected: 全テストがパス（テスト環境のqueue_adapterは変更していないため影響なし）

- [ ] **Step 3: RuboCopがパスすることを確認**

```bash
docker compose exec backend bundle exec rubocop
```

Expected: 違反なし

- [ ] **Step 4: コミット**

```bash
git add backend/config/environments/production.rb
git commit -m "chore: 本番のqueue_adapterをasyncからsolid_queueに変更 (#47)"
```

---

### Task 4: deploy.sh に SOLID_QUEUE_IN_PUMA 環境変数を追加

**Files:**
- Modify: `infra/scripts/deploy.sh`

- [ ] **Step 1: SSM Parameter Store からの取得を追加**

`deploy.sh` の環境変数取得セクション（44行目付近）に追加:

```bash
FRONTEND_URL=$(get_param "FRONTEND_URL")
SOLID_QUEUE_IN_PUMA=$(get_param "SOLID_QUEUE_IN_PUMA")
```

- [ ] **Step 2: コンテナ起動コマンドに環境変数を追加**

`docker run` コマンド（63行目付近）に `-e SOLID_QUEUE_IN_PUMA="$SOLID_QUEUE_IN_PUMA"` を追加:

```bash
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p 80:3000 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e SECRET_KEY_BASE="$SECRET_KEY_BASE" \
  -e RAILS_MASTER_KEY="$RAILS_MASTER_KEY" \
  -e RAILS_ENV="$RAILS_ENV" \
  -e TMDB_API_KEY="$TMDB_API_KEY" \
  -e GOOGLE_BOOKS_API_KEY="$GOOGLE_BOOKS_API_KEY" \
  -e IGDB_CLIENT_ID="$IGDB_CLIENT_ID" \
  -e IGDB_CLIENT_SECRET="$IGDB_CLIENT_SECRET" \
  -e GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  -e GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
  -e FRONTEND_URL="$FRONTEND_URL" \
  -e SOLID_QUEUE_IN_PUMA="$SOLID_QUEUE_IN_PUMA" \
  -e RAILS_LOG_TO_STDOUT=1 \
  "${ECR_REGISTRY}/${APP_NAME}-backend:${IMAGE_TAG}"
```

注意: `db:prepare` の `docker run` コマンドには追加不要（マイグレーション時にSolid Queueワーカーは不要）。

- [ ] **Step 3: コミット**

```bash
git add infra/scripts/deploy.sh
git commit -m "chore: deploy.shにSOLID_QUEUE_IN_PUMA環境変数を追加 (#47)"
```

---

### Task 5: ADR-0008 を更新

**Files:**
- Modify: `docs/adr/0008-検索キャッシュにredisを採用.md:60`

- [ ] **Step 1: Solid Queue導入を完了に更新**

変更前:
```markdown
- Solid Queue導入（本番ジョブキューのasync → Solid Queue移行）— 未対応
```

変更後:
```markdown
- ✅ Solid Queue導入完了（Issue #47, 2026-03-28）— 本番ジョブキューを async → solid_queue に移行
```

- [ ] **Step 2: コミット**

```bash
git add docs/adr/0008-検索キャッシュにredisを採用.md
git commit -m "docs: ADR-0008のSolid Queue移行ステータスを更新 (#47)"
```

---

### Task 6: 最終確認

- [ ] **Step 1: CIと同じ方法で全テストを実行**

```bash
docker compose exec backend bundle exec rspec
docker compose exec backend bundle exec rubocop
```

Expected: 全テスト・リントがパス

- [ ] **Step 2: デプロイ前の手動確認事項をリスト化**

デプロイ時に必要な手順（コード変更外）:
1. SSM Parameter Store に `/recolly/production/SOLID_QUEUE_IN_PUMA` = `true` を追加
2. 通常通りデプロイ（`db:prepare` で queue テーブルが自動作成される）
3. デプロイ後、ログで `SolidQueue` の起動メッセージを確認
