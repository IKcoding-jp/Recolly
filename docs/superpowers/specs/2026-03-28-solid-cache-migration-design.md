# 本番キャッシュをmemory_storeからSolid Cacheに移行

- **Issue**: #46
- **ステータス**: 承認済み
- **作成日**: 2026-03-28

## 概要

本番環境のキャッシュストアを `memory_store` から `solid_cache_store`（Solid Cache）に移行する。ADR-0008で決定した「開発Redis / 本番Solid Cache」の方針を完了させる。

## 背景

- ADR-0008で環境別キャッシュ戦略が承認済み
- 現在の本番は `memory_store` で動いており、プロセス再起動でキャッシュが消える
- Solid CacheはRails 8公式機能で、既存のPostgreSQLにキャッシュデータを保存する
- `solid_cache` gemはGemfileにインストール済み（v1.0.10）だが、マイグレーション未実行・設定未完了

## キャッシュ利用箇所

コード変更は不要。両サービスとも `Rails.cache` を使用しているため、cache_storeの設定変更のみで動作する。

| ファイル | 用途 | TTL |
|---------|------|-----|
| `app/services/work_search_service.rb` | 作品検索結果のキャッシュ | 30分 |
| `app/services/external_apis/igdb_adapter.rb` | Twitch OAuthトークンのキャッシュ | 50日 |

## 設計

### アプローチ

`bin/rails solid_cache:install` で公式インストーラーを使用してマイグレーションと設定を生成する。スキーマの互換性が保証される。

### 変更対象

#### 1. マイグレーション（自動生成）

`solid_cache:install` で `solid_cache_entries` テーブルのマイグレーションを生成・実行する。既存のPostgreSQLデータベース（primary）に作成する。別DBは設けない。

#### 2. `config/cache.yml`（書き換え）

Solid Cache用の設定に書き換える。

- `max_age`: 1週間（デフォルト）
- `max_size`: 256MB
- `namespace`: 環境名

#### 3. `config/environments/production.rb`（1行変更）

```ruby
# 変更前
config.cache_store = :memory_store

# 変更後
config.cache_store = :solid_cache_store
```

#### 4. `docs/adr/0008-検索キャッシュにredisを採用.md`（更新）

「現状と必要な移行作業」セクションを移行完了済みに更新する。

### 変更しないもの

- `WorkSearchService` / `IgdbAdapter` — `Rails.cache` を使っているのでコード変更不要
- `config/environments/development.rb` — `redis_cache_store` のまま維持
- `config/environments/test.rb` — `null_store` のまま維持
- `docker-compose.yml` — 開発環境に変更なし
- `Gemfile` — `solid_cache` は既にインストール済み

## テスト方針

- 本番環境の設定変更のみのため、ユニットテストの追加は不要
- 動作確認はデプロイ後にキャッシュが正しく保存・取得されることを確認
