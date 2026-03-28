# Solid Queue 移行設計

## 概要

本番環境のジョブキューアダプタを `:async` から `:solid_queue` に移行する。

## 背景

- ADR-0008で「Solidシリーズで統一」の方針を決定済み
- 現在の `:async` はプロセス内実行で、再起動時にキューが消失する
- Solid QueueはRails 8公式のジョブキューで、既存のPostgreSQLでジョブを管理する
- フェーズ3（コミュニティ機能、通知等）でバックグラウンドジョブが必要になる前にインフラを整備する

## 関連

- GitHub Issue: #47
- ADR-0008: キャッシュ戦略に環境別アプローチを採用
- 先行タスク: Solid Cache導入（Issue #46、完了済み）

## 現状

| 項目 | 状態 |
|------|------|
| `solid_queue` gem | インストール済み (v1.3.2) |
| `config/queue.yml` | 作成済み |
| `config/recurring.yml` | 作成済み |
| `config/puma.rb` の SOLID_QUEUE_IN_PUMA 設定 | 記述済み |
| `db/queue_schema.rb` | 存在する |
| マイグレーションファイル | 未生成 |
| `production.rb` の queue_adapter | `:async`（変更必要） |
| 実装ジョブクラス | なし（ApplicationJobのみ） |

## 変更内容

### 1. database.yml に queue DB設定を追加

Solid Cache と同じパターンで、同一物理DBに対してマイグレーションパスだけ分離する。

```yaml
# development, test, production の各環境に追加
queue:
  <<: *default
  database: recolly_<環境名>
  migrations_paths: db/queue_migrate
```

本番は `url: <%= ENV["DATABASE_URL"] %>` を使用。

### 2. マイグレーションファイル生成

`bin/rails solid_queue:install` でマイグレーションファイルを生成し、`db/queue_migrate/` に配置する。

生成されるテーブル（`db/queue_schema.rb` に定義済み）:
- `solid_queue_jobs`
- `solid_queue_ready_executions`
- `solid_queue_claimed_executions`
- `solid_queue_scheduled_executions`
- `solid_queue_blocked_executions`
- `solid_queue_failed_executions`
- `solid_queue_processes`
- `solid_queue_pauses`
- `solid_queue_recurring_tasks`
- `solid_queue_semaphores`

### 3. production.rb の queue_adapter 変更

```ruby
# 変更前
config.active_job.queue_adapter = :async

# 変更後
config.active_job.queue_adapter = :solid_queue
```

### 4. 本番環境変数の追加

SSM Parameter Store に `SOLID_QUEUE_IN_PUMA=true` を追加する。
これにより `config/puma.rb` の `plugin :solid_queue` が有効化され、Pumaプロセス内でSolid Queueワーカーが起動する。

### 5. ADR-0008 の更新

「現状と必要な移行作業」セクションのSolid Queue項目を完了に更新する。

## 変更しないもの

- `config/queue.yml` — 既に適切な設定が存在
- `config/recurring.yml` — 既に定期タスクが定義済み
- `config/puma.rb` — 既に環境変数制御が記述済み
- 開発・テスト環境の `queue_adapter` — 現状維持（デフォルトの `:async`）
- `deploy.sh` — `db:prepare` が全DB設定に対して自動実行するため変更不要
- ジョブクラスの実装 — 今回のスコープ外

## デプロイ手順

1. コードをデプロイ（マイグレーションファイル + production.rb変更を含む）
2. `db:prepare` で queue テーブルが自動作成される
3. SSM Parameter Store に `SOLID_QUEUE_IN_PUMA=true` を設定
4. Puma 再起動時に Solid Queue ワーカーが起動
5. 以降のジョブは Solid Queue 経由で実行される

## テスト方針

- マイグレーションの正常実行確認（Docker環境）
- 既存テストが全てパスすることの確認（リグレッション）
- 新規テストの追加は不要（ジョブクラスの実装がないため）
