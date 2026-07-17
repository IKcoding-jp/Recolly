# ゲーム検索改善（関連度ティアソート・Wikipedia補完並列化）実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 検索結果を「関連度→品質→人気度」の3段ソートにし、日本語ゲーム検索のWikipedia補完を並列化・軽量化して初回検索を高速化する。

**Architecture:** 関連度判定は新設モジュール `SearchRelevanceScorer`（4段階ティア）に集約し、`WorkSearchService` のソートキー先頭に差し込む。`IgdbAdapter` のWikipedia補完はタイトルごとのチェーン（英語タイトル取得→IGDB再検索）をThreadで並列化し、検索時の `fetch_extract`（説明取得）を廃止して記録時補完（ADR-0044）に統一する。

**Tech Stack:** Ruby 3.3 / Rails 8 / RSpec / WebMock

**参照:** スペック `docs/superpowers/specs/2026-07-17-game-search-improvement-design.md` / ADR-0045 / Issue #215

## Global Constraints

- コメント・コミットメッセージは日本語。コメントは「なぜ」を書く
- 1ファイル200行以内
- マジックナンバー禁止（ティア値は定数化）
- TDD厳守: テストを先に書き、失敗を確認してから実装する
- テスト実行はDocker経由: `docker compose exec backend bundle exec rspec <path>`（起動していない場合は `docker compose up -d` を先に実行）
- RuboCop: `docker compose exec backend bundle exec rubocop`
- コミットは lefthook の pre-commit（rubocop等）を通過させること

---

### Task 1: SearchRelevanceScorer（関連度ティア判定モジュール）

**Files:**
- Create: `backend/app/services/search_relevance_scorer.rb`
- Test: `backend/spec/services/search_relevance_scorer_spec.rb`

**Interfaces:**
- Consumes: `SearchTextNormalizer.normalize(text)`（既存。NFKC正規化＋小文字化＋trim＋連続空白圧縮）
- Produces: `SearchRelevanceScorer.tier(query, title)` → Integer（3=完全一致, 2=前方一致, 1=部分一致, 0=不一致）。定数 `TIER_EXACT=3, TIER_PREFIX=2, TIER_PARTIAL=1, TIER_NONE=0`

- [ ] **Step 1: 失敗するテストを書く**

`backend/spec/services/search_relevance_scorer_spec.rb` を新規作成:

```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SearchRelevanceScorer do
  describe '.tier' do
    it '完全一致でTIER_EXACT(3)を返す' do
      expect(described_class.tier('ゼルダ', 'ゼルダ')).to eq(described_class::TIER_EXACT)
    end

    it '前方一致でTIER_PREFIX(2)を返す' do
      expect(described_class.tier('ゼルダ', 'ゼルダの伝説')).to eq(described_class::TIER_PREFIX)
    end

    it '部分一致（先頭以外に含む）でTIER_PARTIAL(1)を返す' do
      expect(described_class.tier('ゼルダ', 'リンクの冒険 ゼルダの伝説2')).to eq(described_class::TIER_PARTIAL)
    end

    it '不一致でTIER_NONE(0)を返す' do
      expect(described_class.tier('ゼルダ', 'マリオカート')).to eq(described_class::TIER_NONE)
    end

    it '全角/半角・大文字/小文字の表記揺れを吸収して一致させる' do
      expect(described_class.tier('ＦＩＮＡＬ　ＦＡＮＴＡＳＹ', 'Final Fantasy')).to eq(described_class::TIER_EXACT)
    end

    it 'クエリが空文字ならTIER_NONEを返す' do
      expect(described_class.tier('', 'ゼルダ')).to eq(described_class::TIER_NONE)
    end

    it 'タイトルがnilならTIER_NONEを返す' do
      expect(described_class.tier('ゼルダ', nil)).to eq(described_class::TIER_NONE)
    end

    it '不正なUTF-8バイト列でも例外を投げずTIER_NONEを返す' do
      invalid = (+"\xff\xfe").force_encoding('UTF-8')
      expect(described_class.tier('ゼルダ', invalid)).to eq(described_class::TIER_NONE)
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/search_relevance_scorer_spec.rb`
Expected: FAIL（`uninitialized constant SearchRelevanceScorer`）

