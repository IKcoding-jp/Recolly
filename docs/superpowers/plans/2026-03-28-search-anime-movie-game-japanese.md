# 検索改善: アニメ映画分類 + ゲーム日本語検索 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アニメ映画を「映画」に正しく分類し、ゲーム検索にWikipedia日本語APIを補完ソースとして追加する。

**Architecture:** AniListアダプターに`format`フィールドを追加してMOVIE→movieにマッピング。新規WikipediaGameAdapterを作成してIgdbAdapterから呼び出し、日本語クエリ時にWikipediaタイトルでIGDB再検索して結果をマージする。フロントエンドにゲーム検索ヒントを追加。

**Tech Stack:** Ruby/Rails (backend), TypeScript/React (frontend), Wikipedia MediaWiki API, RSpec, Vitest

---

## ファイル構成

| 操作 | ファイルパス | 責務 |
|------|------------|------|
| 修正 | `backend/app/services/external_apis/anilist_adapter.rb` | format→media_typeマッピング追加 |
| 新規 | `backend/app/services/external_apis/wikipedia_game_adapter.rb` | Wikipedia JP検索＆記事概要取得 |
| 修正 | `backend/app/services/external_apis/igdb_adapter.rb` | Wikipedia補完ロジック追加 |
| 修正 | `frontend/src/pages/SearchPage/SearchPage.tsx` | 英語検索ヒント表示 |
| 修正 | `backend/spec/services/external_apis/anilist_adapter_spec.rb` | formatテスト追加 |
| 新規 | `backend/spec/services/external_apis/wikipedia_game_adapter_spec.rb` | Wikipediaアダプターテスト |
| 修正 | `backend/spec/services/external_apis/igdb_adapter_spec.rb` | Wikipedia補完テスト追加 |
| 修正 | `frontend/src/pages/SearchPage/__tests__/SearchPage.test.tsx`（あれば）| ヒント表示テスト |

---

### Task 1: AniList formatフィールドでアニメ映画を「映画」に分類

**Files:**
- Modify: `backend/app/services/external_apis/anilist_adapter.rb`
- Modify: `backend/spec/services/external_apis/anilist_adapter_spec.rb`

- [ ] **Step 1: テストデータにformat追加 + アニメ映画テスト作成**

`backend/spec/services/external_apis/anilist_adapter_spec.rb` の既存テストデータに `'format'` フィールドを追加し、アニメ映画テストを新規追加する。

既存テストデータの変更（2箇所）:
```ruby
# 進撃の巨人（TVアニメ）のデータに追加
'seasonYear' => 2013,
'popularity' => 500_000,
'format' => 'TV'

# 進撃の巨人（漫画版）のデータに追加
'status' => 'FINISHED',
'popularity' => 300_000,
'format' => 'MANGA'
```

新規テストケース:
```ruby
context 'アニメ映画' do
  let(:movie_response) do
    {
      'data' => {
        'Page' => {
          'media' => [
            {
              'id' => 199,
              'title' => { 'romaji' => 'Sen to Chihiro no Kamikakushi', 'native' => '千と千尋の神隠し', 'english' => 'Spirited Away' },
              'description' => 'A young girl becomes trapped in a strange new world of spirits',
              'coverImage' => { 'large' => 'https://example.com/spirited.jpg' },
              'episodes' => 1,
              'type' => 'ANIME',
              'format' => 'MOVIE',
              'genres' => %w[Adventure Fantasy],
              'status' => 'FINISHED',
              'seasonYear' => 2001,
              'popularity' => 200_000
            },
            {
              'id' => 20,
              'title' => { 'romaji' => 'Naruto', 'native' => 'NARUTO -ナルト-' },
              'description' => 'Ninja anime',
              'coverImage' => { 'large' => 'https://example.com/naruto.jpg' },
              'episodes' => 220,
              'type' => 'ANIME',
              'format' => 'TV',
              'genres' => %w[Action Adventure],
              'status' => 'FINISHED',
              'seasonYear' => 2002,
              'popularity' => 400_000
            }
          ]
        }
      }
    }
  end

  before do
    stub_request(:post, 'https://graphql.anilist.co')
      .to_return(status: 200, body: movie_response.to_json,
                 headers: { 'Content-Type' => 'application/json' })
  end

  it 'format: MOVIE のアニメを movie に分類する' do
    results = adapter.search('千と千尋')
    movie = results.find { |r| r.title == '千と千尋の神隠し' }
    expect(movie.media_type).to eq('movie')
  end

  it 'format: TV のアニメは anime のまま' do
    results = adapter.search('千と千尋')
    tv = results.find { |r| r.title == 'NARUTO -ナルト-' }
    expect(tv.media_type).to eq('anime')
  end
end
```

