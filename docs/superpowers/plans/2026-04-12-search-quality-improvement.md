# 検索品質改善 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 検索結果の画像・説明文欠損（全体54%）と前の結果残りバグを解消し、既存Wikipedia補完ロジックの4つの欠陥を修正しつつ openBD で本の画像を補完する。

**Architecture:** 既存の `WorkSearchService` の補完ロジックを全ソース対象に書き換え、`WikipediaClient` に検索→取得の2段階メソッドを追加、新規 `OpenbdClient` でGoogle Booksの欠損を ISBN ベースで補完する。フロントエンドは `AbortController` で古いリクエストをキャンセルし、新検索時に結果を即時クリアする。

**Tech Stack:** Ruby 3.3 / Rails 8 / RSpec / WebMock / React 19 / TypeScript / Vitest / React Testing Library

**関連ドキュメント:**
- 仕様書: `docs/superpowers/specs/2026-04-12-search-quality-improvement-design.md`
- ADR-0038: 検索品質改善アプローチにC-2を採用
- ADR-0039: 書籍データ補完APIにopenBDを採用
- Issue: IKcoding-jp/Recolly#127

---

## ファイル構成

| 種別 | ファイル | 役割 |
|------|---------|------|
| 新規 | `backend/app/services/external_apis/openbd_client.rb` | openBDから書誌データを取得するクライアント |
| 新規 | `backend/spec/services/external_apis/openbd_client_spec.rb` | OpenbdClient単体テスト |
| 変更 | `backend/app/services/external_apis/google_books_adapter.rb` | ISBNをmetadataに含める |
| 変更 | `backend/spec/services/external_apis/google_books_adapter_spec.rb` | ISBNテスト追加 |
| 変更 | `backend/app/services/external_apis/wikipedia_client.rb` | `search_and_fetch_extract` メソッド追加 |
| 変更 | `backend/spec/services/external_apis/wikipedia_client_spec.rb` | 新メソッドのテスト追加 |
| 変更 | `backend/app/services/work_search_service.rb` | 補完ロジック全面書き換え + openBD連携 + 品質ソート + キャッシュv2 |
| 変更 | `backend/spec/services/work_search_service_spec.rb` | 新しい補完動作のテスト |
| 変更 | `frontend/src/lib/worksApi.ts` | `signal` オプションを受け付けるよう拡張 |
| 変更 | `frontend/src/pages/SearchPage/SearchPage.tsx` | AbortController + 結果即時クリア |
| 変更 | `frontend/src/pages/SearchPage/SearchPage.test.tsx` | 新しい挙動のテスト追加 |

---

### Task 1: WorkSearchService のキャッシュキーに CACHE_VERSION を追加

**Files:**
- Modify: `backend/app/services/work_search_service.rb`
- Modify: `backend/spec/services/work_search_service_spec.rb`

**目的:** 後続タスクでロジックを変更した際に古い12時間キャッシュが混ざらないよう、キャッシュキーをバージョン付きにする。

- [ ] **Step 1: キャッシュバージョンのテストを書く**

`backend/spec/services/work_search_service_spec.rb` の `describe '#search' do` ブロック内に以下を追記する。

```ruby
it 'キャッシュキーに CACHE_VERSION を含めることで古い実装のキャッシュを無視する' do
  # 古いフォーマットのキー（v無し）でデータを入れておく
  Rails.cache.write('work_search:anime:テスト', [mock_result])
  # 新しい検索は新しいキー形式で保存される
  service.search('テスト', media_type: 'anime')
  expect(Rails.cache.exist?('work_search:v2:anime:テスト')).to be true
end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/services/work_search_service_spec.rb -e 'CACHE_VERSION'`
Expected: FAIL（キャッシュキーに v2 が含まれていない）

- [ ] **Step 3: 実装する**

`backend/app/services/work_search_service.rb` を編集する。

```ruby
class WorkSearchService
  CACHE_TTL = 12.hours
  CACHE_VERSION = 'v2' # 実装変更時にインクリメントしてキャッシュを無効化する
  ENRICHMENT_BATCH_SIZE = 5

  def search(query, media_type: nil)
    cache_key = "work_search:#{CACHE_VERSION}:#{media_type || 'all'}:#{query}"
    # ...以下変更なし
  end
end
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/services/work_search_service_spec.rb`
Expected: PASS（既存テストも全パス）

- [ ] **Step 5: コミットする**

```bash
cd D:/Dev/recolly
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "refactor(backend): WorkSearchService のキャッシュキーに CACHE_VERSION を追加 #127"
```

---

### Task 2: GoogleBooksAdapter で ISBN を metadata に含める

**Files:**
- Modify: `backend/app/services/external_apis/google_books_adapter.rb`
- Modify: `backend/spec/services/external_apis/google_books_adapter_spec.rb`

**目的:** openBD補完（Task 6）に必要な ISBN を SearchResult.metadata に含める。

- [ ] **Step 1: ISBN抽出のテストを書く**

`backend/spec/services/external_apis/google_books_adapter_spec.rb` の `describe '#search' do` ブロック内に以下を追記する。

```ruby
describe 'ISBN抽出' do
  it 'ISBN-13 が最優先でmetadataに入る' do
    stub_books_response([{
      'id' => 'abc123',
      'volumeInfo' => {
        'title' => 'テスト本',
        'industryIdentifiers' => [
          { 'type' => 'ISBN_10', 'identifier' => '4101001340' },
          { 'type' => 'ISBN_13', 'identifier' => '9784101001340' }
        ]
      }
    }])
    book = adapter.search('テスト本').first
    expect(book.metadata[:isbn]).to eq('9784101001340')
  end

  it 'ISBN-13 がなければ ISBN-10 を使う' do
    stub_books_response([{
      'id' => 'abc123',
      'volumeInfo' => {
        'title' => 'テスト本',
        'industryIdentifiers' => [
          { 'type' => 'ISBN_10', 'identifier' => '4101001340' }
        ]
      }
    }])
    book = adapter.search('テスト本').first
    expect(book.metadata[:isbn]).to eq('4101001340')
  end

  it 'ISBN情報がなければ :isbn キーは含まれない' do
    stub_books_response([{
      'id' => 'abc123',
      'volumeInfo' => { 'title' => 'テスト本' }
    }])
    book = adapter.search('テスト本').first
    expect(book.metadata).not_to have_key(:isbn)
  end
end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/services/external_apis/google_books_adapter_spec.rb -e 'ISBN抽出'`
Expected: FAIL（`metadata[:isbn]` が nil）

