# Faradayミドルウェア追加 設計スペック

## 概要

外部APIクライアント（Faraday）にタイムアウト設定、リトライミドルウェア、ログミドルウェアを追加する。

## 背景

- ADR-0009（改訂版）で「Faradayのミドルウェア機能が未活用」と記録済み
- 現状はタイムアウト未設定（デフォルト=無制限）、リトライなし、ログなし
- `safe_search` のエラーハンドリング（空配列を返す）で動作はしているが、本番運用の安定性向上のため追加する

## 関連

- Issue: #48
- ADR-0009: HTTPクライアントにFaradayを採用
- `backend/app/services/external_apis/base_adapter.rb`
- `backend/app/services/external_apis/igdb_adapter.rb`

## 設計

### アプローチ

`base_adapter.rb` の `connection` メソッドと `igdb_adapter.rb` の `igdb_connection` メソッドに直接ミドルウェアを追加する。別モジュールへの切り出しは行わない（2箇所のみで過剰な抽象化になるため）。

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `backend/Gemfile` | `faraday-retry` gem追加 |
| `backend/app/services/external_apis/base_adapter.rb` | `connection` メソッドにタイムアウト・リトライ・ログ追加 |
| `backend/app/services/external_apis/igdb_adapter.rb` | `igdb_connection` メソッドに同様の設定追加 |
| 各アダプタのspec | ミドルウェア動作のテスト追加 |

### ミドルウェア設定

#### タイムアウト

- `open_timeout: 5`（接続確立まで5秒）
- `timeout: 10`（レスポンス待ち10秒）

#### リトライ

- gem: `faraday-retry`
- 最大リトライ回数: 2回
- 対象ステータス: 500, 502, 503, 504
- リトライ間隔: デフォルト（1秒のバックオフ）
- `Faraday::TimeoutError` もリトライ対象（faraday-retryのデフォルト動作）

#### ログ

- `Faraday::Response::Logger` を使用
- ロガー: `Rails.logger`
- 開発環境: ヘッダー非表示、ボディ表示（デバッグ用）
- 本番環境: ヘッダー非表示、ボディ非表示（URL+ステータスコードのみ）

### ミドルウェアの順序

Faradayのミドルウェアはリクエスト時は上から下、レスポンス時は下から上に実行される。

```ruby
# base_adapter.rb
def connection(url:)
  Faraday.new(url: url) do |f|
    f.request :json
    f.request :retry, max: 2, retry_statuses: [500, 502, 503, 504]
    f.response :logger, Rails.logger, headers: false, bodies: !Rails.env.production?
    f.response :json
    f.adapter Faraday.default_adapter
  end
end
```

- `:retry` は `:json` の後（リトライ時にJSONエンコードが再実行される）
- `:logger` は `:json`（response）の前（生のレスポンスをログに記録）

```ruby
# igdb_adapter.rb（igdb_connectionも同様のミドルウェアを追加）
def igdb_connection
  Faraday.new(url: IGDB_URL) do |f|
    f.request :retry, max: 2, retry_statuses: [500, 502, 503, 504]
    f.response :logger, Rails.logger, headers: false, bodies: !Rails.env.production?
    f.response :json
    f.headers['Authorization'] = "Bearer #{access_token}"
    f.headers['Client-ID'] = ENV.fetch('IGDB_CLIENT_ID')
    f.adapter Faraday.default_adapter
  end
end
```

IGDBは `request :json` を使わない（独自クエリ言語のため）点は既存の設計を維持する。

### タイムアウト設定

`Faraday.new` のオプションとして設定する:

```ruby
Faraday.new(url: url, request: { open_timeout: 5, timeout: 10 }) do |f|
  # ...
end
```

`base_adapter.rb` と `igdb_adapter.rb` の両方に適用する。

### テスト方針

1. **既存テストの維持**: webmockでスタブ化されているため、ミドルウェア追加で既存テストが壊れないことを確認
2. **リトライ動作テスト**: 1回目500→2回目200で成功するケースをbase_adapterのspecに追加
3. **タイムアウト設定テスト**: connectionメソッドが正しいタイムアウト値を持つことを確認

## スコープ外

- アダプタごとのタイムアウト値カスタマイズ（全アダプタ共通で十分）
- リトライ回数のアダプタごとのカスタマイズ
- ログフォーマットのカスタマイズ（Faradayデフォルトで十分）
- サーキットブレーカーパターン（現時点では不要）