- [ ] **Step 2: テスト実行 → 失敗確認**

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/anilist_adapter_spec.rb --format documentation`
Expected: 新規テスト2件がFAIL（format: MOVIEがanimeのままになる）

- [ ] **Step 3: AniListアダプター実装**

`backend/app/services/external_apis/anilist_adapter.rb`:

GraphQLクエリに`format`を追加:
```ruby
SEARCH_QUERY = <<~GRAPHQL
  query ($search: String) {
    Page(perPage: 20) {
      media(search: $search, isAdult: false, sort: POPULARITY_DESC) {
        id
        title { romaji native english }
        description(asHtml: false)
        coverImage { large }
        episodes
        chapters
        type
        format
        genres
        status
        seasonYear
        popularity
      }
    }
  }
GRAPHQL
```

`normalize`メソッドのmedia_type判定を変更:
```ruby
def normalize(item)
  media_type = determine_media_type(item)
  title = item.dig('title', 'native') ||
          item.dig('title', 'english') ||
          item.dig('title', 'romaji')

  SearchResult.new(
    title, media_type, item['description'],
    item.dig('coverImage', 'large'),
    item['episodes'] || item['chapters'],
    item['id'].to_s, 'anilist', build_metadata(item)
  )
end

# AniListのtype + formatからRecollyのmedia_typeを判定
def determine_media_type(item)
  return 'manga' if item['type'] == 'MANGA'
  return 'movie' if item['format'] == 'MOVIE'

  'anime'
end
```

- [ ] **Step 4: テスト実行 → パス確認**

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/anilist_adapter_spec.rb --format documentation`
Expected: 全テストPASS

- [ ] **Step 5: RuboCopチェック**

Run: `docker compose exec -T backend bundle exec rubocop app/services/external_apis/anilist_adapter.rb`
Expected: no offenses detected

- [ ] **Step 6: コミット**

```bash
git add backend/app/services/external_apis/anilist_adapter.rb backend/spec/services/external_apis/anilist_adapter_spec.rb
git commit -m "feat: AniList format=MOVIEのアニメ映画をmovieに分類 (#60)"
```

---

### Task 2: WikipediaGameAdapter 新規作成

**Files:**
- Create: `backend/app/services/external_apis/wikipedia_game_adapter.rb`
- Create: `backend/spec/services/external_apis/wikipedia_game_adapter_spec.rb`

- [ ] **Step 1: テスト作成**

`backend/spec/services/external_apis/wikipedia_game_adapter_spec.rb`:
```ruby
# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::WikipediaGameAdapter, type: :service do
  subject(:adapter) { described_class.new }

  describe '#search_titles' do
    let(:search_response) do
      {
        'query' => {
          'search' => [
            { 'title' => '星のカービィ スーパーデラックス', 'snippet' => 'ゲームソフト' },
            { 'title' => '星のカービィ Wii', 'snippet' => 'アクションゲーム' },
            { 'title' => '星のカービィ (アニメ)', 'snippet' => 'テレビアニメ' }
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
      titles = adapter.search_titles('カービィ')
      expect(titles).to include('星のカービィ スーパーデラックス')
      expect(titles).to include('星のカービィ Wii')
    end

    it '最大10件のタイトルを返す' do
      titles = adapter.search_titles('カービィ')
      expect(titles.length).to be <= 10
    end
  end

  describe '#fetch_extract' do
    let(:extract_response) do
      {
        'query' => {
          'pages' => {
            '12345' => {
              'title' => '星のカービィ スーパーデラックス',
              'extract' => '星のカービィ スーパーデラックスは、1996年に任天堂が発売したスーパーファミコン用アクションゲーム。'
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
      extract = adapter.fetch_extract('星のカービィ スーパーデラックス')
      expect(extract).to include('1996年')
      expect(extract).to include('アクションゲーム')
    end

    it '記事が存在しない場合はnilを返す' do
      stub_request(:get, /ja.wikipedia.org/)
        .to_return(status: 200, body: { 'query' => { 'pages' => { '-1' => { 'missing' => '' } } } }.to_json,
                   headers: { 'Content-Type' => 'application/json' })
      expect(adapter.fetch_extract('存在しないページ')).to be_nil
    end
  end

  describe 'エラーハンドリング' do
    it 'API通信エラー時にsearch_titlesは空配列を返す' do
      stub_request(:get, /ja.wikipedia.org/).to_timeout
      expect(adapter.search_titles('テスト')).to eq([])
    end

    it 'API通信エラー時にfetch_extractはnilを返す' do
      stub_request(:get, /ja.wikipedia.org/).to_timeout
      expect(adapter.fetch_extract('テスト')).to be_nil
    end
  end
end
```