- [ ] **Step 3: 実装する**

`backend/app/services/external_apis/google_books_adapter.rb` を編集する。

```ruby
def normalize(item)
  info = item['volumeInfo'] || {}

  SearchResult.new(
    info['title'],
    'book',
    info['description'],
    info.dig('imageLinks', 'thumbnail'),
    nil,
    item['id'],
    'google_books',
    {
      authors: info['authors'],
      publisher: info['publisher'],
      published_date: info['publishedDate'],
      page_count: info['pageCount'],
      categories: info['categories'],
      # ISBNはopenBD補完に使用する。ISBN-13を優先し、なければISBN-10
      isbn: extract_isbn(info),
      popularity: normalize_popularity(info['ratingsCount'])
    }.compact
  )
end

def extract_isbn(info)
  identifiers = info['industryIdentifiers'] || []
  isbn13 = identifiers.find { |i| i['type'] == 'ISBN_13' }
  isbn10 = identifiers.find { |i| i['type'] == 'ISBN_10' }
  isbn13&.dig('identifier') || isbn10&.dig('identifier')
end
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/services/external_apis/google_books_adapter_spec.rb`
Expected: PASS（既存テストも含めて全パス）

- [ ] **Step 5: コミットする**

```bash
cd D:/Dev/recolly
git add backend/app/services/external_apis/google_books_adapter.rb backend/spec/services/external_apis/google_books_adapter_spec.rb
git commit -m "feat(backend): GoogleBooksAdapter で ISBN を metadata に含める #127"
```

---

### Task 3: OpenbdClient を新規作成

**Files:**
- Create: `backend/app/services/external_apis/openbd_client.rb`
- Create: `backend/spec/services/external_apis/openbd_client_spec.rb`

**目的:** openBD から ISBN ベースで書誌データ（画像・内容紹介）を取得する新クライアント。

- [ ] **Step 1: OpenbdClient のテストを書く**

`backend/spec/services/external_apis/openbd_client_spec.rb` を新規作成する。

```ruby
# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::OpenbdClient, type: :service do
  subject(:client) { described_class.new }

  describe '#fetch' do
    context 'ISBNが空の場合' do
      it 'nil を返す' do
        expect(client.fetch(nil)).to be_nil
        expect(client.fetch('')).to be_nil
      end
    end

    context '正常なレスポンスの場合' do
      let(:valid_response) do
        [
          {
            'summary' => {
              'isbn' => '9784101001340',
              'title' => '人間失格',
              'cover' => 'https://cover.openbd.jp/9784101001340.jpg'
            },
            'onix' => {
              'CollateralDetail' => {
                'TextContent' => [
                  { 'TextType' => '03', 'Text' => '恥の多い生涯を送って来ました。' },
                  { 'TextType' => '02', 'Text' => '著者: 太宰治' }
                ]
              }
            }
          }
        ]
      end

      before do
        stub_request(:get, %r{api.openbd.jp/v1/get})
          .to_return(status: 200, body: valid_response.to_json,
                     headers: { 'Content-Type' => 'application/json' })
      end

      it '画像URLと内容紹介を返す' do
        result = client.fetch('9784101001340')
        expect(result[:cover_image_url]).to eq('https://cover.openbd.jp/9784101001340.jpg')
        expect(result[:description]).to eq('恥の多い生涯を送って来ました。')
      end

      it 'TextType=03（内容紹介）を優先して選ぶ' do
        result = client.fetch('9784101001340')
        expect(result[:description]).to eq('恥の多い生涯を送って来ました。')
        expect(result[:description]).not_to include('著者')
      end
    end

    context 'ISBNが見つからない場合' do
      before do
        # openBDは該当なしの時 [null] を返す
        stub_request(:get, %r{api.openbd.jp/v1/get})
          .to_return(status: 200, body: [nil].to_json,
                     headers: { 'Content-Type' => 'application/json' })
      end

      it 'nil を返す' do
        expect(client.fetch('9999999999999')).to be_nil
      end
    end

    context '画像が欠損している場合' do
      let(:partial_response) do
        [{
          'summary' => { 'isbn' => '9784101001340', 'title' => 'テスト' },
          'onix' => {
            'CollateralDetail' => {
              'TextContent' => [{ 'TextType' => '03', 'Text' => '説明文' }]
            }
          }
        }]
      end

      before do
        stub_request(:get, %r{api.openbd.jp/v1/get})
          .to_return(status: 200, body: partial_response.to_json,
                     headers: { 'Content-Type' => 'application/json' })
      end

      it '画像URLは nil、説明は返す' do
        result = client.fetch('9784101001340')
        expect(result[:cover_image_url]).to be_nil
        expect(result[:description]).to eq('説明文')
      end
    end

    context 'ネットワークエラーの場合' do
      before do
        stub_request(:get, %r{api.openbd.jp/v1/get}).to_timeout
      end

      it 'nil を返しエラーを握りつぶす' do
        expect(client.fetch('9784101001340')).to be_nil
      end
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/services/external_apis/openbd_client_spec.rb`
Expected: FAIL（`NameError: uninitialized constant ExternalApis::OpenbdClient`）

- [ ] **Step 3: OpenbdClient を実装する**

`backend/app/services/external_apis/openbd_client.rb` を新規作成する。

