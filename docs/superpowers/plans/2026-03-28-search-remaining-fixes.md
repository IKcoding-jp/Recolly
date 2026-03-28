# 検索機能の残存問題修正 — 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Issue #61 — Wikipedia検索のゲーム記事フィルタリング強化、IGDB発売年フィルタリング、AniList英語説明の日本語化改善の3点を修正する。

**Architecture:** WikipediaGameAdapterから共通のWikipedia操作をWikipediaClientクラスに切り出し、ゲーム記事のカテゴリチェック・IGDB発売年フィルタ・AniList説明文のWikipedia補完の3つの改善をそれぞれ独立して実装する。WikipediaClientはWikipediaGameAdapterとWorkSearchServiceの両方から利用される。

**Tech Stack:** Ruby 3.3 / Rails 8 / RSpec / WebMock / Faraday

---

## ファイル構成

| 操作 | ファイル | 責務 |
|------|---------|------|
| 新規 | `backend/app/services/external_apis/wikipedia_client.rb` | Wikipedia API汎用クライアント（検索・extract・langlinks・カテゴリ） |
| 新規 | `backend/spec/services/external_apis/wikipedia_client_spec.rb` | WikipediaClientのテスト |
| 変更 | `backend/app/services/external_apis/wikipedia_game_adapter.rb` | WikipediaClientに委譲 + カテゴリフィルタ追加 |
| 変更 | `backend/spec/services/external_apis/wikipedia_game_adapter_spec.rb` | カテゴリフィルタのテスト追加、WikipediaClientモック化 |
| 変更 | `backend/app/services/external_apis/igdb_adapter.rb` | 発売年抽出 + 年フィルタ追加 |
| 変更 | `backend/spec/services/external_apis/igdb_adapter_spec.rb` | 発売年フィルタのテスト追加 |
| 変更 | `backend/app/services/work_search_service.rb` | TMDB複数パターン検索 + Wikipedia補完 |
| 変更 | `backend/spec/services/work_search_service_spec.rb` | 複数パターン検索・Wikipedia補完のテスト追加 |

---

## Task 1: WikipediaClientクラスの作成

WikipediaGameAdapterから共通のWikipedia操作を切り出し、新しいWikipediaClientクラスを作成する。カテゴリ取得メソッドも追加する。

**Files:**
- Create: `backend/app/services/external_apis/wikipedia_client.rb`
- Create: `backend/spec/services/external_apis/wikipedia_client_spec.rb`

### Step 1-1: WikipediaClient#search のテストを書く

- [ ] `backend/spec/services/external_apis/wikipedia_client_spec.rb` を作成し、`search` メソッドのテストを書く。

```ruby
# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::WikipediaClient, type: :service do
  subject(:client) { described_class.new }

  describe '#search' do
    let(:search_response) do
      {
        'query' => {
          'search' => [
            { 'title' => 'ゼルダの伝説 ブレス オブ ザ ワイルド', 'snippet' => 'ゲーム' },
            { 'title' => 'ゼルダの伝説 ティアーズ オブ ザ キングダム', 'snippet' => 'ゲーム' },
            { 'title' => 'ゼルダ (ゲームキャラクター)', 'snippet' => 'キャラクター' }
          ]
        }
      }
    end

    before do
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: search_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it 'Wikipediaの検索結果からタイトル一覧を返す' do
      titles = client.search('ゼルダ')
      expect(titles).to contain_exactly(
        'ゼルダの伝説 ブレス オブ ザ ワイルド',
        'ゼルダの伝説 ティアーズ オブ ザ キングダム',
        'ゼルダ (ゲームキャラクター)'
      )
    end

    it 'API通信エラー時に空配列を返す' do
      stub_request(:get, /ja.wikipedia.org/).to_timeout
      expect(client.search('テスト')).to eq([])
    end
  end
end
```

- [ ] テストを実行して失敗を確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/wikipedia_client_spec.rb -fd`
Expected: FAIL（`WikipediaClient` クラスが存在しない）

### Step 1-2: WikipediaClient#search を実装する

- [ ] `backend/app/services/external_apis/wikipedia_client.rb` を作成する。

```ruby
# frozen_string_literal: true