- [ ] **Step 2: テスト実行 → 失敗確認**

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/wikipedia_game_adapter_spec.rb --format documentation`
Expected: FAIL（クラスが存在しない）

- [ ] **Step 3: WikipediaGameAdapter実装**

`backend/app/services/external_apis/wikipedia_game_adapter.rb`:
```ruby
# frozen_string_literal: true

module ExternalApis
  # 日本語Wikipediaからゲームタイトルと説明文を取得する補完アダプター
  # BaseAdapterを継承しない（単独で検索結果を返さず、IgdbAdapterの補完として使う）
  class WikipediaGameAdapter
    ENDPOINT = 'https://ja.wikipedia.org/w/api.php'

    # 日本語Wikipediaでキーワード検索し、記事タイトルの一覧を返す
    def search_titles(query)
      response = wikipedia_connection.get('', search_params(query))
      results = response.body.dig('query', 'search') || []
      results.map { |r| r['title'] }
    rescue Faraday::Error => e
      Rails.logger.error("[WikipediaGameAdapter] 検索エラー: #{e.message}")
      []
    end

    # 指定タイトルのWikipedia記事から冒頭テキスト（概要）を取得する
    def fetch_extract(title)
      response = wikipedia_connection.get('', extract_params(title))
      pages = response.body.dig('query', 'pages') || {}
      page = pages.values.first
      return nil if page.nil? || page.key?('missing')

      page['extract'].presence
    rescue Faraday::Error => e
      Rails.logger.error("[WikipediaGameAdapter] 概要取得エラー: #{e.message}")
      nil
    end

    private

    def wikipedia_connection
      @wikipedia_connection ||= Faraday.new(url: ENDPOINT, request: { open_timeout: 5, timeout: 10 }) do |f|
        f.response :json
        f.headers['User-Agent'] = 'Recolly/1.0 (https://github.com/IKcoding-jp/Recolly)'
        f.adapter Faraday.default_adapter
      end
    end

    def search_params(query)
      {
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: 10,
        format: 'json'
      }
    end

    def extract_params(title)
      {
        action: 'query',
        titles: title,
        prop: 'extracts',
        exintro: true,
        explaintext: true,
        format: 'json'
      }
    end
  end
end
```

- [ ] **Step 4: テスト実行 → パス確認**

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/wikipedia_game_adapter_spec.rb --format documentation`
Expected: 全テストPASS

- [ ] **Step 5: RuboCopチェック**

Run: `docker compose exec -T backend bundle exec rubocop app/services/external_apis/wikipedia_game_adapter.rb`
Expected: no offenses detected

- [ ] **Step 6: コミット**

```bash
git add backend/app/services/external_apis/wikipedia_game_adapter.rb backend/spec/services/external_apis/wikipedia_game_adapter_spec.rb
git commit -m "feat: WikipediaGameAdapter新規作成（日本語ゲーム検索補完） (#60)"
```

---

### Task 3: IgdbAdapterにWikipedia補完ロジック追加

**Files:**
- Modify: `backend/app/services/external_apis/igdb_adapter.rb`
- Modify: `backend/spec/services/external_apis/igdb_adapter_spec.rb`

- [ ] **Step 1: テスト追加**

`backend/spec/services/external_apis/igdb_adapter_spec.rb` に以下のコンテキストを追加:

```ruby
context '日本語クエリ + Wikipedia補完' do
  let(:wikipedia_double) { instance_double(ExternalApis::WikipediaGameAdapter) }

  let(:igdb_direct_response) { [] }
  let(:igdb_pattern_response) { [] }

  # Wikipedia → "星のカービィ スーパーデラックス" を発見
  # → そのタイトルでIGDB再検索 → ゲームが見つかる
  let(:igdb_wikipedia_match_response) do
    [
      {
        'id' => 3075,
        'name' => 'Kirby Super Star',
        'summary' => 'A Kirby game',
        'cover' => { 'image_id' => 'co5xyz' },
        'total_rating' => 88.0,
        'alternative_names' => [
          { 'name' => '星のカービィ スーパーデラックス', 'comment' => 'Japanese title' }
        ]
      }
    ]
  end

  before do
    allow(ExternalApis::WikipediaGameAdapter).to receive(:new).and_return(wikipedia_double)
    allow(wikipedia_double).to receive(:search_titles)
      .with('カービィ')
      .and_return(['星のカービィ スーパーデラックス', '星のカービィ Wii', '星のカービィ (アニメ)'])
    allow(wikipedia_double).to receive(:fetch_extract)
      .and_return('任天堂が発売したアクションゲーム。')

    # 1回目: search_by_keyword（日本語）→ 0件
    # 2回目: search_by_pattern（日本語）→ 0件
    # 3回目以降: Wikipedia タイトルでIGDB再検索 → ヒット
    stub_request(:post, 'https://api.igdb.com/v4/games')
      .to_return(
        { status: 200, body: igdb_direct_response.to_json, headers: { 'Content-Type' => 'application/json' } },
        { status: 200, body: igdb_pattern_response.to_json, headers: { 'Content-Type' => 'application/json' } },
        { status: 200, body: igdb_wikipedia_match_response.to_json, headers: { 'Content-Type' => 'application/json' } },
        { status: 200, body: [].to_json, headers: { 'Content-Type' => 'application/json' } },
        { status: 200, body: [].to_json, headers: { 'Content-Type' => 'application/json' } }
      )
  end

  it 'IGDB直接検索で見つからないゲームをWikipedia経由で見つける' do
    results = adapter.search('カービィ')
    expect(results.length).to eq(1)
    expect(results.first.external_api_id).to eq('3075')
  end

  it 'Wikipedia経由の結果に日本語タイトルをセットする' do
    results = adapter.search('カービィ')
    expect(results.first.title).to eq('星のカービィ スーパーデラックス')
  end

  it 'Wikipedia経由の結果に日本語説明をセットする' do
    results = adapter.search('カービィ')
    expect(results.first.description).to eq('任天堂が発売したアクションゲーム。')
  end
end

context '英語クエリではWikipedia検索を呼ばない' do
  let(:wikipedia_double) { instance_double(ExternalApis::WikipediaGameAdapter) }

  before do
    allow(ExternalApis::WikipediaGameAdapter).to receive(:new).and_return(wikipedia_double)
    stub_request(:post, 'https://api.igdb.com/v4/games')
      .to_return(status: 200, body: igdb_response.to_json,
                 headers: { 'Content-Type' => 'application/json' })
  end

  it 'WikipediaGameAdapterを呼び出さない' do
    adapter.search('Witcher')
    expect(wikipedia_double).not_to have_received(:search_titles)
  end
end
```

- [ ] **Step 2: テスト実行 → 失敗確認**

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/igdb_adapter_spec.rb --format documentation`
Expected: 新規テスト4件がFAIL

- [ ] **Step 3: IgdbAdapter実装**

`backend/app/services/external_apis/igdb_adapter.rb` の `search_japanese` メソッドを変更:

```ruby
# 日本語: IGDB直接検索 + Wikipedia補完を組み合わせる
def search_japanese(sanitized)
  # ① IGDB直接検索（全文検索 + パターンマッチ）
  keyword_results = search_by_keyword(sanitized)
  pattern_results = search_by_pattern(sanitized)
  igdb_results = merge_results(keyword_results, pattern_results)

  # ② Wikipedia JP で日本語タイトル候補を取得し、IGDBで再検索
  wikipedia_results = search_via_wikipedia(sanitized, igdb_results)

  # ③ マージ
  merge_results(igdb_results, wikipedia_results)
end

