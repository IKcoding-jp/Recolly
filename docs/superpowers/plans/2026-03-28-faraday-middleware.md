# Faradayミドルウェア追加 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 外部APIクライアント（Faraday）にタイムアウト・リトライ・ログのミドルウェアを追加し、本番運用の安定性を向上させる。

**Architecture:** `base_adapter.rb` の `connection` メソッドと `igdb_adapter.rb` の `igdb_connection` メソッドにミドルウェアを直接追加する。別モジュールへの切り出しは行わない。

**Tech Stack:** Ruby / Rails / Faraday / faraday-retry gem / RSpec / WebMock

**関連:** Issue #48 / ADR-0009 / スペック: `docs/superpowers/specs/2026-03-28-faraday-middleware-design.md`

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---------|------|------|
| `backend/Gemfile` | 変更 | `faraday-retry` gem追加 |
| `backend/app/services/external_apis/base_adapter.rb` | 変更 | `connection` メソッドにタイムアウト・リトライ・ログ追加 |
| `backend/app/services/external_apis/igdb_adapter.rb` | 変更 | `igdb_connection` メソッドに同様の設定追加 |
| `backend/spec/services/external_apis/tmdb_adapter_spec.rb` | 変更 | リトライ・タイムアウトのテスト追加 |
| `backend/spec/services/external_apis/igdb_adapter_spec.rb` | 変更 | リトライ・タイムアウトのテスト追加 |

---

### Task 1: faraday-retry gemの追加

**Files:**
- Modify: `backend/Gemfile:22`

- [ ] **Step 1: Gemfileに faraday-retry を追加**

`backend/Gemfile` の22行目 `gem 'faraday'` の下に追加:

```ruby
# HTTPクライアント（外部API通信用、ADR-0009）
gem 'faraday'
gem 'faraday-retry'
```

- [ ] **Step 2: bundle install を実行**

Run: `docker compose exec backend bundle install`
Expected: `faraday-retry` がインストールされ、`Gemfile.lock` が更新される

- [ ] **Step 3: コミット**

```bash
git add backend/Gemfile backend/Gemfile.lock
git commit -m "chore: faraday-retry gemを追加 (#48)"
```

---

### Task 2: base_adapter.rb にミドルウェア追加（TDD: TMDBアダプタ経由でテスト）

**Files:**
- Modify: `backend/spec/services/external_apis/tmdb_adapter_spec.rb`
- Modify: `backend/app/services/external_apis/base_adapter.rb:36-42`

- [ ] **Step 1: リトライのテストを書く**

`backend/spec/services/external_apis/tmdb_adapter_spec.rb` の `describe '#safe_search'` ブロックの前に以下を追加:

```ruby
  describe 'リトライミドルウェア' do
    it 'サーバーエラー時にリトライして成功する' do
      success_body = {
        'results' => [
          {
            'id' => 550,
            'title' => 'テスト映画',
            'overview' => 'テスト概要',
            'poster_path' => '/test.jpg',
            'media_type' => 'movie'
          }
        ]
      }

      stub_request(:get, /api.themoviedb.org/)
        .to_return(status: 500, body: '{}', headers: { 'Content-Type' => 'application/json' })
        .then.to_return(status: 200, body: success_body.to_json, headers: { 'Content-Type' => 'application/json' })

      results = adapter.search('テスト')
      expect(results.length).to eq(1)
      expect(results.first.title).to eq('テスト映画')
    end
  end
```

- [ ] **Step 2: タイムアウト設定のテストを書く**

同ファイルの `describe 'リトライミドルウェア'` の後に追加:

```ruby
  describe 'タイムアウト設定' do
    it 'open_timeout と timeout が設定されている' do
      conn = adapter.send(:tmdb_connection)
      expect(conn.options.open_timeout).to eq(5)
      expect(conn.options.timeout).to eq(10)
    end
  end
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `docker compose exec backend bundle exec rspec spec/services/external_apis/tmdb_adapter_spec.rb --format documentation`
Expected: 「リトライミドルウェア」と「タイムアウト設定」のテストが FAIL する

- [ ] **Step 4: base_adapter.rb にミドルウェアを実装**

`backend/app/services/external_apis/base_adapter.rb` の `connection` メソッドを以下に変更:

```ruby
    def connection(url:)
      Faraday.new(url: url, request: { open_timeout: 5, timeout: 10 }) do |f|
        f.request :json
        f.request :retry, max: 2, retry_statuses: [500, 502, 503, 504]
        f.response :logger, Rails.logger, headers: false, bodies: !Rails.env.production?
        f.response :json
        f.adapter Faraday.default_adapter
      end
    end
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `docker compose exec backend bundle exec rspec spec/services/external_apis/tmdb_adapter_spec.rb --format documentation`
Expected: 新規テスト含む全テストが PASS