module ExternalApis
  # 日本語Wikipedia APIの汎用クライアント
  # 検索、記事概要取得、言語間リンク取得、カテゴリ取得を提供する
  # WikipediaGameAdapterやWorkSearchServiceから利用される
  class WikipediaClient
    ENDPOINT = 'https://ja.wikipedia.org/w/api.php'
    USER_AGENT = 'Recolly/1.0 (https://github.com/IKcoding-jp/Recolly)'

    # キーワード検索でタイトル一覧を返す
    def search(query, limit: 10)
      response = connection.get('', search_params(query, limit))
      results = response.body.dig('query', 'search') || []
      results.pluck('title')
    rescue Faraday::Error => e
      Rails.logger.error("[WikipediaClient] 検索エラー: #{e.message}")
      []
    end

    private

    def connection
      @connection ||= Faraday.new(
        url: ENDPOINT, request: { open_timeout: 5, timeout: 10 }
      ) do |f|
        f.response :json
        f.headers['User-Agent'] = USER_AGENT
        f.adapter Faraday.default_adapter
      end
    end

    def search_params(query, limit)
      { action: 'query', list: 'search', srsearch: query, srlimit: limit, format: 'json' }
    end
  end
end
```

- [ ] テストを実行してパスを確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/wikipedia_client_spec.rb -fd`
Expected: PASS

### Step 1-3: fetch_extract のテストを書く

- [ ] `wikipedia_client_spec.rb` に `fetch_extract` のテストを追加する。

```ruby
  describe '#fetch_extract' do
    let(:extract_response) do
      {
        'query' => {
          'pages' => {
            '12345' => {
              'title' => 'けいおん!',
              'extract' => 'けいおん!は、かきふらいによる日本の4コマ漫画作品。'
            }
          }
        }
      }
    end

    before do
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: extract_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it '記事の冒頭テキストを返す' do
      extract = client.fetch_extract('けいおん!')
      expect(extract).to eq('けいおん!は、かきふらいによる日本の4コマ漫画作品。')
    end

    it '記事が存在しない場合はnilを返す' do
      not_found = { 'query' => { 'pages' => { '-1' => { 'missing' => '' } } } }
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: not_found.to_json,
                   headers: { 'Content-Type' => 'application/json' })
      expect(client.fetch_extract('存在しないページ')).to be_nil
    end

    it 'API通信エラー時にnilを返す' do
      stub_request(:get, /ja.wikipedia.org/).to_timeout
      expect(client.fetch_extract('テスト')).to be_nil
    end
  end
```

- [ ] テストを実行して失敗を確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/wikipedia_client_spec.rb -fd`
Expected: FAIL（`fetch_extract` メソッドが存在しない）

### Step 1-4: fetch_extract を実装する

- [ ] `wikipedia_client.rb` に `fetch_extract` メソッドを追加する。`search` メソッドの下に追加：

```ruby
    # 記事の冒頭テキスト（概要）を取得する
    def fetch_extract(title)
      response = connection.get('', extract_params(title))
      pages = response.body.dig('query', 'pages') || {}
      page = pages.values.first
      return nil if page.nil? || page.key?('missing')

      page['extract'].presence
    rescue Faraday::Error => e
      Rails.logger.error("[WikipediaClient] 概要取得エラー: #{e.message}")
      nil
    end
```

`private` セクションに `extract_params` を追加：

```ruby
    def extract_params(title)
      { action: 'query', titles: title, prop: 'extracts', exintro: true,
        explaintext: true, format: 'json' }
    end
```

- [ ] テストを実行してパスを確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/wikipedia_client_spec.rb -fd`
Expected: PASS

### Step 1-5: fetch_english_title のテストを書く

- [ ] `wikipedia_client_spec.rb` に `fetch_english_title` のテストを追加する。

```ruby
  describe '#fetch_english_title' do
    let(:langlink_response) do
      {
        'query' => {
          'pages' => {
            '12345' => {
              'title' => 'バイオハザード RE:2',
              'langlinks' => [{ 'lang' => 'en', '*' => 'Resident Evil 2 (2019 video game)' }]
            }
          }
        }
      }
    end

    before do
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: langlink_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it '日本語Wikipediaの言語間リンクから英語タイトルを返す' do
      en_title = client.fetch_english_title('バイオハザード RE:2')
      expect(en_title).to eq('Resident Evil 2 (2019 video game)')
    end

    it '英語版記事がない場合はnilを返す' do
      no_langlink = { 'query' => { 'pages' => { '99' => { 'title' => 'テスト', 'langlinks' => [] } } } }
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: no_langlink.to_json,
                   headers: { 'Content-Type' => 'application/json' })
      expect(client.fetch_english_title('日本語のみの記事')).to be_nil
    end

    it 'API通信エラー時にnilを返す' do
      stub_request(:get, /ja.wikipedia.org/).to_timeout
      expect(client.fetch_english_title('テスト')).to be_nil
    end
  end
```

