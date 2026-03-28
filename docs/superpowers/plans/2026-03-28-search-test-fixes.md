# 検索テスト結果の追加修正 — 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ジャンルフィルタの厳密化、本の検索精度改善、TMDB説明文の誤マッチ防止、英語説明文の非表示の4点を修正する。

**Architecture:** WorkSearchServiceにmedia_typeフィルタを追加、GoogleBooksAdapterにタイトルフィルタを追加、TmdbAdapterにoriginal_language優先ロジックを追加、WorkSearchServiceに英語説明除去処理を追加する。各修正は独立しており、既存のアダプターパターンに沿って実装する。

**Tech Stack:** Ruby 3.3 / Rails 8 / RSpec / WebMock

---

## ファイル構成

| 操作 | ファイル | 責務 |
|------|---------|------|
| 変更 | `backend/app/services/work_search_service.rb` | media_typeフィルタ + 英語説明除去 |
| 変更 | `backend/spec/services/work_search_service_spec.rb` | 上記のテスト |
| 変更 | `backend/app/services/external_apis/google_books_adapter.rb` | タイトルフィルタ |
| 変更 | `backend/spec/services/external_apis/google_books_adapter_spec.rb` | 上記のテスト |
| 変更 | `backend/app/services/external_apis/tmdb_adapter.rb` | original_language優先 |
| 変更 | `backend/spec/services/external_apis/tmdb_adapter_spec.rb` | 上記のテスト |

---

## Task 1: ジャンルフィルタの厳密化

`WorkSearchService#search` で、media_typeが指定されている場合に結果をフィルタリングする。

**Files:**
- Modify: `backend/app/services/work_search_service.rb`
- Modify: `backend/spec/services/work_search_service_spec.rb`

### Step 1-1: ジャンルフィルタのテストを書く

- [ ] `work_search_service_spec.rb` の `describe '#search'` ブロック内に以下のテストを追加する。既存の `'media_type: game で IgdbAdapter のみに問い合わせる'` テストの後に追加：

```ruby
    it 'media_type指定時にアダプターが返した別ジャンルの結果を除外する' do
      manga_result = ExternalApis::BaseAdapter::SearchResult.new(
        'けいおん!', 'manga', 'マンガ版', nil, nil, '2', 'anilist', { popularity: 0.3 }
      )
      anime_result = ExternalApis::BaseAdapter::SearchResult.new(
        'けいおん!', 'anime', 'アニメ版', nil, 13, '3', 'anilist', { popularity: 0.7 }
      )
      allow(anilist_double).to receive(:safe_search).and_return([manga_result, anime_result])

      results = service.search('けいおん', media_type: 'anime')
      expect(results.map(&:media_type)).to all(eq('anime'))
      expect(results.length).to eq(1)
    end

    it 'media_type未指定時は全ジャンルの結果を返す' do
      manga_result = ExternalApis::BaseAdapter::SearchResult.new(
        'けいおん!', 'manga', 'マンガ版', nil, nil, '2', 'anilist', { popularity: 0.3 }
      )
      allow(anilist_double).to receive(:safe_search).and_return([mock_result, manga_result])

      results = service.search('けいおん')
      expect(results.map(&:media_type)).to contain_exactly('anime', 'manga')
    end
```

- [ ] テストを実行して失敗を確認する。

Run: `docker compose run --rm -T backend bundle exec rspec spec/services/work_search_service_spec.rb -e '別ジャンルの結果を除外' -fd`
Expected: FAIL（フィルタが未実装のため manga_result が含まれる）

### Step 1-2: ジャンルフィルタを実装する

- [ ] `work_search_service.rb` の `search` メソッドを以下に書き換える：

```ruby
  def search(query, media_type: nil)
    cache_key = "work_search:#{media_type || 'all'}:#{query}"

    Rails.cache.fetch(cache_key, expires_in: CACHE_TTL) do
      adapters = select_adapters(media_type)
      results = adapters.flat_map { |adapter| adapter.safe_search(query) }
      results = results.select { |r| r.media_type == media_type } if media_type.present?
      enrich_anilist_descriptions(results)
      sort_by_popularity(results)
    end
  end
```