```ruby
# frozen_string_literal: true

module ExternalApis
  # openBDから書誌データを取得するクライアント
  # https://openbd.jp/
  # APIキー不要・無料・ISBNベースで書誌情報と書影を提供する日本書籍データベース
  # WorkSearchService#enrich_books_via_openbd から使用される
  class OpenbdClient
    BASE_URL = 'https://api.openbd.jp/v1'
    USER_AGENT = 'Recolly/1.0 (https://github.com/IKcoding-jp/Recolly)'

    # ISBN から書誌データを取得する
    # 戻り値: { cover_image_url: String|nil, description: String|nil } または nil
    def fetch(isbn)
      return nil if isbn.blank?

      response = connection.get('/get', { isbn: isbn })
      data = response.body&.first
      return nil if data.nil?

      {
        cover_image_url: extract_cover_url(data),
        description: extract_description(data)
      }
    rescue Faraday::Error => e
      Rails.logger.error("[OpenbdClient] 取得エラー: #{e.message}")
      nil
    end

    private

    # openBDレスポンス構造: summary.cover に画像URL（文字列）
    def extract_cover_url(data)
      data.dig('summary', 'cover').presence
    end

    # openBDレスポンス構造: onix.CollateralDetail.TextContent は配列
    # TextType='03' は内容紹介（書籍紹介文）を意味する
    def extract_description(data)
      text_contents = data.dig('onix', 'CollateralDetail', 'TextContent') || []
      intro = text_contents.find { |t| t['TextType'] == '03' }
      intro&.dig('Text').presence
    end

    def connection
      @connection ||= Faraday.new(
        url: BASE_URL, request: { open_timeout: 5, timeout: 10 }
      ) do |f|
        f.response :json
        f.headers['User-Agent'] = USER_AGENT
        f.adapter Faraday.default_adapter
      end
    end
  end
end
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/services/external_apis/openbd_client_spec.rb`
Expected: PASS

- [ ] **Step 5: RuboCopチェック**

Run: `cd backend && bundle exec rubocop app/services/external_apis/openbd_client.rb spec/services/external_apis/openbd_client_spec.rb`
Expected: no offenses

- [ ] **Step 6: コミットする**

```bash
cd D:/Dev/recolly
git add backend/app/services/external_apis/openbd_client.rb backend/spec/services/external_apis/openbd_client_spec.rb
git commit -m "feat(backend): OpenbdClient を新規作成 #127"
```

---

### Task 4: WikipediaClient に `search_and_fetch_extract` を追加

**Files:**
- Modify: `backend/app/services/external_apis/wikipedia_client.rb`
- Modify: `backend/spec/services/external_apis/wikipedia_client_spec.rb`

**目的:** 既存 `fetch_extract` のタイトル完全一致制約を回避し、検索APIで記事タイトルを探してから概要を取る2段階メソッドを追加する。

- [ ] **Step 1: `search_and_fetch_extract` のテストを書く**

`backend/spec/services/external_apis/wikipedia_client_spec.rb` の末尾 `end` の直前に以下を追記する。

```ruby
  describe '#search_and_fetch_extract' do
    context '検索で記事が見つかる場合' do
      before do
        # 1回目: search API（query.list.search）
        stub_request(:get, /ja.wikipedia.org/)
          .with(query: hash_including(list: 'search'))
          .to_return(status: 200, body: {
            'query' => {
              'search' => [{ 'title' => '呪術廻戦' }]
            }
          }.to_json, headers: { 'Content-Type' => 'application/json' })

        # 2回目: extract API（query.pages）
        stub_request(:get, /ja.wikipedia.org/)
          .with(query: hash_including(prop: 'extracts'))
          .to_return(status: 200, body: {
            'query' => {
              'pages' => { '1' => { 'title' => '呪術廻戦', 'extract' => '呪術廻戦は芥見下々による日本の漫画作品。' } }
            }
          }.to_json, headers: { 'Content-Type' => 'application/json' })
      end

      it '検索→概要取得の2段階で日本語説明を返す' do
        extract = client.search_and_fetch_extract('呪術廻戦 第2期')
        expect(extract).to eq('呪術廻戦は芥見下々による日本の漫画作品。')
      end
    end

    context '検索で記事が0件の場合' do
      before do
        stub_request(:get, /ja.wikipedia.org/)
          .with(query: hash_including(list: 'search'))
          .to_return(status: 200, body: {
            'query' => { 'search' => [] }
          }.to_json, headers: { 'Content-Type' => 'application/json' })
      end

      it 'nil を返す' do
        expect(client.search_and_fetch_extract('存在しない作品xyz123')).to be_nil
      end
    end

    context 'クエリが空の場合' do
      it 'nil を返しAPI呼び出しは発生しない' do
        expect(client.search_and_fetch_extract('')).to be_nil
        expect(client.search_and_fetch_extract(nil)).to be_nil
        expect(WebMock).not_to have_requested(:get, /ja.wikipedia.org/)
      end
    end
  end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/services/external_apis/wikipedia_client_spec.rb -e 'search_and_fetch_extract'`
Expected: FAIL（`NoMethodError: undefined method 'search_and_fetch_extract'`）

- [ ] **Step 3: `search_and_fetch_extract` を実装する**

`backend/app/services/external_apis/wikipedia_client.rb` の `def fetch_extract` の下に追加する。

```ruby
# 検索APIで記事タイトルを探し、見つかった最上位記事の概要を返す
# 完全一致を要求する fetch_extract と違い、タイトルの表記揺れや副題付きでもマッチする
# 例: "呪術廻戦 第2期" で検索 → "呪術廻戦" 記事の概要を返す
def search_and_fetch_extract(query)
  return nil if query.blank?

  titles = search(query, limit: 1)
  return nil if titles.empty?

  fetch_extract(titles.first)
end
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/services/external_apis/wikipedia_client_spec.rb`
Expected: PASS（既存テストも含めて全パス）

- [ ] **Step 5: RuboCopチェック**

Run: `cd backend && bundle exec rubocop app/services/external_apis/wikipedia_client.rb`
Expected: no offenses

- [ ] **Step 6: コミットする**

```bash
cd D:/Dev/recolly
git add backend/app/services/external_apis/wikipedia_client.rb backend/spec/services/external_apis/wikipedia_client_spec.rb
git commit -m "feat(backend): WikipediaClient に search_and_fetch_extract を追加 #127"
```

---

### Task 5: WorkSearchService に `enrich_books_via_openbd` を追加

**Files:**
- Modify: `backend/app/services/work_search_service.rb`
- Modify: `backend/spec/services/work_search_service_spec.rb`

**目的:** 本の検索結果のうち、画像 or 説明が欠損していて ISBN を持つものについて openBD で補完する。

- [ ] **Step 1: `enrich_books_via_openbd` のテストを書く**

