# TMDB検索改善 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ドラマ・映画検索の精度と件数を改善する（API分離 + 中黒バリエーション検索）

**Architecture:** TMDBアダプターの `search/multi` を `search/tv` / `search/movie` に分離し、カタカナ語の中黒バリエーションによるフォールバック検索を追加する

**Tech Stack:** Ruby / Rails / RSpec / Faraday / TMDB API

---

### Task 1: search/multi を search/tv / search/movie に分離

**Files:**
- Modify: `backend/app/services/external_apis/tmdb_adapter.rb`
- Modify: `backend/spec/services/external_apis/tmdb_adapter_spec.rb`

- [ ] **Step 1: テストの WebMock を search/tv, search/movie に変更**

既存テストの `stub_request` を `search/multi` から `search/tv` と `search/movie` に変更する。
`search` メソッドのテストで、レスポンスから `media_type` フィールドを削除する（search/tv, search/movie は結果に `media_type` を含まないため）。

```ruby
# tmdb_adapter_spec.rb — describe '#search' 内の let と before を置き換え

let(:movie_response) do
  {
    'results' => [
      {
        'id' => 550,
        'title' => 'ファイト・クラブ',
        'overview' => '空虚な生活を送る男の物語',
        'poster_path' => '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
        'release_date' => '1999-10-15',
        'genre_ids' => [18, 53],
        'original_language' => 'en',
        'popularity' => 61.5
      }
    ]
  }
end

let(:tv_response) do
  {
    'results' => [
      {
        'id' => 1396,
        'name' => 'ブレイキング・バッド',
        'overview' => '化学教師が犯罪に手を染める',
        'poster_path' => '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
        'first_air_date' => '2008-01-20',
        'genre_ids' => [18],
        'original_language' => 'en',
        'popularity' => 120.3
      }
    ]
  }
end

before do
  stub_request(:get, %r{api.themoviedb.org/3/search/movie})
    .to_return(status: 200, body: movie_response.to_json, headers: { 'Content-Type' => 'application/json' })
  stub_request(:get, %r{api.themoviedb.org/3/search/tv})
    .to_return(status: 200, body: tv_response.to_json, headers: { 'Content-Type' => 'application/json' })
end
```

テストケースも更新する:

```ruby
it 'movie と tv の結果を両方返す' do
  results = adapter.search('テスト')
  expect(results.length).to eq(2)
  expect(results.map(&:media_type)).to contain_exactly('movie', 'drama')
end

it '映画のタイトルとIDを正しく返す' do
  results = adapter.search('ファイト・クラブ')
  movie = results.find { |r| r.media_type == 'movie' }
  expect(movie.title).to eq('ファイト・クラブ')
  expect(movie.external_api_id).to eq('550')
end

it '映画のAPIソースとカバー画像URLを正しく返す' do
  results = adapter.search('テスト')
  movie = results.find { |r| r.media_type == 'movie' }
  expect(movie.external_api_source).to eq('tmdb')
  expect(movie.cover_image_url).to include('image.tmdb.org')
end

it 'tv の結果を drama にマッピングする' do
  results = adapter.search('ブレイキング・バッド')
  drama = results.find { |r| r.media_type == 'drama' }
  expect(drama).to be_present
  expect(drama.title).to eq('ブレイキング・バッド')
end

it 'popularity（正規化済み）をmetadataに含める' do
  results = adapter.search('テスト')
  movie = results.find { |r| r.media_type == 'movie' }
  expect(movie.metadata[:popularity]).to be_within(0.01).of(0.615)
end

it '結果が0件の場合は空配列を返す' do
  stub_request(:get, /api.themoviedb.org\/3\/search\/movie/)
    .to_return(status: 200, body: { 'results' => [] }.to_json,
               headers: { 'Content-Type' => 'application/json' })
  stub_request(:get, /api.themoviedb.org\/3\/search\/tv/)
    .to_return(status: 200, body: { 'results' => [] }.to_json,
               headers: { 'Content-Type' => 'application/json' })
  expect(adapter.search('存在しない作品')).to eq([])
end
```

日本アニメ除外テストも更新（`search/movie` と `search/tv` 両方でスタブ）:

```ruby
context '日本のアニメーション作品' do
  let(:anime_movie_response) { { 'results' => [] } }
  let(:anime_tv_response) do
    {
      'results' => [
        {
          'id' => 12_345,
          'name' => 'けいおん！',
          'overview' => '軽音部の日常',
          'poster_path' => '/keion.jpg',
          'genre_ids' => [16, 35],
          'original_language' => 'ja',
          'popularity' => 45.0
        },
        {
          'id' => 67_890,
          'name' => 'ブレイキング・バッド',
          'overview' => '化学教師が犯罪に手を染める',
          'poster_path' => '/bb.jpg',
          'genre_ids' => [18],
          'original_language' => 'en',
          'popularity' => 120.0
        },
        {
          'id' => 11_111,
          'name' => 'スポンジ・ボブ',
          'overview' => '海底の冒険',
          'poster_path' => '/sponge.jpg',
          'genre_ids' => [16, 35],
          'original_language' => 'en',
          'popularity' => 80.0
        }
      ]
    }
  end

  before do
    stub_request(:get, %r{api.themoviedb.org/3/search/movie})
      .to_return(status: 200, body: anime_movie_response.to_json,
                 headers: { 'Content-Type' => 'application/json' })
    stub_request(:get, %r{api.themoviedb.org/3/search/tv})
      .to_return(status: 200, body: anime_tv_response.to_json,
                 headers: { 'Content-Type' => 'application/json' })
  end

  it '日本のアニメ（Animation + 原語ja）をAniListと重複しないよう除外する' do
    results = adapter.search('けいおん')
    expect(results.length).to eq(2)
    titles = results.map(&:title)
    expect(titles).not_to include('けいおん！')
  end

  it '海外のアニメーション（Animation + 原語en）は除外しない' do
    results = adapter.search('スポンジ')
    expect(results.map(&:title)).to include('スポンジ・ボブ')
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/tmdb_adapter_spec.rb --format documentation`
Expected: FAIL（`search` メソッドがまだ `search/multi` を呼んでいるため）

- [ ] **Step 3: search メソッドを search/tv + search/movie に書き換え**

```ruby
# tmdb_adapter.rb — search メソッドを置き換え

def search(query, media_type: nil)
  movie_results = search_movies(query)
  tv_results = search_tv(query)
  movie_results + tv_results
end

private

def search_movies(query)
  response = tmdb_connection.get('/3/search/movie',
                                  api_key: ENV.fetch('TMDB_API_KEY'),
                                  query: query,
                                  language: 'ja')

  (response.body['results'] || [])
    .reject { |item| japanese_animation?(item) }
    .map { |item| normalize_movie(item) }
end

def search_tv(query)
  response = tmdb_connection.get('/3/search/tv',
                                  api_key: ENV.fetch('TMDB_API_KEY'),
                                  query: query,
                                  language: 'ja')

  (response.body['results'] || [])
    .reject { |item| japanese_animation?(item) }
    .map { |item| normalize_tv(item) }
end
```

`normalize` メソッドを `normalize_movie` と `normalize_tv` に分離する（`search/tv` と `search/movie` はレスポンス構造が異なるため）:

```ruby
def normalize_movie(item)
  SearchResult.new(
    item['title'],
    'movie',
    item['overview'],
    item['poster_path'] ? "#{IMAGE_BASE_URL}#{item['poster_path']}" : nil,
    nil,
    item['id'].to_s,
    'tmdb',
    {
      release_date: item['release_date'],
      original_language: item['original_language'],
      vote_average: item['vote_average'],
      popularity: normalize_popularity(item['popularity'])
    }.compact
  )
end

def normalize_tv(item)
  SearchResult.new(
    item['name'],
    'drama',
    item['overview'],
    item['poster_path'] ? "#{IMAGE_BASE_URL}#{item['poster_path']}" : nil,
    nil,
    item['id'].to_s,
    'tmdb',
    {
      release_date: item['first_air_date'],
      original_language: item['original_language'],
      vote_average: item['vote_average'],
      popularity: normalize_popularity(item['popularity'])
    }.compact
  )
end
```

古い `normalize` メソッドは削除する。

- [ ] **Step 4: テストを実行して全件パスを確認**

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/tmdb_adapter_spec.rb --format documentation`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/external_apis/tmdb_adapter.rb backend/spec/services/external_apis/tmdb_adapter_spec.rb
git commit -m "feat: TMDB検索をsearch/tv・search/movieに分離して件数改善"
```

---

### Task 2: 中黒バリエーション検索の追加

**Files:**
- Modify: `backend/app/services/external_apis/tmdb_adapter.rb`
- Modify: `backend/spec/services/external_apis/tmdb_adapter_spec.rb`

- [ ] **Step 1: 中黒バリエーション検索のテストを追加**