- [ ] テストを実行してパスを確認する。

Run: `docker compose run --rm -T backend bundle exec rspec spec/services/work_search_service_spec.rb -fd`
Expected: PASS（全テスト）

### Step 1-3: コミット

- [ ] コミットする。

```bash
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "fix: ジャンルフィルタでアダプターが返した別ジャンルの結果を除外 (#61)"
```

---

## Task 2: 本の検索精度改善

Google Booksの結果をタイトルフィルタで絞り込む。

**Files:**
- Modify: `backend/app/services/external_apis/google_books_adapter.rb`
- Modify: `backend/spec/services/external_apis/google_books_adapter_spec.rb`

### Step 2-1: タイトルフィルタのテストを書く

- [ ] `google_books_adapter_spec.rb` の `describe '#search'` ブロック内に以下のテストを追加する。既存の `'結果がない場合は空配列を返す'` テストの後に追加：

```ruby
    it '検索キーワードがタイトルに含まれない結果を除外する' do
      mixed_response = {
        'items' => [
          { 'id' => '1', 'volumeInfo' => { 'title' => '三体', 'description' => 'SF小説' } },
          { 'id' => '2', 'volumeInfo' => { 'title' => '三体II 黒暗森林', 'description' => '続編' } },
          { 'id' => '3', 'volumeInfo' => { 'title' => '電離気体の原子・分子過程', 'description' => '物理学' } }
        ]
      }
      stub_request(:get, %r{www.googleapis.com/books/v1/volumes})
        .to_return(status: 200, body: mixed_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })

      results = adapter.search('三体')
      expect(results.map(&:title)).to contain_exactly('三体', '三体II 黒暗森林')
      expect(results.map(&:title)).not_to include('電離気体の原子・分子過程')
    end

    it 'タイトルフィルタは大文字小文字を区別しない' do
      english_response = {
        'items' => [
          { 'id' => '1', 'volumeInfo' => { 'title' => 'Harry Potter and the Philosopher\'s Stone' } },
          { 'id' => '2', 'volumeInfo' => { 'title' => 'Unrelated Book' } }
        ]
      }
      stub_request(:get, %r{www.googleapis.com/books/v1/volumes})
        .to_return(status: 200, body: english_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })

      results = adapter.search('harry potter')
      expect(results.length).to eq(1)
      expect(results.first.title).to eq('Harry Potter and the Philosopher\'s Stone')
    end
```

- [ ] テストを実行して失敗を確認する。

Run: `docker compose run --rm -T backend bundle exec rspec spec/services/external_apis/google_books_adapter_spec.rb -e 'タイトルに含まれない' -fd`
Expected: FAIL（フィルタ未実装のため無関係な本が含まれる）

### Step 2-2: タイトルフィルタを実装する

- [ ] `google_books_adapter.rb` の `search` メソッドを以下に書き換える：

```ruby
    def search(query)
      params = { q: query, key: ENV.fetch('GOOGLE_BOOKS_API_KEY'), maxResults: 20, langRestrict: 'ja' }
      response = books_connection.get('/books/v1/volumes', params)

      items = response.body['items'] || []
      results = items.map { |item| normalize(item) }
      filter_by_title(results, query)
    end
```

- [ ] 同ファイルの `private` セクションに `filter_by_title` メソッドを追加する（`books_connection` の前に追加）：

```ruby
    # 検索キーワードがタイトルに含まれる結果のみ残す（大文字小文字区別なし）
    def filter_by_title(results, query)
      query_downcase = query.downcase
      results.select { |r| r.title&.downcase&.include?(query_downcase) }
    end
```

- [ ] テストを実行してパスを確認する。

Run: `docker compose run --rm -T backend bundle exec rspec spec/services/external_apis/google_books_adapter_spec.rb -fd`
Expected: PASS（全テスト）

### Step 2-3: コミット

- [ ] コミットする。

```bash
git add backend/app/services/external_apis/google_books_adapter.rb backend/spec/services/external_apis/google_books_adapter_spec.rb
git commit -m "fix: Google Books検索にタイトルフィルタを追加（無関係な結果を除外） (#61)"
```