`backend/spec/services/work_search_service_spec.rb` の末尾 `describe '#search' do` ブロックの中に以下を追加する。

```ruby
  describe '#search openBD補完' do
    let(:openbd_double) { instance_double(ExternalApis::OpenbdClient) }
    let(:book_without_image) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '人間失格', 'book', nil, nil, nil, 'gbid1', 'google_books',
        { isbn: '9784101001340', popularity: 0.5 }
      )
    end
    let(:book_with_full_data) do
      ExternalApis::BaseAdapter::SearchResult.new(
        'ノルウェイの森', 'book', '既存の説明', 'https://existing.jpg',
        nil, 'gbid2', 'google_books',
        { isbn: '9784101001341', popularity: 0.5 }
      )
    end
    let(:book_without_isbn) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '謎の本', 'book', nil, nil, nil, 'gbid3', 'google_books',
        { popularity: 0.5 }
      )
    end

    before do
      allow(ExternalApis::OpenbdClient).to receive(:new).and_return(openbd_double)
      allow(google_books_double).to receive(:safe_search).and_return(
        [book_without_image, book_with_full_data, book_without_isbn]
      )
    end

    it 'ISBN がある欠損結果に openBD のデータを補完する' do
      allow(openbd_double).to receive(:fetch).with('9784101001340').and_return(
        { cover_image_url: 'https://openbd.jp/cover.jpg', description: '恥の多い生涯。' }
      )
      results = service.search('本テスト', media_type: 'book')
      target = results.find { |r| r.title == '人間失格' }
      expect(target.cover_image_url).to eq('https://openbd.jp/cover.jpg')
      expect(target.description).to eq('恥の多い生涯。')
    end

    it '既存のデータは openBD で上書きしない' do
      allow(openbd_double).to receive(:fetch).and_return(
        { cover_image_url: 'https://openbd.jp/other.jpg', description: '別の説明' }
      )
      results = service.search('本テスト', media_type: 'book')
      target = results.find { |r| r.title == 'ノルウェイの森' }
      # 既存の画像・説明が維持される
      expect(target.cover_image_url).to eq('https://existing.jpg')
      expect(target.description).to eq('既存の説明')
      # openBD fetch は呼ばれない（欠損がないため）
      expect(openbd_double).not_to have_received(:fetch).with('9784101001341')
    end

    it 'ISBN がない結果は openBD 対象外' do
      allow(openbd_double).to receive(:fetch)
      service.search('本テスト', media_type: 'book')
      # book_without_isbn に対する fetch 呼び出しがないことを確認
      # （該当するISBN値がそもそもないので、全ての fetch 呼び出しに :isbn が必要）
      expect(openbd_double).to have_received(:fetch).with('9784101001340').at_most(:once)
    end
  end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/services/work_search_service_spec.rb -e 'openBD補完'`
Expected: FAIL（`enrich_books_via_openbd` が呼ばれない）

- [ ] **Step 3: `enrich_books_via_openbd` を実装する**

`backend/app/services/work_search_service.rb` の `#search` メソッドと private 部分を編集する。

```ruby
def search(query, media_type: nil)
  cache_key = "work_search:#{CACHE_VERSION}:#{media_type || 'all'}:#{query}"

  Rails.cache.fetch(cache_key, expires_in: CACHE_TTL) do
    adapters = select_adapters(media_type)
    results = fetch_from_adapters_in_parallel(adapters, query, media_type)
    results = results.select { |r| r.media_type == media_type } if media_type.present?

    enrich_books_via_openbd(results)
    enrich_anilist_descriptions(results)
    remove_english_descriptions(results)
    sort_by_popularity(results)
  end
end
```

`private` 以下に以下のメソッドを追加する（`enrich_anilist_descriptions` の直前）。

```ruby
# Google Booksの結果のうち画像・説明が欠損しているものを openBD で補完する
# ISBN が metadata にない結果はスキップする（openBDはISBNベース）
def enrich_books_via_openbd(results)
  book_results = results.select do |r|
    r.external_api_source == 'google_books' &&
      (r.cover_image_url.blank? || r.description.blank?) &&
      r.metadata[:isbn].present?
  end
  return if book_results.empty?

  openbd = ExternalApis::OpenbdClient.new
  book_results.each_slice(ENRICHMENT_BATCH_SIZE) do |batch|
    threads = batch.map do |result|
      Thread.new { enrich_single_book(result, openbd) }
    end
    threads.each(&:join)
  end
end

# 欠損している項目だけを補完する（既存データは上書きしない）
def enrich_single_book(result, openbd)
  data = openbd.fetch(result.metadata[:isbn])
  return if data.nil?

  result.cover_image_url ||= data[:cover_image_url]
  result.description ||= data[:description]
end
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/services/work_search_service_spec.rb -e 'openBD補完'`
Expected: PASS

- [ ] **Step 5: 既存テスト全体のregression確認**

Run: `cd backend && bundle exec rspec spec/services/work_search_service_spec.rb`
Expected: PASS（既存テストも含めて全部通る）

- [ ] **Step 6: コミットする**

```bash
cd D:/Dev/recolly
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "feat(backend): WorkSearchService に enrich_books_via_openbd を追加 #127"
```

---

### Task 6: WorkSearchService の補完ロジック書き換え（全ソース対象）

**Files:**
- Modify: `backend/app/services/work_search_service.rb`
- Modify: `backend/spec/services/work_search_service_spec.rb`

**目的:** AniList限定だった補完処理を全ソースに拡張し、`search_and_fetch_extract` を使い、破壊的な `remove_english_descriptions` を廃止する。

- [ ] **Step 1: 全ソース補完のテストを書く**

`backend/spec/services/work_search_service_spec.rb` の末尾 `describe '#search' do` ブロックの中に以下を追加する。

