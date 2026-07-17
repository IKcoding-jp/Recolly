# ドラマ検索のシーズン展開 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TMDBのTVシリーズ検索結果をシーズン単位のカードに展開し、「コード・ブルー」で1st〜3rd seasonが個別に記録できるようにする。

**Architecture:** 新クラス `ExternalApis::TmdbSeasonExpander` がTV検索結果の上位3件についてTMDB `/tv/{id}` 詳細を並列取得し、複数シーズンを持つシリーズをシーズン別 `SearchResult` に置き換える。`TmdbAdapter#search` の最終段で呼び出し、失敗時は元の結果にフォールバックする。`WorkSearchService` のソートに第4キー（シーズン番号昇順）を追加する。

**Tech Stack:** Ruby 3.3 / Rails 8 / Faraday / RSpec + WebMock

**スペック:** `docs/superpowers/specs/2026-07-17-drama-season-expansion-design.md`
**Issue:** #218

## Global Constraints

- 1ファイル200行以内を目安
- コメントは「なぜそうしているか」を日本語で書く
- マジックナンバー禁止（定数化）
- RuboCop全ルール準拠
- コミットメッセージはConventional Commits（日本語）
- テストは対象ファイルと同じディレクトリ構造（`backend/spec/services/external_apis/`）
- 作業ブランチ: `feat/drama-season-expansion`（作成済み）
- テスト実行はDocker経由: `docker compose exec backend bundle exec rspec <path>`（backendコンテナ未起動なら `docker compose up -d` を先に実行）
- RuboCop実行: `docker compose exec backend bundle exec rubocop`

---

### Task 1: TmdbSeasonExpander クラス本体

**Files:**
- Create: `backend/app/services/external_apis/tmdb_season_expander.rb`
- Test: `backend/spec/services/external_apis/tmdb_season_expander_spec.rb`

**Interfaces:**
- Consumes: `ExternalApis::BaseAdapter::SearchResult`（Struct: title, media_type, description, cover_image_url, total_episodes, external_api_id, external_api_source, metadata）、`SearchRelevanceScorer.tier(query, title)`（0〜3のInteger返却、`TIER_PARTIAL = 1`）
- Produces: `ExternalApis::TmdbSeasonExpander.new(query, connection_factory:)` — `connection_factory` は呼ぶたびに新しいFaradayコネクションを返すlambda。`#expand(results)` は `SearchResult` 配列を受け取り、展開済み配列を返す（Task 2でTmdbAdapterが使用）

- [ ] **Step 1: 失敗するテストを書く**

`backend/spec/services/external_apis/tmdb_season_expander_spec.rb` を新規作成:

```ruby
# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::TmdbSeasonExpander, type: :service do
  subject(:expander) { described_class.new(query, connection_factory: factory) }

  let(:query) { 'コード・ブルー' }
  # スレッドごとに新しいコネクションを作る想定のfactory（WebMockが横取りするため実接続はしない）
  let(:factory) do
    lambda do
      Faraday.new(url: 'https://api.themoviedb.org') do |f|
        f.request :json
        f.response :json
        f.adapter Faraday.default_adapter
      end
    end
  end

  let(:series) do
    ExternalApis::BaseAdapter::SearchResult.new(
      'コード・ブルー　ドクターヘリ緊急救命', 'drama', 'シリーズの説明',
      'https://image.tmdb.org/t/p/w500/series.jpg', nil, '21021', 'tmdb',
      { release_date: '2008-07-03', original_language: 'ja', vote_average: 7.4, popularity: 0.3 }
    )
  end

  let(:detail_body) do
    {
      'seasons' => [
        { 'season_number' => 0, 'name' => '特別編', 'air_date' => '2009-01-10',
          'episode_count' => 7, 'overview' => '', 'poster_path' => '/sp.jpg' },
        { 'season_number' => 1, 'name' => '1st season', 'air_date' => '2008-07-03',
          'episode_count' => 11, 'overview' => '1期の説明', 'poster_path' => '/s1.jpg' },
        { 'season_number' => 2, 'name' => '2nd season', 'air_date' => '2010-01-11',
          'episode_count' => 11, 'overview' => '', 'poster_path' => nil }
      ]
    }
  end

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('TMDB_API_KEY').and_return('test_tmdb_key')
    stub_request(:get, %r{api.themoviedb.org/3/tv/21021})
      .to_return(status: 200, body: detail_body.to_json,
                 headers: { 'Content-Type' => 'application/json' })
  end

  describe '#expand' do
    it '複数シーズンのシリーズをシーズン別エントリに展開する' do
      results = expander.expand([series])
      expect(results.length).to eq(2)
      expect(results.map(&:title)).to eq(
        ['コード・ブルー　ドクターヘリ緊急救命 1st season',
         'コード・ブルー　ドクターヘリ緊急救命 2nd season']
      )
    end

    it 'external_api_id を {シリーズID}-s{シーズン番号} 形式にする' do
      results = expander.expand([series])
      expect(results.map(&:external_api_id)).to eq(%w[21021-s1 21021-s2])
    end

    it '特別編（season 0）は展開対象に含めない' do
      results = expander.expand([series])
      expect(results.map(&:title)).not_to include(a_string_including('特別編'))
    end

    it 'シーズンのoverview・poster・air_date・episode_countを各エントリに設定する' do
      s1 = expander.expand([series]).first
      expect(s1.description).to eq('1期の説明')
      expect(s1.cover_image_url).to eq('https://image.tmdb.org/t/p/w500/s1.jpg')
      expect(s1.metadata[:release_date]).to eq('2008-07-03')
      expect(s1.total_episodes).to eq(11)
      expect(s1.metadata[:season_number]).to eq(1)
    end

    it 'シーズンのoverview・posterが空ならシリーズの値にフォールバックする' do
      s2 = expander.expand([series]).last
      expect(s2.description).to eq('シリーズの説明')
      expect(s2.cover_image_url).to eq('https://image.tmdb.org/t/p/w500/series.jpg')
    end

    it 'シリーズのpopularity等のmetadataを引き継ぐ' do
      s1 = expander.expand([series]).first
      expect(s1.metadata[:popularity]).to eq(0.3)
      expect(s1.metadata[:original_language]).to eq('ja')
    end

    context '通常シーズンが1つだけの場合' do
      let(:detail_body) do
        { 'seasons' => [
          { 'season_number' => 1, 'name' => '1st season', 'air_date' => '2008-07-03',
            'episode_count' => 11, 'overview' => '説明', 'poster_path' => '/s1.jpg' }
        ] }
      end

      it '展開せずシリーズエントリのまま返す' do
        results = expander.expand([series])
        expect(results).to eq([series])
      end
    end

    context '展開対象の選定' do
      let(:unrelated_drama) do
        ExternalApis::BaseAdapter::SearchResult.new(
          '全く関係ないドラマ', 'drama', '説明', nil, nil, '999', 'tmdb', { popularity: 0.9 }
        )
      end
      let(:movie) do
        ExternalApis::BaseAdapter::SearchResult.new(
          'コード・ブルー関連映画', 'movie', '説明', nil, nil, '888', 'tmdb', { popularity: 0.5 }
        )
      end

      it '検索語にマッチしないドラマとmovieは詳細取得せずそのまま返す' do
        results = expander.expand([series, unrelated_drama, movie])
        expect(results.map(&:external_api_id)).to eq(%w[21021-s1 21021-s2 999 888])
        expect(a_request(:get, %r{api.themoviedb.org/3/tv/999})).not_to have_been_made
        expect(a_request(:get, %r{api.themoviedb.org/3/tv/888})).not_to have_been_made
      end

      it '関連度の高い上位3件のみ詳細を取得する' do
        # コード・ブルーを含むドラマを4件用意し、popularity最下位の1件が対象外になることを確認
        candidates = (1..4).map do |i|
          ExternalApis::BaseAdapter::SearchResult.new(
            "コード・ブルー #{i}", 'drama', '説明', nil, nil, i.to_s, 'tmdb',
            { popularity: 1.0 - (i * 0.1) }
          )
        end
        stub_request(:get, %r{api.themoviedb.org/3/tv/\d+})
          .to_return(status: 200, body: { 'seasons' => [] }.to_json,
                     headers: { 'Content-Type' => 'application/json' })
        expander.expand(candidates)
        expect(a_request(:get, %r{api.themoviedb.org/3/tv/1})).to have_been_made
        expect(a_request(:get, %r{api.themoviedb.org/3/tv/3})).to have_been_made
        expect(a_request(:get, %r{api.themoviedb.org/3/tv/4})).not_to have_been_made
      end
    end

    context '詳細取得が失敗した場合' do
      before do
        stub_request(:get, %r{api.themoviedb.org/3/tv/21021}).to_timeout
      end

      it 'シリーズエントリのまま返す（検索全体を落とさない）' do
        results = expander.expand([series])
        expect(results).to eq([series])
      end
    end

    context 'キャッシュ' do
      # test環境のデフォルトは:null_storeのためメモリストアに差し替える
      around do |example|
        original_store = Rails.cache
        Rails.cache = ActiveSupport::Cache::MemoryStore.new
        example.run
        Rails.cache = original_store
      end

      it '同じシリーズの2回目は詳細APIを呼ばない' do
        expander.expand([series])
        described_class.new(query, connection_factory: factory).expand([series])
        expect(a_request(:get, %r{api.themoviedb.org/3/tv/21021})).to have_been_made.once
      end

      it '取得失敗はキャッシュしない（次回再試行する）' do
        stub_request(:get, %r{api.themoviedb.org/3/tv/21021})
          .to_timeout.then
          .to_return(status: 200, body: detail_body.to_json,
                     headers: { 'Content-Type' => 'application/json' })
        expander.expand([series])
        results = described_class.new(query, connection_factory: factory).expand([series])
        expect(results.length).to eq(2)
      end
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `docker compose exec backend bundle exec rspec spec/services/external_apis/tmdb_season_expander_spec.rb`
Expected: FAIL（`NameError: uninitialized constant ExternalApis::TmdbSeasonExpander`）

- [ ] **Step 3: 実装を書く**

`backend/app/services/external_apis/tmdb_season_expander.rb` を新規作成:

```ruby
# frozen_string_literal: true