---

## Task 3: TMDB説明文の誤マッチ防止

`TmdbAdapter#fetch_japanese_description` で日本語原語の結果を優先する。

**Files:**
- Modify: `backend/app/services/external_apis/tmdb_adapter.rb`
- Modify: `backend/spec/services/external_apis/tmdb_adapter_spec.rb`

### Step 3-1: original_language優先のテストを書く

- [ ] `tmdb_adapter_spec.rb` の `describe '#fetch_japanese_description'` ブロック内に以下のテストを追加する。既存の `'API通信エラー時はnilを返す'` テストの後に追加：

```ruby
    it '同名の外国作品より日本語原語の作品を優先する' do
      mixed_results = {
        'results' => [
          { 'media_type' => 'movie', 'original_language' => 'en',
            'overview' => 'American SF movie', 'title' => 'Attack on Titan' },
          { 'media_type' => 'tv', 'original_language' => 'ja',
            'overview' => '巨人が支配する世界で人類が戦う', 'name' => '進撃の巨人' }
        ]
      }
      stub_request(:get, %r{api.themoviedb.org/3/search/multi})
        .to_return(status: 200, body: mixed_results.to_json,
                   headers: { 'Content-Type' => 'application/json' })

      description = adapter.fetch_japanese_description('Attack on Titan')
      expect(description).to eq('巨人が支配する世界で人類が戦う')
    end

    it '日本語原語の結果がない場合は最初のmovie/tvにフォールバックする' do
      english_only = {
        'results' => [
          { 'media_type' => 'person' },
          { 'media_type' => 'movie', 'original_language' => 'en',
            'overview' => 'An English movie', 'title' => 'Some Movie' }
        ]
      }
      stub_request(:get, %r{api.themoviedb.org/3/search/multi})
        .to_return(status: 200, body: english_only.to_json,
                   headers: { 'Content-Type' => 'application/json' })

      description = adapter.fetch_japanese_description('Some Movie')
      expect(description).to eq('An English movie')
    end
```

- [ ] テストを実行して失敗を確認する。

Run: `docker compose run --rm -T backend bundle exec rspec spec/services/external_apis/tmdb_adapter_spec.rb -e '日本語原語' -fd`
Expected: FAIL（現在は最初のmovie/tvを返すため、英語作品の説明文が返る）

### Step 3-2: original_language優先ロジックを実装する

- [ ] `tmdb_adapter.rb` の `fetch_japanese_description` メソッドを以下に書き換える：

```ruby
    def fetch_japanese_description(query)
      response = tmdb_connection.get('/3/search/multi',
                                     api_key: ENV.fetch('TMDB_API_KEY'),
                                     query: query,
                                     language: 'ja')

      results = response.body['results'] || []
      candidates = results.select { |item| %w[movie tv].include?(item['media_type']) }
      # 日本語原語の作品を優先（同名の外国作品との誤マッチを防止）
      match = candidates.find { |item| item['original_language'] == 'ja' } || candidates.first
      match&.dig('overview').presence
    rescue Faraday::Error => e
      Rails.logger.error("[TmdbAdapter] 日本語説明取得エラー: #{e.message}")
      nil
    end
```

- [ ] テストを実行してパスを確認する。

Run: `docker compose run --rm -T backend bundle exec rspec spec/services/external_apis/tmdb_adapter_spec.rb -fd`
Expected: PASS（全テスト）

### Step 3-3: コミット

- [ ] コミットする。

```bash
git add backend/app/services/external_apis/tmdb_adapter.rb backend/spec/services/external_apis/tmdb_adapter_spec.rb
git commit -m "fix: TMDB説明文取得で日本語原語の作品を優先（誤マッチ防止） (#61)"
```

---

## Task 4: 英語説明文の非表示

日本語説明が見つからなかったAniList結果の英語説明文をnilにする。

**Files:**
- Modify: `backend/app/services/work_search_service.rb`
- Modify: `backend/spec/services/work_search_service_spec.rb`

### Step 4-1: 英語説明除去のテストを書く