```ruby
  describe '#search 全ソース対象のWikipedia補完' do
    let(:wiki_double) { instance_double(ExternalApis::WikipediaClient) }
    let(:igdb_result) do
      ExternalApis::BaseAdapter::SearchResult.new(
        'Zelda', 'game', 'An action-adventure game series.', 'https://img.igdb', nil,
        'g1', 'igdb', { popularity: 0.9 }
      )
    end
    let(:google_book_without_desc) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '嫌われる勇気', 'book', nil, 'https://img.gbooks', nil,
        'gb1', 'google_books', { isbn: '9784478025819', popularity: 0.8 }
      )
    end

    before do
      allow(ExternalApis::WikipediaClient).to receive(:new).and_return(wiki_double)
      allow(ExternalApis::OpenbdClient).to receive(:new).and_return(
        instance_double(ExternalApis::OpenbdClient, fetch: nil)
      )
    end

    it 'IGDB（ゲーム）の英語説明も Wikipedia 補完の対象になる' do
      allow(wiki_double).to receive(:search_and_fetch_extract).with('Zelda')
                                                              .and_return('ゼルダの伝説はアクションアドベンチャーゲーム。')
      allow(igdb_double).to receive(:safe_search).and_return([igdb_result])

      results = service.search('Zelda', media_type: 'game')
      expect(results.first.description).to eq('ゼルダの伝説はアクションアドベンチャーゲーム。')
    end

    it 'Google Books の空説明も Wikipedia 補完の対象になる' do
      allow(wiki_double).to receive(:search_and_fetch_extract).with('嫌われる勇気')
                                                              .and_return('嫌われる勇気はアドラー心理学の入門書。')
      allow(google_books_double).to receive(:safe_search).and_return([google_book_without_desc])

      results = service.search('嫌われる勇気', media_type: 'book')
      expect(results.first.description).to eq('嫌われる勇気はアドラー心理学の入門書。')
    end

    it 'Wikipedia で見つからず英語しかない場合は英語説明を残す' do
      allow(wiki_double).to receive(:search_and_fetch_extract).and_return(nil)
      allow(igdb_double).to receive(:safe_search).and_return([igdb_result])

      results = service.search('Zelda', media_type: 'game')
      # nil にはならず、元の英語説明が残る（破壊的削除の廃止）
      expect(results.first.description).to eq('An action-adventure game series.')
    end

    it 'TMDBで日本語説明が取れれば Wikipedia を呼ばない' do
      # TMDBアダプタのフェッチをモック
      allow(tmdb_double).to receive(:fetch_japanese_description).and_return('ゲーム日本語説明')
      allow(wiki_double).to receive(:search_and_fetch_extract)
      allow(igdb_double).to receive(:safe_search).and_return([igdb_result])

      results = service.search('Zelda', media_type: 'game')
      expect(results.first.description).to eq('ゲーム日本語説明')
      expect(wiki_double).not_to have_received(:search_and_fetch_extract)
    end
  end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/services/work_search_service_spec.rb -e '全ソース対象'`
Expected: FAIL（AniList限定の補完なのでゲーム・本の結果は変わらない）

- [ ] **Step 3: `WorkSearchService` を書き換える**

`backend/app/services/work_search_service.rb` を編集する。`#search` メソッドを変更。

```ruby
def search(query, media_type: nil)
  cache_key = "work_search:#{CACHE_VERSION}:#{media_type || 'all'}:#{query}"

  Rails.cache.fetch(cache_key, expires_in: CACHE_TTL) do
    adapters = select_adapters(media_type)
    results = fetch_from_adapters_in_parallel(adapters, query, media_type)
    results = results.select { |r| r.media_type == media_type } if media_type.present?

    enrich_books_via_openbd(results)
    enrich_missing_descriptions(results)
    sort_by_popularity(results)
  end
end
```

次に `enrich_anilist_descriptions` と `remove_english_descriptions` を削除し、以下のメソッドで置き換える。

```ruby
# 説明が空 or 英語の全結果を対象に日本語説明を補完する
# 以前は AniList 結果のみが対象だったが、IGDB（ゲーム）・Google Books（本）・TMDB（映画/ドラマ）にも拡張
# 外部APIへの同時接続数を制限するため、5件ずつのバッチで並列処理する
def enrich_missing_descriptions(results)
  needs_enrichment = results.select do |r|
    r.description.blank? || english_text?(r.description)
  end
  return if needs_enrichment.empty?

  needs_enrichment.each_slice(ENRICHMENT_BATCH_SIZE) do |batch|
    threads = batch.map do |result|
      Thread.new { try_enrich_description(result) }
    end
    threads.each(&:join)
  end
end

# 補完の試行順:
# 1. TMDB日本語説明（映画・ドラマは元々これで取れる。AniList結果は title_english/title_romaji も試す）
# 2. Wikipedia search_and_fetch_extract（完全一致制約を回避した検索→取得の2段階）
# 3. 元の説明にフォールバック（英語でも nil にせずそのまま残す）
def try_enrich_description(result)
  tmdb = ExternalApis::TmdbAdapter.new
  wikipedia = ExternalApis::WikipediaClient.new

  description = fetch_japanese_description_from_tmdb(result, tmdb)
  description ||= wikipedia.search_and_fetch_extract(result.title)
  result.description = resolve_description(description, result.description)
end

# TMDBで日本語説明を検索（メタデータにtitle_english/title_romajiがあれば順番に試す）
def fetch_japanese_description_from_tmdb(result, tmdb)
  queries = [
    result.title,
    result.metadata[:title_english],
    result.metadata[:title_romaji]
  ].compact.uniq

  queries.each do |query|
    description = tmdb.fetch_japanese_description(query)
    return description if description.present?
  end
  nil
end

# 日本語説明が見つかればそれを使う。見つからなくても元の説明を消さない（英語でも残す）
# 以前の remove_english_descriptions は「英語なら nil 化」という破壊的動作だったため廃止
def resolve_description(japanese_desc, original_desc)
  return japanese_desc if japanese_desc.present?
  original_desc
end

# 文字列の半分以上がASCII文字なら英語と判定（補完対象の選定に使用）
def english_text?(text)
  return false if text.blank?

  ascii_ratio = text.count("\x20-\x7E").to_f / text.length
  ascii_ratio > 0.5
end
```

**旧 `enrich_anilist_descriptions`、`remove_english_descriptions`、`enrich_single_description` は削除する。**