- [ ] **Step 3: 最小実装を書く**

`backend/app/services/search_relevance_scorer.rb` を新規作成:

```ruby
# frozen_string_literal: true

# 検索クエリと作品タイトルの関連度を4段階のティアで判定する
# WorkSearchServiceのソート第1キーとして使う（関連度→品質→人気度。ADR-0045）
module SearchRelevanceScorer
  module_function

  TIER_EXACT = 3
  TIER_PREFIX = 2
  TIER_PARTIAL = 1
  TIER_NONE = 0

  def tier(query, title)
    q = safe_normalize(query)
    t = safe_normalize(title)
    return TIER_NONE if q.empty? || t.empty?
    return TIER_EXACT if t == q
    return TIER_PREFIX if t.start_with?(q)
    return TIER_PARTIAL if t.include?(q)

    TIER_NONE
  end

  # 外部APIから不正なUTF-8バイト列が返った場合にunicode_normalizeが例外を投げ
  # 検索全体が落ちるのを防ぐため、防御的に空文字（=TIER_NONE扱い）へ落とす
  def safe_normalize(text)
    SearchTextNormalizer.normalize(text)
  rescue ArgumentError, Encoding::UndefinedConversionError
    ''
  end
end
```

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/search_relevance_scorer_spec.rb`
Expected: PASS（8 examples, 0 failures）

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/search_relevance_scorer.rb backend/spec/services/search_relevance_scorer_spec.rb
git commit -m "feat: 検索関連度ティア判定モジュールSearchRelevanceScorerを追加"
```

---

### Task 2: WorkSearchService の3段ソート化とキャッシュバージョン更新

**Files:**
- Modify: `backend/app/services/work_search_service.rb`
- Test: `backend/spec/services/work_search_service_spec.rb`

**Interfaces:**
- Consumes: `SearchRelevanceScorer.tier(query, title)` → Integer（Task 1）
- Produces: `WorkSearchService#search(query, media_type:)` の返却順が「関連度ティア降順→品質降順→人気度降順」になる。`CACHE_VERSION = 'v9'`

- [ ] **Step 1: 失敗するテストを書く**

`backend/spec/services/work_search_service_spec.rb` の `describe '#search 品質込みソート'` ブロックの直後に追加:

```ruby
  describe '#search 関連度ソート' do # rubocop:disable RSpec/MultipleMemoizedHelpers
    let(:exact_match) do
      ExternalApis::BaseAdapter::SearchResult.new(
        'ゼルダ', 'game', nil, nil, nil, '1', 'igdb', { popularity: 0.1 }
      )
    end
    let(:prefix_match) do
      ExternalApis::BaseAdapter::SearchResult.new(
        'ゼルダの伝説', 'game', '説明', 'https://img.jpg', nil, '2', 'igdb', { popularity: 0.2 }
      )
    end
    let(:partial_match) do
      ExternalApis::BaseAdapter::SearchResult.new(
        'リンクの冒険 ゼルダの伝説2', 'game', '説明', 'https://img.jpg', nil, '3', 'igdb',
        { popularity: 0.3 }
      )
    end
    let(:no_match) do
      ExternalApis::BaseAdapter::SearchResult.new(
        'マリオカート', 'game', '説明', 'https://img.jpg', nil, '4', 'igdb', { popularity: 1.0 }
      )
    end

    before do
      allow(igdb_double).to receive(:safe_search).and_return(
        [no_match, partial_match, prefix_match, exact_match]
      )
    end

    it '人気や品質より関連度ティアを優先して並べる' do
      results = service.search('ゼルダ', media_type: 'game')
      expect(results.map(&:title)).to eq(
        ['ゼルダ', 'ゼルダの伝説', 'リンクの冒険 ゼルダの伝説2', 'マリオカート']
      )
    end

    it '同じ関連度ティア内では品質→人気度の順で並べる' do
      same_tier_low_quality = ExternalApis::BaseAdapter::SearchResult.new(
        'ゼルダの伝説 夢をみる島', 'game', nil, nil, nil, '5', 'igdb', { popularity: 0.9 }
      )
      allow(igdb_double).to receive(:safe_search).and_return(
        [same_tier_low_quality, prefix_match]
      )
      results = service.search('ゼルダ', media_type: 'game')
      # 両方とも前方一致ティアだが、画像+説明ありのprefix_matchが品質で勝つ
      expect(results.map(&:title)).to eq(['ゼルダの伝説', 'ゼルダの伝説 夢をみる島'])
    end
  end
```