# Wikipedia JP で日本語タイトルを取得し、各タイトルでIGDBを再検索
# IGDBにマッチしたゲームのみ、日本語タイトル・説明付きで返す
def search_via_wikipedia(query, existing_results)
  wikipedia = WikipediaGameAdapter.new
  titles = wikipedia.search_titles(query)
  return [] if titles.empty?

  existing_ids = existing_results.to_set(&:external_api_id)
  results = []

  titles.each do |jp_title|
    igdb_matches = search_by_keyword(jp_title)
    next if igdb_matches.empty?

    match = igdb_matches.first
    next if existing_ids.include?(match.external_api_id)

    # Wikipedia日本語タイトルと説明で上書き
    description = wikipedia.fetch_extract(jp_title)
    match.title = jp_title
    match.description = description if description.present?

    existing_ids.add(match.external_api_id)
    results << match
  end

  results
rescue StandardError => e
  Rails.logger.error("[IgdbAdapter] Wikipedia補完エラー: #{e.message}")
  []
end
```

- [ ] **Step 4: テスト実行 → パス確認**

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/igdb_adapter_spec.rb --format documentation`
Expected: 全テストPASS

- [ ] **Step 5: RuboCopチェック**

Run: `docker compose exec -T backend bundle exec rubocop app/services/external_apis/igdb_adapter.rb`
Expected: no offenses detected（行長オーバーがあれば修正）

- [ ] **Step 6: コミット**

```bash
git add backend/app/services/external_apis/igdb_adapter.rb backend/spec/services/external_apis/igdb_adapter_spec.rb
git commit -m "feat: IgdbAdapterにWikipedia日本語補完ロジック追加 (#60)"
```

---

### Task 4: フロントエンド英語検索ヒント表示

**Files:**
- Modify: `frontend/src/pages/SearchPage/SearchPage.tsx`

- [ ] **Step 1: 日本語判定ヘルパー追加**

`frontend/src/pages/SearchPage/SearchPage.tsx` に日本語判定関数を追加:

```typescript
// 日本語文字（ひらがな・カタカナ・漢字）が含まれるか判定
function containsJapanese(text: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)
}
```

- [ ] **Step 2: ヒント表示を追加**

検索結果の表示部分で、ゲーム結果が少ない場合にヒントを表示する。`{results.length > 0 && (` ブロックの直前に追加:

```tsx
{!isSearching && hasSearched && results.length > 0 && shouldShowEnglishHint(results, query) && (
  <p className={styles.hint}>
    海外ゲームは英語タイトルでも検索してみてください
  </p>
)}
```

`shouldShowEnglishHint` 関数:
```typescript
function shouldShowEnglishHint(results: SearchResult[], query: string): boolean {
  if (!containsJapanese(query)) return false
  const gameCount = results.filter((r) => r.media_type === 'game').length
  return gameCount <= 3
}
```

- [ ] **Step 3: CSSスタイル追加**

`frontend/src/pages/SearchPage/SearchPage.module.css` に追加:
```css
.hint {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  text-align: center;
  margin-top: var(--spacing-sm);
}
```

- [ ] **Step 4: ビルド確認**

Run: `docker compose exec -T frontend npm run build`
Expected: ビルド成功

- [ ] **Step 5: ESLint確認**

Run: `docker compose exec -T frontend npx eslint src/pages/SearchPage/SearchPage.tsx`
Expected: no errors

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/SearchPage/SearchPage.tsx frontend/src/pages/SearchPage/SearchPage.module.css
git commit -m "feat: ゲーム検索結果が少ないとき英語検索ヒントを表示 (#60)"
```

---

### Task 5: 全体テスト + リンターパス確認

- [ ] **Step 1: バックエンド全テスト**

Run: `docker compose exec -T backend bundle exec rspec --format progress`
Expected: 全テストPASS、0 failures

- [ ] **Step 2: バックエンドRuboCop**

Run: `docker compose exec -T backend bundle exec rubocop`
Expected: no offenses detected

- [ ] **Step 3: フロントエンドビルド + リンター**

Run: `docker compose exec -T frontend npm run build && docker compose exec -T frontend npx eslint src/`
Expected: 成功

- [ ] **Step 4: コミット（必要な修正があれば）**

```bash
git add -A && git commit -m "fix: リンター・テスト修正 (#60)"
```