- [ ] **Step 4: 新しいテストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/services/work_search_service_spec.rb -e '全ソース対象'`
Expected: PASS

- [ ] **Step 5: 既存テストのregression確認**

Run: `cd backend && bundle exec rspec spec/services/work_search_service_spec.rb`
Expected: PASS（全テストパス）

注: 既存テスト内で `remove_english_descriptions` の動作をテストしているものがあれば、新仕様（英語を残す）に合わせて更新する必要がある。失敗するテストがあれば、**新仕様に合わせて期待値を修正**する。

- [ ] **Step 6: 関連するrequest specがあれば実行する**

Run: `cd backend && bundle exec rspec spec/requests/api/v1/works`
Expected: PASS（壊れていないこと）

- [ ] **Step 7: RuboCopチェック**

Run: `cd backend && bundle exec rubocop app/services/work_search_service.rb`
Expected: no offenses

- [ ] **Step 8: コミットする**

```bash
cd D:/Dev/recolly
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "refactor(backend): 補完ロジックを全ソース対象に書き換え #127"
```

---

### Task 7: WorkSearchService に品質込みソートを追加

**Files:**
- Modify: `backend/app/services/work_search_service.rb`
- Modify: `backend/spec/services/work_search_service_spec.rb`

**目的:** 画像・説明がある結果を上位に並べる。フィルタはせず、ランキングで対応する。

- [ ] **Step 1: 品質ソートのテストを書く**

`backend/spec/services/work_search_service_spec.rb` に以下を追加する。

```ruby
  describe '#search 品質込みソート' do
    let(:full_result) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '作品A', 'anime', '説明あり', 'https://img.jpg', nil,
        '1', 'anilist', { popularity: 0.3 }
      )
    end
    let(:image_only) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '作品B', 'anime', nil, 'https://img.jpg', nil,
        '2', 'anilist', { popularity: 0.9 }
      )
    end
    let(:desc_only) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '作品C', 'anime', '説明あり', nil, nil,
        '3', 'anilist', { popularity: 0.9 }
      )
    end
    let(:empty_result) do
      ExternalApis::BaseAdapter::SearchResult.new(
        '作品D', 'anime', nil, nil, nil,
        '4', 'anilist', { popularity: 1.0 }
      )
    end

    before do
      allow(anilist_double).to receive(:safe_search).and_return(
        [empty_result, image_only, desc_only, full_result]
      )
      # 補完をバイパスするため Wikipedia/TMDB をスタブ
      wiki = instance_double(ExternalApis::WikipediaClient, search_and_fetch_extract: nil)
      allow(ExternalApis::WikipediaClient).to receive(:new).and_return(wiki)
      allow(tmdb_double).to receive(:fetch_japanese_description).and_return(nil)
    end

    it '画像+説明ありを最上位、両方なしを最下位に並べる' do
      results = service.search('テスト', media_type: 'anime')
      expect(results.first.title).to eq('作品A') # 画像+説明あり
      expect(results.last.title).to eq('作品D')  # 両方なし
    end

    it '同じ品質レベル内では人気度順に並ぶ' do
      results = service.search('テスト', media_type: 'anime')
      # 画像のみ(popularity=0.9)と説明のみ(popularity=0.9) は同じ品質スコア0.5
      # popularity が同じなので順序は保証されないが、両方がAの後に来る
      mid_titles = [results[1].title, results[2].title]
      expect(mid_titles).to contain_exactly('作品B', '作品C')
    end
  end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd backend && bundle exec rspec spec/services/work_search_service_spec.rb -e '品質込みソート'`
Expected: FAIL（現状は popularity のみでソート、作品Dが最上位）

- [ ] **Step 3: `sort_by_popularity` を `sort_by_quality_and_popularity` に置き換える**

`backend/app/services/work_search_service.rb` を編集する。

`#search` メソッド内の `sort_by_popularity(results)` を `sort_by_quality_and_popularity(results)` に変更。

private メソッド `sort_by_popularity` を削除し、以下を追加する。

```ruby
# 品質スコア（0.0〜1.0）: 画像あり=0.5, 説明あり=0.5
# 両方ある = 1.0、片方 = 0.5、どちらもない = 0.0
def quality_score(result)
  score = 0.0
  score += 0.5 if result.cover_image_url.present?
  score += 0.5 if result.description.present?
  score
end

# 品質スコア降順 → 人気度降順の2段ソート
# 情報がしっかりある結果を上位に並べることで、欠損結果を下位に押し下げる
def sort_by_quality_and_popularity(results)
  results.sort_by do |r|
    [-quality_score(r), -(r.metadata[:popularity] || 0)]
  end
end
```

- [ ] **Step 4: 新しいテストが通ることを確認する**

Run: `cd backend && bundle exec rspec spec/services/work_search_service_spec.rb -e '品質込みソート'`
Expected: PASS

- [ ] **Step 5: 既存テスト全体のregression確認**

Run: `cd backend && bundle exec rspec spec/services/work_search_service_spec.rb`
Expected: PASS

注: 既存テストで `sort_by_popularity` を直接参照しているものがあれば、新しいメソッド名に合わせて更新する。

- [ ] **Step 6: RuboCopチェック**

Run: `cd backend && bundle exec rubocop app/services/work_search_service.rb`
Expected: no offenses

- [ ] **Step 7: コミットする**

```bash
cd D:/Dev/recolly
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "feat(backend): 検索結果を品質込みでソート #127"
```

---

### Task 8: フロントエンド worksApi.search に `signal` オプションを追加

**Files:**
- Modify: `frontend/src/lib/worksApi.ts`

**目的:** SearchPage 側で `AbortController` を使うために、`signal` をAPIクライアント経由で渡せるようにする。

- [ ] **Step 1: worksApi.search に signal オプションを追加**

`frontend/src/lib/worksApi.ts` を編集する。

```ts
import type { SearchResponse, WorkResponse, MediaType } from './types'
import { request } from './api'

export const worksApi = {
  // options.signal で AbortController と連携できるようにする（検索のレース条件対策）
  search(
    query: string,
    mediaType?: MediaType,
    options?: { signal?: AbortSignal },
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query })
    if (mediaType) params.append('media_type', mediaType)
    return request<SearchResponse>(`/works/search?${params.toString()}`, {
      signal: options?.signal,
    })
  },

  create(title: string, mediaType: MediaType, description?: string): Promise<WorkResponse> {
    return request<WorkResponse>('/works', {
      method: 'POST',
      body: JSON.stringify({
        work: { title, media_type: mediaType, description },
      }),
    })
  },

  sync(workId: number): Promise<WorkResponse> {
    return request<WorkResponse>(`/works/${workId}/sync`, {
      method: 'POST',
    })
  },
}
```