`describe 'キャッシュ'` ブロック内の `it 'キャッシュTTLが12時間に設定されている'` の直後に追加:

```ruby
    it 'キャッシュバージョンがv9である（関連度ソート導入で旧キャッシュを無効化）' do
      expect(WorkSearchService::CACHE_VERSION).to eq('v9')
    end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/work_search_service_spec.rb`
Expected: FAIL（関連度ソートの2件とキャッシュバージョンの1件が失敗。既存テストはPASSのまま）

- [ ] **Step 3: 実装する**

`backend/app/services/work_search_service.rb` を修正。

CACHE_VERSION の定数とコメントを変更:

```ruby
  # 実装変更時にインクリメントしてキャッシュを無効化する
  # v9: 関連度ティアソート導入・ゲーム検索のWikipedia補完軽量化（v8以前の履歴はgit参照）
  CACHE_VERSION = 'v9'
```

`#search` と private メソッドのソート呼び出しにクエリを渡す形へ変更:

```ruby
  def search(query, media_type: nil)
    key = cache_key(query, media_type)
    cached = Rails.cache.read(key)
    return cached unless cached.nil?

    results = enrich_covers_and_sort(fetch_and_sort(query, media_type), query)
    # 外部APIの一時障害で空になった結果を12時間キャッシュしない（1件以上のときのみ書き込む）
    Rails.cache.write(key, results, expires_in: CACHE_TTL) if results.any?
    results
  end
```

```ruby
  def fetch_and_sort(query, media_type)
    adapters = select_adapters(media_type)
    results = fetch_from_adapters_in_parallel(adapters, query, media_type)
    results = results.select { |r| r.media_type == media_type } if media_type.present?
    sort_results(results, query)
  end

  # 補完で書影が付くと品質スコアが変わるため、補完後に最終ソートし直す
  def enrich_covers_and_sort(results, query)
    WorkEnrichmentService.new.enrich_covers(results, limit: ENRICHMENT_TOP_N)
    sort_results(results, query)
  end
```

既存の `sort_by_quality_and_popularity` を `sort_results` に置き換え（メソッド名も実態に合わせて変更）:

```ruby
  # 関連度ティア降順 → 品質スコア降順 → 人気度降順の3段ソート（ADR-0045）
  # 検索語にマッチする作品を上位に固め、同ティア内では情報が揃った人気作を先に出す
  def sort_results(results, query)
    results.sort_by do |r|
      [-SearchRelevanceScorer.tier(query, r.title), -quality_score(r),
       -(r.metadata[:popularity] || 0)]
    end
  end
```

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/work_search_service_spec.rb`
Expected: PASS（既存＋新規すべて）

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "feat: 検索結果を関連度ティア優先の3段ソートに変更しキャッシュをv9へ更新"
```

---

### Task 3: IgdbAdapter — 検索時のWikipedia説明取得（fetch_extract）を廃止

**Files:**
- Modify: `backend/app/services/external_apis/igdb_adapter.rb`
- Test: `backend/spec/services/external_apis/igdb_adapter_spec.rb`

**Interfaces:**
- Consumes: なし（内部変更のみ）
- Produces: Wikipedia補完経由の `SearchResult#description` はIGDBの `summary`（英語または nil）のまま。`WikipediaGameAdapter#fetch_extract` は検索パスから呼ばれない

- [ ] **Step 1: テストを修正して失敗させる**

`backend/spec/services/external_apis/igdb_adapter_spec.rb` の `context '日本語クエリ + Wikipedia補完'` 内を修正。

`before` ブロックの `receive_messages` から `fetch_extract` のスタブを外し、スパイに変える:

```ruby
        allow(wikipedia_double).to receive_messages(
          search_titles: ['星のカービィ スーパーデラックス', '星のカービィ (アニメ)']
        )
        allow(wikipedia_double).to receive(:fetch_extract)
```

`it 'Wikipedia経由の結果に日本語説明をセットする'` を以下に置き換え:

```ruby
      it '検索時にはWikipediaの説明取得を呼ばず、説明はIGDBのsummaryのまま返す' do
        results = adapter.search('カービィ')
        expect(wikipedia_double).not_to have_received(:fetch_extract)
        # 説明は記録時の1作品補完（ADR-0044）に任せる
        expect(results.first.description).to eq('A Kirby game')
      end
```

`describe '発売年によるリメイク版・原作版の区別'` の `before` も同様に `fetch_extract` スタブを外す:

```ruby
      allow(wikipedia_double).to receive(:search_titles).and_return(['バイオハザード RE:2'])
      allow(wikipedia_double).to receive(:fetch_extract)
```

`it '発売年が一致するリメイク版（2019年）を優先して返す'` の説明アサーションを変更:

```ruby
        expect(results.first.description).to eq('2019 remake version')
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/external_apis/igdb_adapter_spec.rb`
Expected: FAIL（fetch_extract が呼ばれている・説明が上書きされているため）

- [ ] **Step 3: 実装する**

`backend/app/services/external_apis/igdb_adapter.rb` の `find_game_via_wikipedia` から説明補完の行を削除:

```ruby
    def find_game_via_wikipedia(jp_title, wikipedia, existing_ids)
      match = igdb_match_from_wikipedia(jp_title, wikipedia, existing_ids)
      return nil if match.nil?

      # 説明はIGDBのsummaryのまま返す。日本語説明は記録時の1作品補完（ADR-0044）に任せる
      match.title = jp_title
      existing_ids.add(match.external_api_id)
      match
    end
```

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/external_apis/igdb_adapter_spec.rb`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/external_apis/igdb_adapter.rb backend/spec/services/external_apis/igdb_adapter_spec.rb
git commit -m "feat: ゲーム検索時のWikipedia説明取得を廃止し記録時補完に統一"
```

---

### Task 4: IgdbAdapter — Wikipedia補完チェーンの並列化

**Files:**
- Modify: `backend/app/services/external_apis/igdb_adapter.rb`
- Test: `backend/spec/services/external_apis/igdb_adapter_spec.rb`

**Interfaces:**
- Consumes: `WikipediaGameAdapter#search_titles` / `#fetch_english_title`（既存）
- Produces: `search_via_wikipedia` がタイトルごとにThreadを立てて並列補完し、結果を重複排除して返す。1タイトルの失敗は他タイトルに波及しない

- [ ] **Step 1: 並列化で壊れる順序依存スタブをボディマッチに書き換え、新テストを追加する**

並列化するとIGDB APIの呼び出し順が不定になるため、`context '日本語クエリ + Wikipedia補完'` の順序依存スタブ（4連 `.to_return`）をリクエストボディでマッチする形に書き換える:

```ruby
        # 並列化により呼び出し順が不定になるため、順序依存ではなくボディでマッチさせる
        # 日本語の直接検索（keyword/pattern）→ 0件
        stub_request(:post, 'https://api.igdb.com/v4/games')
          .with(body: /カービィ/)
          .to_return(status: 200, body: [].to_json,
                     headers: { 'Content-Type' => 'application/json' })
        # Wikipedia経由の英語タイトル再検索 → ヒット
        stub_request(:post, 'https://api.igdb.com/v4/games')
          .with(body: /Kirby Super Star/)
          .to_return(status: 200, body: igdb_wikipedia_match.to_json,
                     headers: { 'Content-Type' => 'application/json' })
```

`describe '発売年によるリメイク版・原作版の区別'` の両contextの順序依存スタブも同様に書き換える:

```ruby
        stub_request(:post, 'https://api.igdb.com/v4/games')
          .with(body: /バイオハザード/)
          .to_return(status: 200, body: [].to_json,
                     headers: { 'Content-Type' => 'application/json' })
        stub_request(:post, 'https://api.igdb.com/v4/games')
          .with(body: /Resident Evil 2/)
          .to_return(status: 200, body: igdb_multiple_versions.to_json,
                     headers: { 'Content-Type' => 'application/json' })
```

さらに `context '日本語クエリ + Wikipedia補完'` の直後に並列化の振る舞いを検証する context を追加:

```ruby
    context 'Wikipedia補完の並列実行' do
      let(:wikipedia_double) { instance_double(ExternalApis::WikipediaGameAdapter) }

      let(:kirby_match) do
        [{ 'id' => 3075, 'name' => 'Kirby Super Star', 'summary' => 'A Kirby game',
           'cover' => { 'image_id' => 'co5xyz' }, 'total_rating' => 88.0 }]
      end
      let(:mario_match) do
        [{ 'id' => 1074, 'name' => 'Super Mario RPG', 'summary' => 'A Mario RPG',
           'cover' => { 'image_id' => 'co6abc' }, 'total_rating' => 90.0 }]
      end

      before do
        allow(ExternalApis::WikipediaGameAdapter).to receive(:new).and_return(wikipedia_double)
        allow(wikipedia_double).to receive(:fetch_extract)
        stub_request(:post, 'https://api.igdb.com/v4/games')
          .with(body: /ニンテンドー/)
          .to_return(status: 200, body: [].to_json,
                     headers: { 'Content-Type' => 'application/json' })
      end

      it '複数タイトルの補完結果をすべてマージして返す' do
        allow(wikipedia_double).to receive(:search_titles)
          .and_return(['星のカービィ スーパーデラックス', 'スーパーマリオRPG'])
        allow(wikipedia_double).to receive(:fetch_english_title)
          .with('星のカービィ スーパーデラックス').and_return('Kirby Super Star')
        allow(wikipedia_double).to receive(:fetch_english_title)
          .with('スーパーマリオRPG').and_return('Super Mario RPG')
        stub_request(:post, 'https://api.igdb.com/v4/games')
          .with(body: /Kirby Super Star/)
          .to_return(status: 200, body: kirby_match.to_json,
                     headers: { 'Content-Type' => 'application/json' })
        stub_request(:post, 'https://api.igdb.com/v4/games')
          .with(body: /Super Mario RPG/)
          .to_return(status: 200, body: mario_match.to_json,
                     headers: { 'Content-Type' => 'application/json' })

        results = adapter.search('ニンテンドー')
        expect(results.map(&:external_api_id)).to contain_exactly('3075', '1074')
      end

      it '1タイトルの補完が失敗しても他タイトルの結果は返る' do
        allow(wikipedia_double).to receive(:search_titles)
          .and_return(['星のカービィ スーパーデラックス', 'スーパーマリオRPG'])
        allow(wikipedia_double).to receive(:fetch_english_title)
          .with('星のカービィ スーパーデラックス').and_raise(Faraday::TimeoutError)
        allow(wikipedia_double).to receive(:fetch_english_title)
          .with('スーパーマリオRPG').and_return('Super Mario RPG')
        stub_request(:post, 'https://api.igdb.com/v4/games')
          .with(body: /Super Mario RPG/)
          .to_return(status: 200, body: mario_match.to_json,
                     headers: { 'Content-Type' => 'application/json' })

        results = adapter.search('ニンテンドー')
        expect(results.map(&:external_api_id)).to contain_exactly('1074')
      end

      it '複数タイトルが同じIGDBゲームに解決された場合は重複排除する' do
        allow(wikipedia_double).to receive(:search_titles)
          .and_return(['星のカービィ スーパーデラックス', '星のカービィSDX'])
        allow(wikipedia_double).to receive(:fetch_english_title).and_return('Kirby Super Star')
        stub_request(:post, 'https://api.igdb.com/v4/games')
          .with(body: /Kirby Super Star/)
          .to_return(status: 200, body: kirby_match.to_json,
                     headers: { 'Content-Type' => 'application/json' })

        results = adapter.search('ニンテンドー')
        expect(results.map(&:external_api_id)).to eq(['3075'])
      end
    end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/external_apis/igdb_adapter_spec.rb`
Expected: 新contextのうち「1タイトルの補完が失敗〜」が FAIL（現行は直列＆全体rescueのため空配列になる）。他の新テストはこの時点で通る場合もある（並列化前でも満たせる仕様のため）

- [ ] **Step 3: 実装する**

`backend/app/services/external_apis/igdb_adapter.rb` の `search_via_wikipedia` 〜 `search_igdb_candidates` を以下に置き換え:

```ruby
    def search_via_wikipedia(query, existing_results)
      wikipedia = WikipediaGameAdapter.new
      titles = wikipedia.search_titles(query)
      return [] if titles.empty?

      # 直接検索で見つかった既存IDのスナップショット。スレッドからは読み取りのみ行い、
      # 変更（重複排除の記録）は全スレッド完了後にまとめて行うことで競合状態を避ける
      existing_ids = existing_results.to_set(&:external_api_id)
      candidates = fetch_wikipedia_candidates_in_parallel(titles, wikipedia, existing_ids)
      dedupe_candidates(candidates, existing_ids)
    rescue StandardError => e
      Rails.logger.error("[IgdbAdapter] Wikipedia補完エラー: #{e.message}")
      []
    end

    # タイトルごとの補完チェーン（英語タイトル取得→IGDB再検索）は独立しているため
    # 並列実行する。直列だと最大10タイトル×2回のHTTP往復が積み重なり検索が遅くなる
    def fetch_wikipedia_candidates_in_parallel(titles, wikipedia, existing_ids)
      threads = titles.map do |jp_title|
        Thread.new do
          find_game_via_wikipedia(jp_title, wikipedia, existing_ids)
        rescue StandardError => e
          # 1タイトルの失敗で他タイトルの補完まで失わないよう、スレッド内で握りつぶす
          Rails.logger.error("[IgdbAdapter] Wikipedia補完エラー(#{jp_title}): #{e.message}")
          nil
        end
      end
      threads.map(&:value)
    end

    # 直接検索結果および補完同士の重複を除去する（先勝ち）
    def dedupe_candidates(candidates, existing_ids)
      seen = existing_ids.dup
      candidates.compact.filter_map do |candidate|
        next if seen.include?(candidate.external_api_id)

        seen.add(candidate.external_api_id)
        candidate
      end
    end

    def find_game_via_wikipedia(jp_title, wikipedia, existing_ids)
      match = igdb_match_from_wikipedia(jp_title, wikipedia, existing_ids)
      return nil if match.nil?

      # 説明はIGDBのsummaryのまま返す。日本語説明は記録時の1作品補完（ADR-0044）に任せる
      match.title = jp_title
      match
    end

    # Wikipedia言語間リンクで英語タイトル取得 → IGDBで検索（発売年でリメイク版を区別）
    def igdb_match_from_wikipedia(jp_title, wikipedia, existing_ids)
      en_title = wikipedia.fetch_english_title(jp_title)
      return nil unless en_title

      release_year = extract_year_from_title(en_title)
      candidates = search_igdb_candidates(en_title, existing_ids)
      select_best_candidate(candidates, release_year)
    end
```

`search_igdb_candidates` は変更なし（`existing_ids` は読み取り専用で使われるため並列でも安全）。

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/external_apis/igdb_adapter_spec.rb`
Expected: PASS（既存＋新規すべて）

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/external_apis/igdb_adapter.rb backend/spec/services/external_apis/igdb_adapter_spec.rb
git commit -m "feat: ゲーム検索のWikipedia補完チェーンを並列化して高速化"
```

---

### Task 5: 全体テスト・RuboCop・仕上げ

**Files:**
- Modify: なし（検証のみ。指摘があれば該当ファイルを修正）

**Interfaces:**
- Consumes: Task 1〜4 の全成果物
- Produces: グリーンなテストスイートとRuboCop 0違反

- [ ] **Step 1: バックエンド全テストを実行**

Run: `docker compose exec backend bundle exec rspec`
Expected: 全件PASS（既存機能へのリグレッションがないこと）

- [ ] **Step 2: RuboCopを実行**

Run: `docker compose exec backend bundle exec rubocop`
Expected: no offenses。違反があれば修正して再実行（自明な整形は `-a` で自動修正可）

- [ ] **Step 3: igdb_adapter.rb の行数確認（200行以内ルール）**

Run: `wc -l backend/app/services/external_apis/igdb_adapter.rb`
Expected: 210行前後まで許容。大幅に超える場合はWikipedia補完部分を `ExternalApis::IgdbWikipediaComplement` として分割する（分割した場合はテストも移動し、追加コミット）

- [ ] **Step 4: 修正が発生した場合はコミット**

```bash
git add -A backend
git commit -m "refactor: RuboCop指摘の修正"
```

（修正がなければスキップ）