module ExternalApis
  # TMDBのTVシリーズ検索結果をシーズン単位のSearchResultに展開する
  # TMDBはシリーズ1エントリでしか検索ヒットしないため、
  # Recollyの記録単位（シーズン）とのズレをここで吸収する
  class TmdbSeasonExpander
    IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'
    # 展開対象の上限。全件展開すると詳細取得APIコールで検索が遅くなるため、関連度上位に絞る
    EXPAND_LIMIT = 3
    # シーズン構成はほぼ変わらないため長期キャッシュ（enrichmentキャッシュと同方針）
    DETAIL_CACHE_PREFIX = 'work_search:tmdb_tv_detail:v1'
    DETAIL_CACHE_TTL = 30.days

    # connection_factory: 呼ぶたびに新しいFaradayコネクションを返すlambda
    # （Faradayコネクションのスレッド間共有を避けるため。TmdbAdapterと同方針）
    def initialize(query, connection_factory:)
      @query = query
      @connection_factory = connection_factory
    end

    # 関連度の高いドラマの詳細を取得し、複数シーズン作品をシーズン別エントリに置き換える
    # 失敗時は元の結果をそのまま返す（検索全体を落とさない）
    def expand(results)
      targets = select_targets(results)
      return results if targets.empty?

      details = fetch_details_in_parallel(targets)
      replace_with_seasons(results, details)
    rescue StandardError => e
      Rails.logger.error("[TmdbSeasonExpander] シーズン展開エラー: #{e.message}")
      results
    end

    private

    # 関連度ティアPARTIAL以上のドラマを、ティア降順→人気度降順で上位EXPAND_LIMIT件選ぶ
    def select_targets(results)
      results
        .select { |r| r.media_type == 'drama' }
        .select { |r| SearchRelevanceScorer.tier(@query, r.title) >= SearchRelevanceScorer::TIER_PARTIAL }
        .sort_by { |r| [-SearchRelevanceScorer.tier(@query, r.title), -(r.metadata[:popularity] || 0)] }
        .first(EXPAND_LIMIT)
    end

    # シリーズID => 詳細ハッシュ（取得失敗はnil）を並列取得する
    def fetch_details_in_parallel(targets)
      threads = targets.map do |r|
        Thread.new { [r.external_api_id, fetch_detail_with_cache(r.external_api_id)] }
      end
      threads.map(&:value).to_h
    end

    # 取得失敗（nil）はキャッシュしない（次回の検索で再試行させる）
    def fetch_detail_with_cache(series_id)
      cache_key = "#{DETAIL_CACHE_PREFIX}:#{series_id}"
      cached = Rails.cache.read(cache_key)
      return cached unless cached.nil?

      detail = fetch_detail(series_id)
      Rails.cache.write(cache_key, detail, expires_in: DETAIL_CACHE_TTL) if detail
      detail
    end

    # /tv/{id} から展開に必要なseasonsだけ抜き出す（失敗時はnil＝展開しないだけ）
    def fetch_detail(series_id)
      response = @connection_factory.call.get("/3/tv/#{series_id}",
                                              api_key: ENV.fetch('TMDB_API_KEY'),
                                              language: 'ja')
      seasons = response.body['seasons']
      return nil unless seasons.is_a?(Array)

      { 'seasons' => seasons }
    rescue Faraday::Error => e
      Rails.logger.error("[TmdbSeasonExpander] 詳細取得エラー(#{series_id}): #{e.message}")
      nil
    end

    # 展開対象のシリーズをシーズンエントリ群に置き換える（結果配列内の位置は維持）
    def replace_with_seasons(results, details)
      results.flat_map do |r|
        seasons = regular_seasons(details[r.external_api_id])
        # 1シーズンのみのシリーズは展開しない（冗長なため）
        next [r] if seasons.length < 2

        seasons.map { |season| build_season_result(r, season) }
      end
    end

    # 特別編（season 0）は雑多な内容が混ざるため通常シーズンのみ対象にする
    def regular_seasons(detail)
      return [] unless detail

      (detail['seasons'] || []).select { |s| s['season_number'].to_i >= 1 }
    end

    # シーズン固有の値がなければシリーズの値にフォールバックする
    # （記録時の説明補完に頼らずとも日本語説明が付くようにする）
    def build_season_result(series, season)
      BaseAdapter::SearchResult.new(
        "#{series.title} #{season['name']}",
        'drama',
        season['overview'].presence || series.description,
        season_poster(season) || series.cover_image_url,
        season['episode_count'],
        "#{series.external_api_id}-s#{season['season_number']}",
        'tmdb',
        series.metadata.merge(
          release_date: season['air_date'],
          season_number: season['season_number'].to_i
        ).compact
      )
    end

    def season_poster(season)
      season['poster_path'] ? "#{IMAGE_BASE_URL}#{season['poster_path']}" : nil
    end
  end