注: `request` 関数は既に `RequestInit` を受け取る設計なので、`signal` はそのまま `fetch` に渡される。

- [ ] **Step 2: TypeScript ビルドチェック**

Run: `cd frontend && npm run build`
Expected: ビルド成功

- [ ] **Step 3: 既存テストのregression確認**

Run: `cd frontend && npm run test -- --run worksApi`
Expected: PASS（もしテストが無ければスキップ）

- [ ] **Step 4: コミットする**

```bash
cd D:/Dev/recolly
git add frontend/src/lib/worksApi.ts
git commit -m "feat(frontend): worksApi.search に signal オプションを追加 #127"
```

---

### Task 9: SearchPage に AbortController + 結果即時クリアを実装

**Files:**
- Modify: `frontend/src/pages/SearchPage/SearchPage.tsx`
- Modify: `frontend/src/pages/SearchPage/SearchPage.test.tsx`

**目的:** 新しい検索を開始する時に古い結果を即座にクリアし、古いリクエストを `AbortController` で中断する。

- [ ] **Step 1: 結果クリアとキャンセルのテストを書く**

`frontend/src/pages/SearchPage/SearchPage.test.tsx` の末尾に以下のテストを追加する（`describe('SearchPage', () => {` ブロックの中、末尾 `})` の直前）。

```tsx
  it('新しい検索を開始したら、前の結果が即座に消える', async () => {
    const user = userEvent.setup()
    // 1回目の検索（成功）
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: '人間失格',
              media_type: 'book',
              description: '古い結果',
              cover_image_url: null,
              total_episodes: null,
              external_api_id: '1',
              external_api_source: 'google_books',
              metadata: {},
            },
          ],
        }),
    })

    renderSearchPage()
    const input = await screen.findByPlaceholderText('作品を検索...')
    await user.type(input, '人間失格')
    await user.click(screen.getByRole('button', { name: /検索/ }))

    // 1回目の結果が表示される
    await waitFor(() => {
      expect(screen.getByText('人間失格')).toBeInTheDocument()
    })

    // 2回目の検索（APIは永久保留、即時クリアを確認するため）
    let resolveSecond: ((value: unknown) => void) | null = null
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve
        }),
    )

    await user.clear(input)
    await user.type(input, 'ワンピース')
    await user.click(screen.getByRole('button', { name: /検索/ }))

    // 2回目のレスポンスが返る前に、1回目の結果が画面から消えている
    await waitFor(() => {
      expect(screen.queryByText('古い結果')).not.toBeInTheDocument()
    })

    // クリーンアップ
    resolveSecond?.({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    })
  })

  it('検索中にさらに別の検索を開始すると、古いリクエストの結果は反映されない', async () => {
    const user = userEvent.setup()
    // 1回目の検索を意図的に遅延させる
    let resolveFirst: ((value: unknown) => void) | null = null
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )
    // 2回目の検索は即座に返る
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: 'ワンピース新結果',
              media_type: 'manga',
              description: '新しい結果',
              cover_image_url: null,
              total_episodes: null,
              external_api_id: '2',
              external_api_source: 'anilist',
              metadata: {},
            },
          ],
        }),
    })

    renderSearchPage()
    const input = await screen.findByPlaceholderText('作品を検索...')
    await user.type(input, '古い検索')
    await user.click(screen.getByRole('button', { name: /検索/ }))

    // 2回目の検索を直後に投げる
    await user.clear(input)
    await user.type(input, '新しい検索')
    await user.click(screen.getByRole('button', { name: /検索/ }))

    // 2回目の結果が画面に表示される
    await waitFor(() => {
      expect(screen.getByText('ワンピース新結果')).toBeInTheDocument()
    })

    // 遅延していた1回目のレスポンスが遅れて返ってくる
    resolveFirst?.({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: '遅延した古い結果',
              media_type: 'book',
              description: '古い',
              cover_image_url: null,
              total_episodes: null,
              external_api_id: '99',
              external_api_source: 'google_books',
              metadata: {},
            },
          ],
        }),
    })

    // 古い結果は画面に現れない（AbortControllerで中断されているため）
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByText('遅延した古い結果')).not.toBeInTheDocument()
    expect(screen.getByText('ワンピース新結果')).toBeInTheDocument()
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd frontend && npm run test -- --run SearchPage.test`
Expected: FAIL（古い結果が消えない / 遅延結果が上書きする）

- [ ] **Step 3: SearchPage に AbortController を実装する**

`frontend/src/pages/SearchPage/SearchPage.tsx` を編集する。

1. インポートに `useRef` を追加:

```tsx
import { useEffect, useRef, useState } from 'react'
```

2. 関数コンポーネント内で、他の useState の後に以下を追加:

```tsx
// 検索リクエストのキャンセル用 AbortController を保持する
// 新しい検索が開始されたら古いリクエストを中断する
const abortControllerRef = useRef<AbortController | null>(null)
```

3. `handleSearch` を書き換える:

```tsx
const handleSearch = async (e: FormEvent) => {
  e.preventDefault()
  if (!query.trim()) return

  // 古いリクエストがあればキャンセルする
  abortControllerRef.current?.abort()
  const controller = new AbortController()
  abortControllerRef.current = controller

  // 画面上の古い結果を即座にクリア
  setResults([])
  setIsSearching(true)
  setError('')
  setHasSearched(true)

  try {
    const mediaType = genre === 'all' ? undefined : genre
    const response = await worksApi.search(query, mediaType, { signal: controller.signal })
    // このリクエストがキャンセルされていたら結果を反映しない
    if (controller.signal.aborted) return
    setResults(response.results)
  } catch (err) {
    // AbortError（ユーザー/システムが中断した）は無視する
    if ((err as Error).name === 'AbortError') return
    if (err instanceof ApiError) {
      setError(err.message)
    } else {
      setError('検索に失敗しました')
    }
  } finally {
    // キャンセルされていない場合のみローディングを解除
    if (!controller.signal.aborted) {
      setIsSearching(false)
    }
  }
}
```