- [ ] テストを実行して失敗を確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/wikipedia_client_spec.rb -fd`
Expected: FAIL（`fetch_english_title` メソッドが存在しない）

### Step 1-6: fetch_english_title を実装する

- [ ] `wikipedia_client.rb` に `fetch_english_title` メソッドと `langlink_params` を追加する。

```ruby
    # 日本語Wikipediaの言語間リンクから英語タイトルを取得する
    def fetch_english_title(title)
      response = connection.get('', langlink_params(title))
      pages = response.body.dig('query', 'pages') || {}
      page = pages.values.first
      langlinks = page&.dig('langlinks') || []
      langlinks.first&.dig('*')
    rescue Faraday::Error => e
      Rails.logger.error("[WikipediaClient] 英語タイトル取得エラー: #{e.message}")
      nil
    end
```

```ruby
    def langlink_params(title)
      { action: 'query', titles: title, prop: 'langlinks', lllang: 'en', format: 'json' }
    end
```

- [ ] テストを実行してパスを確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/wikipedia_client_spec.rb -fd`
Expected: PASS

### Step 1-7: fetch_categories のテストを書く

- [ ] `wikipedia_client_spec.rb` に `fetch_categories` のテストを追加する。

```ruby
  describe '#fetch_categories' do
    let(:categories_response) do
      {
        'query' => {
          'pages' => {
            '111' => {
              'title' => 'ゼルダの伝説 ブレス オブ ザ ワイルド',
              'categories' => [
                { 'ns' => 14, 'title' => 'Category:2017年のコンピュータゲーム' },
                { 'ns' => 14, 'title' => 'Category:Nintendo Switchのゲームソフト' }
              ]
            },
            '222' => {
              'title' => 'ゼルダ (ゲームキャラクター)',
              'categories' => [
                { 'ns' => 14, 'title' => 'Category:ゼルダの伝説の登場人物' }
              ]
            }
          }
        }
      }
    end

    before do
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: categories_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it '複数タイトルのカテゴリをハッシュで返す' do
      result = client.fetch_categories(['ゼルダの伝説 ブレス オブ ザ ワイルド', 'ゼルダ (ゲームキャラクター)'])
      expect(result.keys).to contain_exactly(
        'ゼルダの伝説 ブレス オブ ザ ワイルド',
        'ゼルダ (ゲームキャラクター)'
      )
      expect(result['ゼルダの伝説 ブレス オブ ザ ワイルド']).to include('Category:2017年のコンピュータゲーム')
      expect(result['ゼルダ (ゲームキャラクター)']).not_to include(a_string_matching(/ゲームソフト/))
    end

    it 'API通信エラー時に空ハッシュを返す' do
      stub_request(:get, /ja.wikipedia.org/).to_timeout
      expect(client.fetch_categories(['テスト'])).to eq({})
    end
  end
```

- [ ] テストを実行して失敗を確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/wikipedia_client_spec.rb -fd`
Expected: FAIL（`fetch_categories` メソッドが存在しない）

### Step 1-8: fetch_categories を実装する

- [ ] `wikipedia_client.rb` に `fetch_categories` メソッドと `categories_params` を追加する。

```ruby
    # 複数タイトルのカテゴリを一括取得する
    # 戻り値: { "タイトル" => ["Category:カテゴリ名", ...], ... }
    def fetch_categories(titles)
      joined = Array(titles).join('|')
      response = connection.get('', categories_params(joined))
      pages = response.body.dig('query', 'pages') || {}

      pages.each_with_object({}) do |(_, page), result|
        next if page.key?('missing')

        title = page['title']
        categories = (page['categories'] || []).map { |c| c['title'] }
        result[title] = categories
      end
    rescue Faraday::Error => e
      Rails.logger.error("[WikipediaClient] カテゴリ取得エラー: #{e.message}")
      {}
    end
```

```ruby
    def categories_params(titles)
      { action: 'query', titles: titles, prop: 'categories', cllimit: 50, format: 'json' }
    end
```

- [ ] テストを実行してパスを確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/wikipedia_client_spec.rb -fd`
Expected: PASS

### Step 1-9: コミット

- [ ] コミットする。

```bash
git add backend/app/services/external_apis/wikipedia_client.rb backend/spec/services/external_apis/wikipedia_client_spec.rb
git commit -m "feat: WikipediaClientクラスを作成（共通Wikipedia操作を集約） (#61)"
```

---

## Task 2: WikipediaGameAdapterのリファクタリング + カテゴリフィルタ追加