end
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `docker compose exec backend bundle exec rspec spec/services/external_apis/tmdb_season_expander_spec.rb`
Expected: 全PASS

- [ ] **Step 5: RuboCopを通す**

Run: `docker compose exec backend bundle exec rubocop app/services/external_apis/tmdb_season_expander.rb spec/services/external_apis/tmdb_season_expander_spec.rb`
Expected: no offenses（違反があれば修正してテスト再実行）

- [ ] **Step 6: コミット**

```bash
git add backend/app/services/external_apis/tmdb_season_expander.rb backend/spec/services/external_apis/tmdb_season_expander_spec.rb
git commit -m "feat: TMDBシリーズ検索結果をシーズン単位に展開するTmdbSeasonExpanderを追加"
```

---

### Task 2: TmdbAdapter への統合

**Files:**
- Modify: `backend/app/services/external_apis/tmdb_adapter.rb`（`search` メソッドと private セクション）
- Test: `backend/spec/services/external_apis/tmdb_adapter_spec.rb`

**Interfaces:**
- Consumes: `ExternalApis::TmdbSeasonExpander.new(query, connection_factory:)` / `#expand(results)`（Task 1で作成）
- Produces: `TmdbAdapter#search` の返り値にシーズン展開済み結果が含まれる（呼び出し側インターフェースは不変）

- [ ] **Step 1: 既存テストの before ブロックに詳細APIのデフォルトスタブを追加する**

シーズン展開が既存テストのTV結果（ブレイキング・バッド等）にも詳細取得を試みるため、`backend/spec/services/external_apis/tmdb_adapter_spec.rb` のトップレベル `before` ブロック（`allow(default_wikipedia_client)...` の直後）に以下を追加:

```ruby
    # シーズン展開の詳細取得スタブ（デフォルトはシーズンなし＝展開されない）
    stub_request(:get, %r{api.themoviedb.org/3/tv/\d+})
      .to_return(status: 200, body: { 'seasons' => [] }.to_json,
                 headers: { 'Content-Type' => 'application/json' })
```

- [ ] **Step 2: 失敗するテストを書く**

`tmdb_adapter_spec.rb` の `describe '#search'` 内の末尾（`context '日本のアニメーション作品'` の後）に追加:

```ruby
    context 'シーズン展開' do
      before do
        stub_request(:get, %r{api.themoviedb.org/3/tv/1396\?})
          .to_return(status: 200, body: {
            'seasons' => [
              { 'season_number' => 1, 'name' => 'シーズン1', 'air_date' => '2008-01-20',
                'episode_count' => 7, 'overview' => '1期', 'poster_path' => '/s1.jpg' },
              { 'season_number' => 2, 'name' => 'シーズン2', 'air_date' => '2009-03-08',
                'episode_count' => 13, 'overview' => '2期', 'poster_path' => '/s2.jpg' }
            ]
          }.to_json, headers: { 'Content-Type' => 'application/json' })
      end

      it '複数シーズンのTVシリーズをシーズン別エントリに展開して返す' do
        results = adapter.search('ブレイキング・バッド')
        dramas = results.select { |r| r.media_type == 'drama' }
        expect(dramas.map(&:external_api_id)).to eq(%w[1396-s1 1396-s2])
      end
    end
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `docker compose exec backend bundle exec rspec spec/services/external_apis/tmdb_adapter_spec.rb`
Expected: 新規テストのみFAIL（展開されず `['1396']` が返る）。既存テストは全PASS

- [ ] **Step 4: TmdbAdapter に展開呼び出しを実装する**

`backend/app/services/external_apis/tmdb_adapter.rb` の `search` メソッドを変更:

```ruby
    def search(query, media_type: nil) # rubocop:disable Lint/UnusedMethodArgument -- BaseAdapterインターフェース準拠
      results = search_movies_and_tv_in_parallel(query)

      # 結果が少ない場合、WikipediaClientで正式タイトルを取得してTMDB再検索する
      # 例: 「ウォーキングデッド」→ Wikipedia「ウォーキング・デッド」→ TMDB再検索
      results = search_via_wikipedia(query, results) if results.length <= NAKAGURO_RETRY_THRESHOLD

      expand_seasons(query, results)
    end
```

private セクション（`search_movies_and_tv_in_parallel` の直後）に追加:

```ruby
    # TVシリーズ結果をシーズン単位に展開する（展開ロジックはTmdbSeasonExpander参照）
    # 詳細取得コネクションはスレッドごとに生成する（Faradayコネクション共有回避）
    def expand_seasons(query, results)
      factory = lambda do
        connection(url: BASE_URL, open_timeout: SUPPLEMENTARY_OPEN_TIMEOUT,
                   timeout: SUPPLEMENTARY_TIMEOUT, retry_on_timeout: false)
      end
      TmdbSeasonExpander.new(query, connection_factory: factory).expand(results)
    end
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `docker compose exec backend bundle exec rspec spec/services/external_apis/tmdb_adapter_spec.rb`
Expected: 全PASS

- [ ] **Step 6: RuboCopを通す**

Run: `docker compose exec backend bundle exec rubocop app/services/external_apis/tmdb_adapter.rb spec/services/external_apis/tmdb_adapter_spec.rb`
Expected: no offenses

- [ ] **Step 7: コミット**

```bash
git add backend/app/services/external_apis/tmdb_adapter.rb backend/spec/services/external_apis/tmdb_adapter_spec.rb
git commit -m "feat: TMDB検索にシーズン展開を組み込む"
```

---

### Task 3: WorkSearchService のソート第4キーとキャッシュバージョン更新

**Files:**
- Modify: `backend/app/services/work_search_service.rb`（`CACHE_VERSION` と `sort_results`）
- Test: `backend/spec/services/work_search_service_spec.rb`