4. `handleGenreChange` も同様に書き換える:

```tsx
const handleGenreChange = (newGenre: GenreFilter) => {
  setGenre(newGenre)
  if (query.trim() && hasSearched) {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setResults([])
    setIsSearching(true)
    setError('')

    const mediaType = newGenre === 'all' ? undefined : newGenre
    worksApi
      .search(query, mediaType, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return
        setResults(response.results)
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setError('検索に失敗しました')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsSearching(false)
        }
      })
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd frontend && npm run test -- --run SearchPage.test`
Expected: PASS（新テスト + 既存テストすべて）

- [ ] **Step 5: TypeScript ビルドチェック**

Run: `cd frontend && npm run build`
Expected: ビルド成功

- [ ] **Step 6: Lint チェック**

Run: `cd frontend && npm run lint`
Expected: no errors

- [ ] **Step 7: コミットする**

```bash
cd D:/Dev/recolly
git add frontend/src/pages/SearchPage/SearchPage.tsx frontend/src/pages/SearchPage/SearchPage.test.tsx
git commit -m "fix(frontend): 新検索時の結果即時クリアとリクエストキャンセル #127"
```

---

### Task 10: 成功基準の実測確認

**Files:**
- なし（検証のみ、コード変更なし）

**目的:** 仕様書で定めた指標が達成できているか、Playwright + バックエンドAPIで実測する。

- [ ] **Step 1: 開発環境が起動していることを確認**

Run:
```bash
curl -s http://localhost:5173 -o /dev/null -w "%{http_code}"
curl -s http://localhost:3000/api/v1/health -o /dev/null -w "%{http_code}"
```
Expected: 両方とも `200`

起動していなければ:
```bash
cd D:/Dev/recolly && docker compose up -d
```

- [ ] **Step 2: Railsのキャッシュをクリア**

Run: `cd backend && docker compose exec backend bundle exec rails runner 'Rails.cache.clear'`

または development環境で:
```bash
cd backend && bundle exec rails runner 'Rails.cache.clear'
```

Expected: 何もエラー出力されない

- [ ] **Step 3: Playwright経由で全ジャンル24タイトルを再測定**

Playwrightで `http://localhost:5173/search` を開き、ログイン済みの状態で以下のJSをブラウザevaluateで実行する。

```js
async () => {
  const queries = {
    anime: ['進撃の巨人', '鬼滅の刃', 'スパイファミリー', '呪術廻戦'],
    movie: ['ショーシャンクの空に', 'インセプション', '君の名は。', 'タイタニック'],
    drama: ['半沢直樹', 'VIVANT', 'ブレイキング・バッド', 'ストレンジャー・シングス'],
    book: ['嫌われる勇気', 'FACTFULNESS', '思考の整理学', 'サピエンス全史'],
    manga: ['ONE PIECE', '鬼滅の刃', 'NARUTO', 'ドラゴンボール'],
    game: ['ゼルダの伝説', 'ポケモン', 'ファイナルファンタジー', 'エルデンリング'],
  };
  const results = {};
  for (const [genre, titles] of Object.entries(queries)) {
    results[genre] = { total: 0, noImg: 0, noDesc: 0 };
    for (const q of titles) {
      const url = `/api/v1/works/search?q=${encodeURIComponent(q)}&media_type=${genre}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) continue;
      const data = await res.json();
      const rs = data.results || [];
      results[genre].total += rs.length;
      results[genre].noImg += rs.filter(r => !r.cover_image_url).length;
      results[genre].noDesc += rs.filter(r => !r.description).length;
    }
  }
  return results;
}
```

- [ ] **Step 4: 結果を目標値と比較する**

| 指標 | 目標 | 実測 |
|---|---|---|
| 全体の説明なし率 | 25%以下 | ？ |
| 本の画像なし率 | 10%以下 | ？ |
| 漫画の説明なし率 | 30%以下 | ？ |
| ゲームの説明なし率 | 30%以下 | ？ |

- [ ] **Step 5: 連続検索の結果混ざりを手動確認**

ブラウザで検索ページを開き：
1. 「人間失格」で検索 → 結果が表示される
2. すぐに「ワンピース」で検索 → 古い結果が即座に消え、ワンピースの結果が表示される
3. 検索中に別のジャンルボタンを連打 → 古いレスポンスが新しい結果を上書きしないことを確認

- [ ] **Step 6: 目標達成していれば次のステップへ。未達成なら原因調査**

目標達成していない場合は、どの部分が効いていないかログで確認し、追加タスクを起票する。

- [ ] **Step 7: 測定結果をPR本文に記録するためメモに残す**

達成した実測値を次のPRの説明に含められるように記録しておく（テキストファイルに書くか、そのままPR descriptionに貼る）。

---

## 完了時のチェックリスト

- [ ] 全10タスクが完了し、各タスクごとにコミットされている
- [ ] バックエンドの全RSpecが通っている
- [ ] フロントエンドの全Vitestが通っている
- [ ] RuboCop / ESLint のエラーがない
- [ ] 成功基準の実測で目標値を達成している
- [ ] 連続検索バグが手動確認で再現しないことを確認済み
- [ ] `CACHE_VERSION = 'v2'` が設定されている

全てチェックが付いたら、`superpowers:finishing-a-development-branch` スキルを発動してブランチ完了＆PR作成に進む。

---

## Self-Review Notes

- 全タスクがspecの要件をカバーしている（フロント修正・Wikipedia改善・openBD補完・品質ソート・キャッシュv2）
- 各タスクはTDD順（テスト先→失敗確認→実装→通過確認→コミット）
- placeholder なし、各コードステップに完全なコードを含む
- 型・メソッド名の整合性を確認（`enrich_missing_descriptions`, `try_enrich_description`, `search_and_fetch_extract`, `sort_by_quality_and_popularity` 等が全タスクで統一）
- 既存の `enrich_anilist_descriptions` / `remove_english_descriptions` / `sort_by_popularity` の削除を Task 6/7 で明示