WikipediaGameAdapterをWikipediaClientに委譲する形にリファクタリングし、カテゴリによるゲーム記事フィルタを追加する。

**Files:**
- Modify: `backend/app/services/external_apis/wikipedia_game_adapter.rb`
- Modify: `backend/spec/services/external_apis/wikipedia_game_adapter_spec.rb`

### Step 2-1: カテゴリフィルタのテストを書く

- [ ] `wikipedia_game_adapter_spec.rb` を書き換える。WikipediaClientをモック化し、カテゴリフィルタのテストを追加する。ファイル全体を以下に置き換える：

```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ExternalApis::WikipediaGameAdapter, type: :service do
  subject(:adapter) { described_class.new }

  let(:client_double) { instance_double(ExternalApis::WikipediaClient) }

  before do
    allow(ExternalApis::WikipediaClient).to receive(:new).and_return(client_double)
  end

  describe '#search_titles' do
    before do
      allow(client_double).to receive(:search).and_return(
        ['ゼルダの伝説 ブレス オブ ザ ワイルド', '金熊賞', 'スタジオジブリ',
         'ゼルダの伝説 ティアーズ オブ ザ キングダム', 'ゼルダ (ゲームキャラクター)']
      )
      allow(client_double).to receive(:fetch_categories).and_return(
        {
          'ゼルダの伝説 ブレス オブ ザ ワイルド' => [
            'Category:2017年のコンピュータゲーム', 'Category:Nintendo Switchのゲームソフト'
          ],
          '金熊賞' => ['Category:ベルリン国際映画祭', 'Category:映画の賞'],
          'スタジオジブリ' => ['Category:日本のアニメスタジオ'],
          'ゼルダの伝説 ティアーズ オブ ザ キングダム' => [
            'Category:2023年のコンピュータゲーム', 'Category:Nintendo Switchのゲームソフト'
          ],
          'ゼルダ (ゲームキャラクター)' => ['Category:ゼルダの伝説の登場人物']
        }
      )
    end

    it 'ゲームカテゴリを持つ記事だけを返す' do
      titles = adapter.search_titles('ゼルダ')
      expect(titles).to contain_exactly(
        'ゼルダの伝説 ブレス オブ ザ ワイルド',
        'ゼルダの伝説 ティアーズ オブ ザ キングダム'
      )
    end

    it 'ゲーム以外の記事（金熊賞、スタジオジブリ等）を除外する' do
      titles = adapter.search_titles('ゼルダ')
      expect(titles).not_to include('金熊賞', 'スタジオジブリ', 'ゼルダ (ゲームキャラクター)')
    end

    it 'タイトルパターンでも事前フィルタする（テレビアニメ等）' do
      allow(client_double).to receive(:search).and_return(
        ['星のカービィ (アニメ)', '星のカービィ スーパーデラックス']
      )
      # 「星のカービィ (アニメ)」はNON_GAME_PATTERNSで除外されるため、カテゴリ取得は1件のみ
      allow(client_double).to receive(:fetch_categories).and_return(
        { '星のカービィ スーパーデラックス' => ['Category:1996年のコンピュータゲーム'] }
      )
      titles = adapter.search_titles('カービィ')
      expect(titles).to eq(['星のカービィ スーパーデラックス'])
    end

    it '検索クエリと完全一致するタイトルを除外する（曖昧さ回避ページ対策）' do
      allow(client_double).to receive(:search).and_return(['ゼルダ', 'ゼルダの伝説'])
      allow(client_double).to receive(:fetch_categories).and_return(
        { 'ゼルダの伝説' => ['Category:ゲーム作品'] }
      )
      titles = adapter.search_titles('ゼルダ')
      expect(titles).to eq(['ゼルダの伝説'])
    end

    it 'カテゴリ取得でエラーが発生した場合は空配列を返す' do
      allow(client_double).to receive(:fetch_categories).and_return({})
      titles = adapter.search_titles('ゼルダ')
      expect(titles).to eq([])
    end
  end

  describe '#fetch_english_title' do
    it 'WikipediaClientに委譲する' do
      allow(client_double).to receive(:fetch_english_title)
        .with('バイオハザード RE:2').and_return('Resident Evil 2 (2019 video game)')
      expect(adapter.fetch_english_title('バイオハザード RE:2')).to eq('Resident Evil 2 (2019 video game)')
    end
  end

  describe '#fetch_extract' do
    it 'WikipediaClientに委譲する' do
      allow(client_double).to receive(:fetch_extract)
        .with('星のカービィ').and_return('任天堂が発売したアクションゲーム。')
      expect(adapter.fetch_extract('星のカービィ')).to eq('任天堂が発売したアクションゲーム。')
    end
  end
end
```