```ruby
# tmdb_adapter_spec.rb に追加

describe '中黒バリエーション検索' do
  before do
    stub_request(:get, %r{api.themoviedb.org/3/search/movie})
      .to_return(status: 200, body: { 'results' => [] }.to_json,
                 headers: { 'Content-Type' => 'application/json' })
  end

  context '結果が3件以下のとき' do
    before do
      # 元クエリ「ウォーキングデッド」→ 0件
      stub_request(:get, %r{api.themoviedb.org/3/search/tv})
        .with(query: hash_including('query' => 'ウォーキングデッド'))
        .to_return(status: 200, body: { 'results' => [] }.to_json,
                   headers: { 'Content-Type' => 'application/json' })
      # 中黒挿入版「ウォーキング・デッド」→ 1件
      stub_request(:get, %r{api.themoviedb.org/3/search/tv})
        .with(query: hash_including('query' => 'ウォーキング・デッド'))
        .to_return(status: 200, body: { 'results' => [{
          'id' => 1402, 'name' => 'ウォーキング・デッド',
          'overview' => 'ゾンビが蔓延する世界', 'poster_path' => '/twd.jpg',
          'genre_ids' => [18], 'original_language' => 'en', 'popularity' => 95.0
        }] }.to_json, headers: { 'Content-Type' => 'application/json' })
    end

    it '中黒挿入版で追加検索して結果を返す' do
      results = adapter.search('ウォーキングデッド')
      expect(results.map(&:title)).to include('ウォーキング・デッド')
    end
  end

  context '結果が4件以上のとき' do
    let(:enough_results) do
      4.times.map do |i|
        { 'id' => i + 1, 'name' => "ドラマ#{i}", 'overview' => '説明',
          'poster_path' => '/img.jpg', 'genre_ids' => [], 'original_language' => 'ja',
          'popularity' => 50.0 }
      end
    end

    before do
      stub_request(:get, %r{api.themoviedb.org/3/search/tv})
        .to_return(status: 200, body: { 'results' => enough_results }.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it '追加検索を実行しない' do
      adapter.search('テスター作品')
      # search/tv が1回だけ呼ばれたことを確認（中黒版の追加呼び出しなし）
      expect(WebMock).to have_requested(:get, %r{api.themoviedb.org/3/search/tv}).once
    end
  end

  context '中黒挿入で変化がないクエリ' do
    before do
      stub_request(:get, %r{api.themoviedb.org/3/search/tv})
        .to_return(status: 200, body: { 'results' => [] }.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it '漢字のみのクエリでは追加検索しない' do
      adapter.search('半沢直樹')
      expect(WebMock).to have_requested(:get, %r{api.themoviedb.org/3/search/tv}).once
    end
  end

  context '重複除去' do
    before do
      same_result = { 'id' => 100, 'name' => 'テスト・ドラマ', 'overview' => '説明',
                      'poster_path' => '/img.jpg', 'genre_ids' => [], 'original_language' => 'ja',
                      'popularity' => 50.0 }
      stub_request(:get, %r{api.themoviedb.org/3/search/tv})
        .to_return(status: 200, body: { 'results' => [same_result] }.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it '同じIDの結果は重複しない' do
      results = adapter.search('テストドラマ')
      ids = results.map(&:external_api_id)
      expect(ids.uniq.length).to eq(ids.length)
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/tmdb_adapter_spec.rb --format documentation`
Expected: FAIL（中黒バリエーション検索がまだ未実装のため）

- [ ] **Step 3: 中黒挿入メソッドと検索ロジックを実装**

```ruby
# tmdb_adapter.rb に追加

# 中黒バリエーション検索の閾値（この件数以下なら追加検索）
NAKAGURO_RETRY_THRESHOLD = 3

def search(query, media_type: nil)
  movie_results = search_movies(query)
  tv_results = search_tv(query)
  results = movie_results + tv_results

  if results.length <= NAKAGURO_RETRY_THRESHOLD
    nakaguro_query = insert_nakaguro(query)
    if nakaguro_query != query
      additional_movies = search_movies(nakaguro_query)
      additional_tv = search_tv(nakaguro_query)
      results = merge_results(results, additional_movies + additional_tv)
    end
  end

  results
end

# 長音「ー」の直後にカタカナが続く場合、中黒「・」を挿入する
# 例: 「ウォーキングデッド」→「ウォーキング・デッド」
def insert_nakaguro(query)
  query.gsub(/ー([ァ-ヶ])/, 'ー・\1')
end

# TMDB IDで重複除去しながら結果をマージする
def merge_results(primary, additional)
  seen_ids = primary.map(&:external_api_id).to_set
  combined = primary.dup
  additional.each { |r| combined << r unless seen_ids.include?(r.external_api_id) }
  combined
end
```

- [ ] **Step 4: テストを実行して全件パスを確認**

Run: `docker compose exec -T backend bundle exec rspec spec/services/external_apis/tmdb_adapter_spec.rb --format documentation`
Expected: ALL PASS

- [ ] **Step 5: WorkSearchService のテストも含めて全テスト実行**

Run: `docker compose exec -T backend bundle exec rspec spec/services/ --format documentation`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add backend/app/services/external_apis/tmdb_adapter.rb backend/spec/services/external_apis/tmdb_adapter_spec.rb
git commit -m "feat: カタカナ中黒バリエーション検索で外来語タイトルのヒット率改善"
```

---

### Task 3: 動作確認

- [ ] **Step 1: 検索キャッシュをクリア**

Run: `docker compose exec -T backend bin/rails runner "Rails.cache.delete_matched('work_search:*')"`

- [ ] **Step 2: ブラウザまたはPlaywrightで以下の検索を確認**

| 検索ワード | ジャンル | 期待結果 |
|---|---|---|
| ウォーキングデッド | ドラマ | 1件以上ヒット |
| ゲームオブスローンズ | ドラマ | 1件以上ヒット |
| ペーパーハウス | ドラマ | 1件以上ヒット |
| ブレイキングバッド | ドラマ | 1件以上ヒット |
| 半沢直樹 | ドラマ | 1件以上ヒット（既存動作の維持） |
| コナン | 映画 | 10件以上ヒット（件数改善の確認） |