**Interfaces:**
- Consumes: シーズンエントリの `metadata[:season_number]`（Task 1が設定。シリーズ由来でないエントリには存在しない）
- Produces: 検索結果のソート順（関連度ティア降順 → 品質降順 → 人気度降順 → シーズン番号昇順）

- [ ] **Step 1: 失敗するテストを書く**

`backend/spec/services/work_search_service_spec.rb` の `describe '#search 関連度ソート'` ブロック末尾に追加:

```ruby
    it '関連度・品質・人気度が同点ならシーズン番号昇順で並べる' do
      season2 = ExternalApis::BaseAdapter::SearchResult.new(
        'コード・ブルー 2nd season', 'game', '説明', 'https://img.jpg', nil,
        '21021-s2', 'igdb', { popularity: 0.3, season_number: 2 }
      )
      season1 = ExternalApis::BaseAdapter::SearchResult.new(
        'コード・ブルー 1st season', 'game', '説明', 'https://img.jpg', nil,
        '21021-s1', 'igdb', { popularity: 0.3, season_number: 1 }
      )
      allow(igdb_double).to receive(:safe_search).and_return([season2, season1])
      results = service.search('コード・ブルー', media_type: 'game')
      expect(results.map(&:external_api_id)).to eq(%w[21021-s1 21021-s2])
    end
```

（このdescribeブロックはIGDBのdoubleで検索結果を注入する既存スタイルのため、media_typeはgameのままソート順だけ検証する）

同ファイルのキャッシュバージョンテストを更新:

```ruby
    it 'キャッシュバージョンがv10である（シーズン展開導入で旧キャッシュを無効化）' do
      expect(WorkSearchService::CACHE_VERSION).to eq('v10')
    end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `docker compose exec backend bundle exec rspec spec/services/work_search_service_spec.rb`
Expected: 追加・変更した2件がFAIL（ソート順不定 or v9のまま）

- [ ] **Step 3: 実装を変更する**

`backend/app/services/work_search_service.rb` の定数を変更:

```ruby
  # 実装変更時にインクリメントしてキャッシュを無効化する
  # v10: ドラマ検索のシーズン展開導入（v9以前の履歴はgit参照）
  CACHE_VERSION = 'v10'
```

`sort_results` を変更:

```ruby
  # 関連度ティア降順 → 品質スコア降順 → 人気度降順 → シーズン番号昇順の4段ソート（ADR-0045）
  # 検索語にマッチする作品を上位に固め、同ティア内では情報が揃った人気作を先に出す。
  # 同一シリーズのシーズン同士は前3キーが同点になるため、シーズン番号で並び順を保証する
  def sort_results(results, query)
    results.sort_by do |r|
      [-SearchRelevanceScorer.tier(query, r.title), -quality_score(r),
       -(r.metadata[:popularity] || 0), r.metadata[:season_number] || 0]
    end
  end
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `docker compose exec backend bundle exec rspec spec/services/work_search_service_spec.rb`
Expected: 全PASS

- [ ] **Step 5: RuboCopを通す**

Run: `docker compose exec backend bundle exec rubocop app/services/work_search_service.rb spec/services/work_search_service_spec.rb`
Expected: no offenses

- [ ] **Step 6: コミット**

```bash
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "feat: 検索ソートにシーズン番号の第4キーを追加しキャッシュをv10に更新"
```

---

### Task 4: 全体テスト・リンター確認

**Files:** なし（検証のみ。違反や失敗があれば該当ファイルを修正）

- [ ] **Step 1: バックエンド全テストを実行する**

Run: `docker compose exec backend bundle exec rspec`
Expected: 全PASS（既存テストの回帰がないこと）

- [ ] **Step 2: RuboCopを全体実行する**

Run: `docker compose exec backend bundle exec rubocop`
Expected: no offenses

- [ ] **Step 3: 修正が発生した場合のみコミット**

```bash
git add -A
git commit -m "fix: テスト・リンター指摘の修正"
```

---

## 実装後（プラン外・セッションで実施）

- 動作確認: ワークフローStep 5に従い、確認方法（手動 or Playwright MCP）をユーザーに確認してから実施。確認観点は「コード・ブルー」検索で1st〜3rd seasonが順に表示され、シーズンを選んで記録できること
- PR作成: `superpowers:finishing-a-development-branch` に従う（PR本文に `Closes #218`）