- [ ] テストを実行して失敗を確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/wikipedia_game_adapter_spec.rb -fd`
Expected: FAIL（WikipediaGameAdapterがまだリファクタリングされていない）

### Step 2-2: WikipediaGameAdapterをリファクタリングする

- [ ] `wikipedia_game_adapter.rb` を以下に書き換える：

```ruby
# frozen_string_literal: true

module ExternalApis
  # WikipediaClientを使い、ゲーム記事のみをフィルタリングして返す補完アダプター
  # BaseAdapterを継承しない（単独で検索結果を返さず、IgdbAdapterの補完として使う）
  class WikipediaGameAdapter
    # タイトルベースの除外パターン（カテゴリチェック前の事前フィルタ）
    NON_GAME_PATTERNS = /キャラクター|シリーズ|曖昧さ回避|登場人物|一覧|映画|テレビアニメ|劇場版|小説|ドラマ/
    # ゲーム関連カテゴリの判定パターン
    GAME_CATEGORY_PATTERNS = /コンピュータゲーム|ゲームソフト|ビデオゲーム|ゲーム作品|アーケードゲーム|モバイルゲーム/

    def initialize
      @client = WikipediaClient.new
    end

    # 日本語Wikipediaでキーワード検索し、ゲームソフトの記事タイトルのみ返す
    # ① タイトルパターンで事前フィルタ → ② カテゴリチェックでゲーム記事のみ通す
    def search_titles(query)
      titles = @client.search(query)
      filtered = titles.reject { |title| excluded_title?(title, query) }
      filter_by_game_categories(filtered)
    end

    delegate :fetch_english_title, :fetch_extract, to: :@client

    private

    def excluded_title?(title, query)
      return true if title.match?(NON_GAME_PATTERNS)
      return true if title == query

      false
    end

    # Wikipediaカテゴリでゲーム記事かどうかを判定し、ゲーム記事のみ返す
    def filter_by_game_categories(titles)
      return [] if titles.empty?

      categories_map = @client.fetch_categories(titles)
      titles.select { |title| game_article?(categories_map[title]) }
    end

    def game_article?(categories)
      return false if categories.nil? || categories.empty?

      categories.any? { |cat| cat.match?(GAME_CATEGORY_PATTERNS) }
    end
  end
end
```

- [ ] テストを実行してパスを確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/wikipedia_game_adapter_spec.rb -fd`
Expected: PASS

### Step 2-3: 既存のIgdbAdapter テストが壊れていないか確認する

