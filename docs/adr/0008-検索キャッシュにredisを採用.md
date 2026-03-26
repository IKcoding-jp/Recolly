# ADR-0008: キャッシュ戦略に環境別アプローチを採用（開発Redis / 本番Solid Cache）

## ステータス
承認済み（2026-03-27改訂）

## 背景
作品検索機能では、外部API（TMDB, AniList, Google Books, IGDB）の検索結果をWorksテーブルに直接保存せず、ユーザーがライブラリに追加した時点でDB保存する方針とした。検索結果を一時的に保持するキャッシュ層が必要。

また、将来的にジョブキュー（バックグラウンド処理）やWebSocket（リアルタイム通知）でもキャッシュ基盤の選定が影響するため、長期的なコストとスケーラビリティも考慮する必要がある。

## 選択肢

### A案: Redis（全環境）
- **これは何か:** メモリ上にデータを保存する高速データベース。TTL（自動期限切れ）機能があり、キャッシュに適している。開発ではDocker Composeで、本番ではAWS ElastiCacheで運用する
- **長所:** 読み書きが最速（~1ms）。TTL・Pub/Sub・ジョブキュー（Sidekiq）等の多用途に対応。プロセス再起動でもキャッシュが残る。複数プロセスで共有可能
- **短所:** 本番環境に別途サーバーが必要。ElastiCache無料枠はAWSアカウント作成から12ヶ月間のみ。その後は月$12〜13のコストが発生。個人プロジェクトには固定費が重い

### B案: Rails.cache メモリストア（全環境）
- **これは何か:** Railsプロセスのメモリ内にキャッシュを保存する方式。追加サービス不要
- **長所:** 依存なし。設定が最もシンプル。コストゼロ
- **短所:** プロセス再起動でキャッシュが全て消える。複数プロセスでキャッシュ共有不可。メモリ使用量が増える

### C案: 環境別アプローチ（開発Redis / 本番Solid Cache）（採用）
- **これは何か:** 開発環境ではDocker ComposeのRedisを使い、本番環境ではSolid Cache（Rails 8の新機能で、キャッシュデータを既存のPostgreSQLに保存する仕組み）を使う方式
- **長所:** 本番の追加コストゼロ（既存RDSを使用）。追加インフラ不要。プロセス再起動でもキャッシュが残る。複数プロセスで共有可能。Rails 8公式機能。ジョブキュー（Solid Queue）やWebSocket（Solid Cable）も同じアプローチで統一できる
- **短所:** Redisより読み書きが遅い（~5-10ms）。ただしRecollyの外部API応答（数百ms〜数秒）がボトルネックのため体感差なし

### D案: Memcached
- **これは何か:** Redisと同じくメモリ上のキャッシュだが、キャッシュ専用（データ永続化やPub/Sub機能がない）
- **長所:** シンプル。キャッシュに特化
- **短所:** Redisより機能が少ない。本番でも別途サーバーが必要でコスト構造は同じ。2024年以降はRedisかSolid Cacheが主流

## 決定
**C案（開発Redis / 本番Solid Cache）を採用する。**

| 環境 | キャッシュストア | 理由 |
|------|----------------|------|
| 開発 | `redis_cache_store`（Docker Compose） | 開発の手軽さ優先。docker-compose.ymlに既にRedisサービスあり |
| 本番 | `solid_cache_store`（既存PostgreSQL） | 追加コスト・追加インフラなし |
| テスト | `null_store` | テストではキャッシュ無効 |

将来のジョブキュー・WebSocketも同じ「Solidシリーズ」で統一する方針:

| 機能 | 従来（Redis必要） | Recollyの方針（PostgreSQL） |
|------|-----------------|--------------------------|
| キャッシュ | ElastiCache | **Solid Cache** |
| ジョブキュー | Sidekiq（Redis必須） | **Solid Queue** |
| WebSocket | Action Cable + Redis | **Solid Cable**（フェーズ3で検討） |

## 理由
- **コスト:** 個人プロジェクトに月$12〜13の固定費（ElastiCache）を追加する必要がない。Solidシリーズなら既存のRDS PostgreSQLを使うため追加コストゼロ
- **速度差は体感できない:** Redisの読み書き~1ms vs PostgreSQL~5-10msの差は、外部API応答（200ms〜3秒）がボトルネックのRecollyでは無視できる
- **Rails 8の恩恵を最大化:** RecollyはRails 8を採用しており、Solidシリーズ（Cache, Queue, Cable）はRails 8の公式機能。Redis不要でフル機能のRailsアプリが動くことを目指した設計思想に沿う
- **将来の拡張性:** ジョブキュー（Solid Queue）やWebSocket（Solid Cable）も同じPostgreSQLベースで統一できる。新しいインフラを追加せずに機能拡張が可能
- **移行の容易さ:** 万が一Solidシリーズで性能が足りなくなった場合、`production.rb`のcache_store設定を変更するだけでElastiCacheに移行可能
- Redisは開発環境でのみ使用。Docker Composeで手軽に起動でき、本番との設定差異はRailsの環境別設定（environments/*.rb）で吸収する

## 現状と必要な移行作業
現在の本番環境は`memory_store`で動いており、Solid Cacheへの移行が未実施。以下のIssueで対応する:
- Solid Cache導入（本番キャッシュのmemory_store → Solid Cache移行）
- Solid Queue導入（本番ジョブキューのasync → Solid Queue移行）

## 影響
- 本番環境のキャッシュがPostgreSQLに保存されるため、RDSのストレージ使用量がわずかに増える（キャッシュデータ分）
- Solid CacheのマイグレーションでDBにテーブルが追加される
- 開発環境と本番環境でキャッシュストアが異なるため、キャッシュ関連のバグは本番環境固有で発生する可能性がある。CIテストでは`null_store`のため検出できない点に注意
- 将来ElastiCacheが必要になった場合の移行パスは確保されている（設定変更のみ）