- [ ] `work_search_service_spec.rb` の `describe 'AniList日本語説明補完'` ブロック内に以下のテストを追加する。`context 'TMDBで見つからない場合のWikipedia補完'` ブロックの後に追加：

```ruby
    it '日本語説明が見つからなかった場合、英語説明を除去する' do
      english_anime = ExternalApis::BaseAdapter::SearchResult.new(
        'マイナーOVA', 'anime', 'This is a minor OVA episode.',
        nil, 1, '88888', 'anilist',
        { popularity: 0.05, title_english: 'Minor OVA', title_romaji: 'Minor OVA' }
      )
      allow(anilist_double).to receive(:safe_search).and_return([english_anime])
      allow(tmdb_double).to receive(:fetch_japanese_description).and_return(nil)

      results = service.search('マイナーOVA')
      expect(results.first.description).to be_nil
    end

    it '日本語説明が取得できた結果は変更されない' do
      allow(tmdb_double).to receive(:fetch_japanese_description)
        .with('Attack on Titan')
        .and_return('巨人が支配する世界で人類が生き残りをかけて戦う')

      results = service.search('進撃の巨人')
      expect(results.first.description).to eq('巨人が支配する世界で人類が生き残りをかけて戦う')
    end
```

- [ ] テストを実行して失敗を確認する。

Run: `docker compose run --rm -T backend bundle exec rspec spec/services/work_search_service_spec.rb -e '英語説明を除去' -fd`
Expected: FAIL（英語説明がそのまま残るため）

### Step 4-2: 英語説明除去を実装する

- [ ] `work_search_service.rb` の `enrich_anilist_descriptions` メソッドを以下に書き換える：

```ruby
  # AniListの結果にTMDB→Wikipediaの順で日本語説明を補完する
  # AniListの説明は英語のため、日本語の説明が見つかれば置き換える
  # 日本語が見つからない場合は英語説明を除去する（説明なしで表示）
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
      # ③ 日本語説明が見つかれば置き換え、見つからなければ英語説明を除去
      result.description = english_text?(result.description) ? description : result.description
    end
  end
```

- [ ] 同ファイルの `private` セクション内（`sort_by_popularity` の前など）に `english_text?` メソッドを追加する：

```ruby
  # 文字列の半分以上がASCII文字なら英語と判定
  def english_text?(text)
    return false if text.blank?

    ascii_ratio = text.count("\x20-\x7E").to_f / text.length
    ascii_ratio > 0.5
  end
```

- [ ] テストを実行してパスを確認する。

Run: `docker compose run --rm -T backend bundle exec rspec spec/services/work_search_service_spec.rb -fd`
Expected: PASS（全テスト）

### Step 4-3: コミット

- [ ] コミットする。

```bash
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "fix: AniList英語説明文を除去（日本語説明が見つからない場合は説明なし） (#61)"
```

---

## Task 5: 全テスト + リンター確認

### Step 5-1: 関連テストを全て実行する

- [ ] 変更した全ファイルのテストを実行する。

Run: `docker compose run --rm -T backend bundle exec rspec spec/services/external_apis/ spec/services/work_search_service_spec.rb -fd`
Expected: ALL PASS

### Step 5-2: RuboCopを実行する

- [ ] 変更したファイルにリンターを適用する。

Run: `docker compose run --rm -T backend bundle exec rubocop app/services/work_search_service.rb app/services/external_apis/google_books_adapter.rb app/services/external_apis/tmdb_adapter.rb --autocorrect-all`
Expected: no offenses detected（または自動修正完了）

### Step 5-3: テストファイルにもRuboCopを実行する

- [ ] テストファイルにもリンターを適用する。

Run: `docker compose run --rm -T backend bundle exec rubocop spec/services/work_search_service_spec.rb spec/services/external_apis/google_books_adapter_spec.rb spec/services/external_apis/tmdb_adapter_spec.rb --autocorrect-all`
Expected: no offenses detected（または自動修正完了）

### Step 5-4: リンター修正があればコミット

- [ ] RuboCopの自動修正があった場合のみコミットする。

```bash
git add -A
git commit -m "style: RuboCop自動修正 (#61)"
```