- [ ] IgdbAdapterのテストを実行して、WikipediaGameAdapterのリファクタリングが既存のテストに影響していないか確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/igdb_adapter_spec.rb -fd`
Expected: PASS（IgdbAdapterのテストではWikipediaGameAdapterをモック化しているため影響なし）

### Step 2-4: コミット

- [ ] コミットする。

```bash
git add backend/app/services/external_apis/wikipedia_game_adapter.rb backend/spec/services/external_apis/wikipedia_game_adapter_spec.rb
git commit -m "fix: WikipediaGameAdapterにカテゴリフィルタを追加（ゲーム以外の記事混入を防止） (#61)"
```

---

## Task 3: IgdbAdapterの発売年フィルタリング

Wikipedia英語タイトルの括弧から発売年を抽出し、IGDB検索結果を年でフィルタリングする。

**Files:**
- Modify: `backend/app/services/external_apis/igdb_adapter.rb`
- Modify: `backend/spec/services/external_apis/igdb_adapter_spec.rb`

### Step 3-1: 発売年フィルタのテストを書く

- [ ] `igdb_adapter_spec.rb` に発売年フィルタのテストを追加する。既存の `'日本語クエリ + Wikipedia補完'` コンテキストの後に追加：

```ruby
  describe '発売年によるリメイク版・原作版の区別' do
    let(:wikipedia_double) { instance_double(ExternalApis::WikipediaGameAdapter) }

    # 1998年のオリジナル版と2019年のリメイク版
    let(:igdb_multiple_versions) do
      [
        {
          'id' => 732,
          'name' => 'Resident Evil 2',
          'summary' => 'Original 1998 version',
          'cover' => { 'image_id' => 'co1abc' },
          'first_release_date' => 885_427_200, # 1998-01-21
          'total_rating' => 85.0
        },
        {
          'id' => 19_686,
          'name' => 'Resident Evil 2',
          'summary' => '2019 remake version',
          'cover' => { 'image_id' => 'co2def' },
          'first_release_date' => 1_548_374_400, # 2019-01-25
          'total_rating' => 92.0
        }
      ]
    end

    before do
      allow(ExternalApis::WikipediaGameAdapter).to receive(:new).and_return(wikipedia_double)
      allow(wikipedia_double).to receive(:search_titles).and_return(['バイオハザード RE:2'])
      allow(wikipedia_double).to receive(:fetch_extract).and_return('カプコンのサバイバルホラーゲーム。')
    end

    context '括弧に発売年がある場合' do
      before do
        allow(wikipedia_double).to receive(:fetch_english_title)
          .with('バイオハザード RE:2').and_return('Resident Evil 2 (2019 video game)')

        # 1回目・2回目: IGDB直接検索（日本語）→ 0件
        # 3回目: Wikipedia経由でIGDB再検索 → 2件（1998版 + 2019版）
        stub_request(:post, 'https://api.igdb.com/v4/games')
          .to_return(
            { status: 200, body: [].to_json, headers: { 'Content-Type' => 'application/json' } },
            { status: 200, body: [].to_json, headers: { 'Content-Type' => 'application/json' } },
            { status: 200, body: igdb_multiple_versions.to_json,
              headers: { 'Content-Type' => 'application/json' } }
          )
      end

      it '発売年が一致するリメイク版（2019年）を優先して返す' do
        results = adapter.search('バイオハザードRE:2')
        expect(results.length).to eq(1)
        expect(results.first.external_api_id).to eq('19686')
        expect(results.first.description).to eq('カプコンのサバイバルホラーゲーム。')
      end
    end

    context '括弧に発売年がない場合' do
      before do
        allow(wikipedia_double).to receive(:fetch_english_title)
          .with('バイオハザード RE:2').and_return('Resident Evil 2')

        stub_request(:post, 'https://api.igdb.com/v4/games')
          .to_return(
            { status: 200, body: [].to_json, headers: { 'Content-Type' => 'application/json' } },
            { status: 200, body: [].to_json, headers: { 'Content-Type' => 'application/json' } },
            { status: 200, body: igdb_multiple_versions.to_json,
              headers: { 'Content-Type' => 'application/json' } }
          )
      end

      it '最初のマッチ（人気順の先頭）を返す' do
        results = adapter.search('バイオハザードRE:2')
        expect(results.length).to eq(1)
        expect(results.first.external_api_id).to eq('732')
      end
    end
  end
```

- [ ] テストを実行して失敗を確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/igdb_adapter_spec.rb:'発売年' -fd`
Expected: FAIL（発売年フィルタが未実装のため、2019年版ではなく最初のマッチ=1998年版が返る）

### Step 3-2: 発売年フィルタを実装する

- [ ] `igdb_adapter.rb` の `igdb_match_from_wikipedia` メソッドを以下に書き換える：

```ruby
    # Wikipedia言語間リンクで英語タイトル取得 → IGDBで検索
    # 括弧内の発売年を利用して、リメイク版と原作版を区別する
    def igdb_match_from_wikipedia(jp_title, wikipedia, existing_ids = Set.new)
      en_title = wikipedia.fetch_english_title(jp_title)
      return nil unless en_title

      # 括弧から発売年を抽出: "Resident Evil 2 (2019 video game)" → 2019
      release_year = en_title.match(/\((\d{4})/)?.[1]&.to_i
      # 括弧を除去: "Resident Evil 2 (2019 video game)" → "Resident Evil 2"
      clean_title = en_title.sub(/\s*\(.*\)\s*$/, '')
      sanitized = clean_title.gsub('"', '\\"').gsub(';', '')

      candidates = search_by_keyword(sanitized).reject { |r| existing_ids.include?(r.external_api_id) }
      return nil if candidates.empty?

      # 発売年がある場合、年が一致するエントリを優先（なければ最初のマッチにフォールバック）
      if release_year
        candidates.find { |r| game_release_year(r) == release_year } || candidates.first
      else
        candidates.first
      end
    end
```

- [ ] 同ファイルの `private` セクション内（`japanese?` メソッドの後など）に `game_release_year` メソッドを追加する：

```ruby
    # IGDBのfirst_release_date（UNIXタイムスタンプ）から年を取得
    def game_release_year(result)
      timestamp = result.metadata[:first_release_date]
      return nil unless timestamp

      Time.at(timestamp).utc.year
    end
```