- [ ] **Step 6: base_adapter.rb を使う他のアダプタテストも確認**

Run: `docker compose exec backend bundle exec rspec spec/services/external_apis/anilist_adapter_spec.rb spec/services/external_apis/google_books_adapter_spec.rb --format documentation`
Expected: 全テスト PASS（AniList, Google Booksは base_adapter の `connection` を使っている）

- [ ] **Step 7: コミット**

```bash
git add backend/app/services/external_apis/base_adapter.rb backend/spec/services/external_apis/tmdb_adapter_spec.rb
git commit -m "feat: base_adapterにタイムアウト・リトライ・ログミドルウェアを追加 (#48)"
```

---

### Task 3: igdb_adapter.rb にミドルウェア追加（TDD）

**Files:**
- Modify: `backend/spec/services/external_apis/igdb_adapter_spec.rb`
- Modify: `backend/app/services/external_apis/igdb_adapter.rb:39-50`

- [ ] **Step 1: リトライのテストを書く**

`backend/spec/services/external_apis/igdb_adapter_spec.rb` の `describe '#safe_search'` ブロックの前に以下を追加:

```ruby
  describe 'リトライミドルウェア' do
    it 'サーバーエラー時にリトライして成功する' do
      success_body = [
        {
          'id' => 1942,
          'name' => 'Test Game',
          'summary' => 'テストゲーム'
        }
      ]

      stub_request(:post, 'https://api.igdb.com/v4/games')
        .to_return(status: 500, body: '[]', headers: { 'Content-Type' => 'application/json' })
        .then.to_return(status: 200, body: success_body.to_json, headers: { 'Content-Type' => 'application/json' })

      results = adapter.search('Test')
      expect(results.length).to eq(1)
      expect(results.first.title).to eq('Test Game')
    end
  end
```

- [ ] **Step 2: タイムアウト設定のテストを書く**

同ファイルの `describe 'リトライミドルウェア'` の後に追加:

```ruby
  describe 'タイムアウト設定' do
    it 'open_timeout と timeout が設定されている' do
      conn = adapter.send(:igdb_connection)
      expect(conn.options.open_timeout).to eq(5)
      expect(conn.options.timeout).to eq(10)
    end
  end
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `docker compose exec backend bundle exec rspec spec/services/external_apis/igdb_adapter_spec.rb --format documentation`
Expected: 「リトライミドルウェア」と「タイムアウト設定」のテストが FAIL する

- [ ] **Step 4: igdb_adapter.rb にミドルウェアを実装**

`backend/app/services/external_apis/igdb_adapter.rb` の `igdb_connection` メソッドを以下に変更:

```ruby
    def igdb_connection
      token = access_token
      client_id = ENV.fetch('IGDB_CLIENT_ID')

      # IGDBはプレーンテキストのクエリ言語を使うため、request :json は使わない
      Faraday.new(url: IGDB_URL, request: { open_timeout: 5, timeout: 10 }) do |f|
        f.request :retry, max: 2, retry_statuses: [500, 502, 503, 504]
        f.response :logger, Rails.logger, headers: false, bodies: !Rails.env.production?
        f.response :json
        f.headers['Authorization'] = "Bearer #{token}"
        f.headers['Client-ID'] = client_id
        f.adapter Faraday.default_adapter
      end
    end
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `docker compose exec backend bundle exec rspec spec/services/external_apis/igdb_adapter_spec.rb --format documentation`
Expected: 新規テスト含む全テストが PASS

- [ ] **Step 6: コミット**

```bash
git add backend/app/services/external_apis/igdb_adapter.rb backend/spec/services/external_apis/igdb_adapter_spec.rb
git commit -m "feat: igdb_adapterにタイムアウト・リトライ・ログミドルウェアを追加 (#48)"
```

---

### Task 4: 全体検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 全アダプタテストを実行**

Run: `docker compose exec backend bundle exec rspec spec/services/external_apis/ --format documentation`
Expected: 全テスト PASS

- [ ] **Step 2: RuboCopを実行**

Run: `docker compose exec backend bundle exec rubocop app/services/external_apis/ spec/services/external_apis/`
Expected: 違反なし

- [ ] **Step 3: RuboCop違反があれば修正してコミット**

（違反がなければスキップ）