- [ ] テストを実行してパスを確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/igdb_adapter_spec.rb -fd`
Expected: PASS（新規テスト + 既存テスト両方）

### Step 3-3: コミット

- [ ] コミットする。

```bash
git add backend/app/services/external_apis/igdb_adapter.rb backend/spec/services/external_apis/igdb_adapter_spec.rb
git commit -m "fix: IGDB検索に発売年フィルタを追加（リメイク版と原作版を区別） (#61)"
```

---

## Task 4: WorkSearchServiceのAniList説明文改善

TMDB検索を複数パターン対応にし、Wikipedia補完を追加する。

**Files:**
- Modify: `backend/app/services/work_search_service.rb`
- Modify: `backend/spec/services/work_search_service_spec.rb`

### Step 4-1: TMDB複数パターン検索のテストを書く

- [ ] `work_search_service_spec.rb` の `'AniList日本語説明補完'` describeブロックの `before` ブロックに、WikipediaClientのデフォルトモック（nilを返す）を追加する。これはStep 4-4でWikipedia補完を追加した際に、既存テストがHTTPエラーにならないようにするため。

```ruby
    # 既存のbeforeブロック内に追加（allow(anilist_double) の後）:
    let(:wikipedia_client_double) { instance_double(ExternalApis::WikipediaClient) }

    before do
      allow(anilist_double).to receive(:safe_search).and_return([anilist_result])
      # Wikipedia補完のデフォルト（見つからない場合）
      allow(ExternalApis::WikipediaClient).to receive(:new).and_return(wikipedia_client_double)
      allow(wikipedia_client_double).to receive(:fetch_extract).and_return(nil)
    end
```

- [ ] 同ブロック内の `'英語タイトルがない場合はローマ字タイトルで検索する'` テストの後に、複数パターン検索のテストを追加する：

```ruby
    it '英語タイトルで見つからない場合、ローマ字→日本語の順にフォールバックする' do # rubocop:disable RSpec/ExampleLength
      keion_result = ExternalApis::BaseAdapter::SearchResult.new(
        'けいおん!', 'anime', 'K-ON! is a Japanese manga series.',
        nil, 13, '5680', 'anilist',
        { popularity: 0.7, title_english: 'K-ON!', title_romaji: 'K-ON!' }
      )
      allow(anilist_double).to receive(:safe_search).and_return([keion_result])
      # 英語「K-ON!」→ nil、ローマ字「K-ON!」→ nil（同じなのでスキップ）、日本語「けいおん!」→ ヒット
      allow(tmdb_double).to receive(:fetch_japanese_description).with('K-ON!').and_return(nil)
      allow(tmdb_double).to receive(:fetch_japanese_description)
        .with('けいおん!').and_return('軽音部の日常を描いた作品')

      results = service.search('けいおん')
      expect(results.first.description).to eq('軽音部の日常を描いた作品')
    end
```

- [ ] テストを実行して失敗を確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/work_search_service_spec.rb:'フォールバック' -fd`
Expected: FAIL（現在は `title_english || title_romaji || title` で1パターンしか試さないため、日本語タイトルでの検索が実行されない）

### Step 4-2: TMDB複数パターン検索を実装する

- [ ] `work_search_service.rb` の `enrich_anilist_descriptions` メソッドと、新しいprivateメソッド `fetch_japanese_description_from_tmdb` を書き換える：

`enrich_anilist_descriptions` を以下に置き換え：

```ruby
  # AniListの結果にTMDB→Wikipediaの順で日本語説明を補完する
  # AniListの説明は英語のため、日本語の説明が見つかれば置き換える
  def enrich_anilist_descriptions(results)
    anilist_results = results.select { |r| r.external_api_source == 'anilist' }
    return if anilist_results.empty?

    tmdb = ExternalApis::TmdbAdapter.new
    anilist_results.each do |result|
      # ① TMDB検索（英語→ローマ字→日本語の順で複数パターンを試す）
      description = fetch_japanese_description_from_tmdb(result, tmdb)
      result.description = description if description.present?
    end
  end
```

新しいprivateメソッドを追加：

```ruby
  # TMDBで日本語説明を検索（複数パターンを順番に試す）
  def fetch_japanese_description_from_tmdb(result, tmdb)
    queries = [
      result.metadata[:title_english],
      result.metadata[:title_romaji],
      result.title
    ].compact.uniq

    queries.each do |query|
      description = tmdb.fetch_japanese_description(query)
      return description if description.present?
    end
    nil
  end
```

- [ ] テストを実行してパスを確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/work_search_service_spec.rb -fd`
Expected: PASS（新規テスト + 既存テスト両方）

### Step 4-3: Wikipedia補完のテストを書く

- [ ] `work_search_service_spec.rb` の `'AniList日本語説明補完'` describeブロック内に、Wikipedia補完のテストを追加する：

```ruby
    context 'TMDBで見つからない場合のWikipedia補完' do # rubocop:disable RSpec/MultipleMemoizedHelpers
      let(:minor_anime) do
        ExternalApis::BaseAdapter::SearchResult.new(
          'マイナーアニメ', 'anime', 'A minor anime series.',
          nil, 12, '99999', 'anilist',
          { popularity: 0.1, title_english: 'Minor Anime', title_romaji: 'Minor Anime' }
        )
      end

      before do
        allow(anilist_double).to receive(:safe_search).and_return([minor_anime])
        allow(tmdb_double).to receive(:fetch_japanese_description).and_return(nil)
      end

      it 'TMDBで見つからない場合、Wikipediaから日本語説明を取得する' do
        allow(wikipedia_client_double).to receive(:fetch_extract)
          .with('マイナーアニメ').and_return('マイナーアニメは、日本のテレビアニメ作品。')

        results = service.search('マイナーアニメ')
        expect(results.first.description).to eq('マイナーアニメは、日本のテレビアニメ作品。')
      end

      it 'TMDBでもWikipediaでも見つからない場合、英語説明をそのまま使う' do
        allow(wikipedia_client_double).to receive(:fetch_extract)
          .with('マイナーアニメ').and_return(nil)

        results = service.search('マイナーアニメ')
        expect(results.first.description).to eq('A minor anime series.')
      end
    end
```

- [ ] テストを実行して失敗を確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/work_search_service_spec.rb:'Wikipedia補完' -fd`
Expected: FAIL（Wikipedia補完が未実装）

### Step 4-4: Wikipedia補完を実装する

- [ ] `work_search_service.rb` の `enrich_anilist_descriptions` メソッドにWikipedia補完を追加する。メソッドを以下に置き換え：

```ruby
  # AniListの結果にTMDB→Wikipediaの順で日本語説明を補完する
  # AniListの説明は英語のため、日本語の説明が見つかれば置き換える
  def enrich_anilist_descriptions(results)
    anilist_results = results.select { |r| r.external_api_source == 'anilist' }
    return if anilist_results.empty?

    tmdb = ExternalApis::TmdbAdapter.new
    wikipedia = ExternalApis::WikipediaClient.new

    anilist_results.each do |result|
      # ① TMDB検索（英語→ローマ字→日本語の順で複数パターンを試す）
      description = fetch_japanese_description_from_tmdb(result, tmdb)
      # ② TMDBで見つからなければWikipediaから取得
      description ||= wikipedia.fetch_extract(result.title)
      result.description = description if description.present?
    end
  end
```

- [ ] テストを実行してパスを確認する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/work_search_service_spec.rb -fd`
Expected: PASS（新規テスト + 既存テスト両方）

### Step 4-5: コミット

- [ ] コミットする。

```bash
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "fix: AniList説明文にTMDB複数パターン検索+Wikipedia補完を追加 (#61)"
```

---

## Task 5: 全テスト実行 + リンター確認

全体の整合性を確認する。

**Files:** なし（確認のみ）

### Step 5-1: 関連テストを全て実行する

- [ ] 変更した全ファイルのテストを実行する。

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/ spec/services/work_search_service_spec.rb -fd`
Expected: ALL PASS

### Step 5-2: RuboCopを実行する

- [ ] 変更したファイルにリンターを適用する。

Run: `docker compose exec -T backend bundle exec rubocop app/services/external_apis/wikipedia_client.rb app/services/external_apis/wikipedia_game_adapter.rb app/services/external_apis/igdb_adapter.rb app/services/work_search_service.rb --autocorrect-all`
Expected: no offenses detected（または自動修正完了）

### Step 5-3: テストファイルにもRuboCopを実行する

- [ ] テストファイルにもリンターを適用する。

Run: `docker compose exec -T backend bundle exec rubocop spec/services/external_apis/wikipedia_client_spec.rb spec/services/external_apis/wikipedia_game_adapter_spec.rb spec/services/external_apis/igdb_adapter_spec.rb spec/services/work_search_service_spec.rb --autocorrect-all`
Expected: no offenses detected（または自動修正完了）

### Step 5-4: リンター修正があればコミット

- [ ] RuboCopの自動修正があった場合のみコミットする。

```bash
git add -A
git commit -m "style: RuboCop自動修正 (#61)"
```
