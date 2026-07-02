# 検索パフォーマンス改善v2 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 検索のキャッシュミス時に最悪20〜40秒かかる補完処理を削減し（フェーズA）、二段階レスポンスで結果表示を1〜2秒にする（フェーズB）。

**Architecture:** `WorkSearchService` から補完ロジックを `WorkEnrichmentService` に分離し、パイプラインを「fetch→一次ソート→上位20件のみ補完→最終ソート」に再構成する。補完結果はタイトル/ISBN単位で長期キャッシュ。APIに `enrich=false` パラメータを追加し、フロントは速報表示→補完済み差し替えの2回リクエストを行う。

**Tech Stack:** Rails 8 (APIモード) / RSpec / React 19 + TypeScript / Vitest + RTL

**Spec:** `docs/superpowers/specs/2026-07-02-search-performance-v2-design.md`
**ADR:** `docs/adr/0042-検索の二段階レスポンスに2回リクエスト方式を採用.md`
**Issue:** https://github.com/IKcoding-jp/Recolly/issues/189
**ブランチ:** `feat/search-performance-v2`（作成済み。このブランチ上で作業する）

## Global Constraints

- コメント・コミットメッセージは日本語。コメントは「なぜ」を書く
- マジックナンバー禁止（定数化する）
- 1ファイル200行以内を目安
- RuboCop / ESLint + Prettier 全ルール準拠（コミット時に lefthook が自動実行される）
- バックエンドのテスト環境は `config.cache_store = :null_store`。キャッシュ挙動のテストでは `allow(Rails).to receive(:cache).and_return(ActiveSupport::Cache::MemoryStore.new)` でメモリストアに差し替えること
- テスト実行はリポジトリルートから: `docker compose exec backend bundle exec rspec <path>` / `docker compose exec frontend npm test -- --run <path>`（docker環境が無い場合は `cd backend && bundle exec rspec` / `cd frontend && npm test -- --run`）
- `enrich=false` は後方互換：`enrich` パラメータ省略時の挙動は現行と同一であること

---

### Task 1: SearchTextNormalizer モジュール

クエリ・タイトルの表記揺れ吸収を1箇所に集約する（キャッシュキー生成とタイトル比較の両方で使うため）。

**Files:**
- Create: `backend/app/services/search_text_normalizer.rb`
- Test: `backend/spec/services/search_text_normalizer_spec.rb`

**Interfaces:**
- Produces: `SearchTextNormalizer.normalize(text) -> String`（NFKC正規化＋小文字化＋trim＋連続空白を半角1個に圧縮。nil は空文字を返す）

- [ ] **Step 1: 失敗するテストを書く**

```ruby
# backend/spec/services/search_text_normalizer_spec.rb
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SearchTextNormalizer do
  describe '.normalize' do
    it '前後の空白を除去する' do
      expect(described_class.normalize('  進撃の巨人  ')).to eq('進撃の巨人')
    end

    it '全角英数を半角に、大文字を小文字に変換する（NFKC＋downcase）' do
      expect(described_class.normalize('ＦＡＴＥ Stay Night')).to eq('fate stay night')
    end

    it '連続する空白・全角空白を半角空白1個に圧縮する' do
      expect(described_class.normalize("進撃の巨人　 Season　2")).to eq('進撃の巨人 season 2')
    end

    it 'nil は空文字を返す' do
      expect(described_class.normalize(nil)).to eq('')
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/search_text_normalizer_spec.rb`
Expected: FAIL（`uninitialized constant SearchTextNormalizer`）

- [ ] **Step 3: 実装**

```ruby
# backend/app/services/search_text_normalizer.rb
# frozen_string_literal: true

# 検索クエリ・作品タイトルの表記揺れ吸収（NFKC正規化＋小文字化＋trim＋連続空白圧縮）
# キャッシュキーの生成とタイトル同士の比較の両方で使うため、1箇所に集約している
module SearchTextNormalizer
  module_function

  def normalize(text)
    text.to_s.unicode_normalize(:nfkc).downcase.strip.gsub(/\s+/, ' ')
  end
end
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/search_text_normalizer_spec.rb`
Expected: PASS（4 examples, 0 failures）

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/search_text_normalizer.rb backend/spec/services/search_text_normalizer_spec.rb
git commit -m "feat: 検索テキスト正規化モジュールを追加"
```

---

### Task 2: WorkEnrichmentService の抽出（挙動不変リファクタ + limit 対応）

`work_search_service.rb`（277行）から補完ロジックを分離し、あわせて「先頭 limit 件だけHTTP補完する」機能を追加する。**既存の `work_search_service_spec.rb` は変更せず、全テストがパスし続けること**（search 経由で補完まで検証しているため、リファクタの安全網になる）。

**Files:**
- Create: `backend/app/services/work_enrichment_service.rb`
- Modify: `backend/app/services/work_search_service.rb`
- Test: `backend/spec/services/work_enrichment_service_spec.rb`

**Interfaces:**
- Consumes: `SearchTextNormalizer.normalize`（Task 1）
- Produces: `WorkEnrichmentService#enrich(sorted_results, limit: nil) -> Array<SearchResult>`
  - `sorted_results` の先頭 `limit` 件のみ openBD 補完・説明補完（HTTP）を行う。`limit: nil` は全件
  - シリーズ親説明流用（`share_series_descriptions`）はHTTPを伴わないため **常に全件** に適用する
  - 引数の配列を破壊的に更新し、同じ配列を返す

- [ ] **Step 1: limit の失敗するテストを書く**

```ruby
# backend/spec/services/work_enrichment_service_spec.rb
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe WorkEnrichmentService, type: :service do
  subject(:service) { described_class.new }

  let(:tmdb_double) { instance_double(ExternalApis::TmdbAdapter, fetch_japanese_description: nil) }
  let(:wiki_double) { instance_double(ExternalApis::WikipediaClient, search_and_fetch_extract: nil) }

  before do
    allow(ExternalApis::TmdbAdapter).to receive(:new).and_return(tmdb_double)
    allow(ExternalApis::WikipediaClient).to receive(:new).and_return(wiki_double)
  end

  def build_result(title, description: nil)
    ExternalApis::BaseAdapter::SearchResult.new(
      title, 'anime', description, nil, nil, title, 'anilist', { popularity: 0.5 }
    )
  end

  describe '#enrich の limit' do
    it 'limit 件目までのみ説明補完のHTTPリクエストを行う' do
      results = [build_result('作品A'), build_result('作品B'), build_result('作品C')]
      service.enrich(results, limit: 2)

      expect(tmdb_double).to have_received(:fetch_japanese_description).with('作品A')
      expect(tmdb_double).to have_received(:fetch_japanese_description).with('作品B')
      expect(tmdb_double).not_to have_received(:fetch_japanese_description).with('作品C')
    end

    it 'limit: nil で全件を補完する' do
      results = [build_result('作品A'), build_result('作品B')]
      service.enrich(results)

      expect(tmdb_double).to have_received(:fetch_japanese_description).with('作品A')
      expect(tmdb_double).to have_received(:fetch_japanese_description).with('作品B')
    end

    it 'limit 外の結果にもシリーズ親説明の流用は適用される' do
      parent = build_result('進撃の巨人', description: '巨人と戦う話。')
      child = build_result('進撃の巨人 Season 2')
      results = [parent, child]
      service.enrich(results, limit: 1)

      expect(child.description).to eq('巨人と戦う話。')
      expect(child.metadata[:description_from_parent]).to be true
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/work_enrichment_service_spec.rb`
Expected: FAIL（`uninitialized constant WorkEnrichmentService`）

- [ ] **Step 3: WorkEnrichmentService を作成**

現在の `work_search_service.rb` から以下の private メソッド群を**そのまま移設**する（ロジック変更禁止。唯一の変更点: `normalize_for_parent_match` の中身を `SearchTextNormalizer.normalize` の呼び出しに置き換える）:
`enrich_books_via_openbd` / `openbd_enrichment_target?` / `enrich_single_book` / `enrich_missing_descriptions` / `try_enrich_description` / `fetch_japanese_description_from_tmdb` / `resolve_description` / `english_text?` / `share_series_descriptions` / `build_parent_candidates` / `needs_parent_description?` / `find_parent_by_prefix` / `valid_prefix_parent?` / `prefix_parent_structure_ok?` / `normalize_for_parent_match`

```ruby
# backend/app/services/work_enrichment_service.rb
# frozen_string_literal: true

# 検索結果の補完（openBD書誌・日本語説明・シリーズ親説明の流用）を担当する。
# HTTPを伴う補完は上位 limit 件に限定できる（検索パフォーマンス改善v2）。
# WorkSearchService から分離した（1ファイル200行ルール対応・spec 2026-07-02 参照）
class WorkEnrichmentService
  ENRICHMENT_BATCH_SIZE = 5

  # sorted_results: 一次ソート済みの全検索結果
  # limit: HTTP補完（openBD・説明）の対象件数。nil なら全件
  # シリーズ親説明の流用はメモリ内処理のため常に全件に適用する
  def enrich(sorted_results, limit: nil)
    targets = limit ? sorted_results.first(limit) : sorted_results
    enrich_books_via_openbd(targets)
    enrich_missing_descriptions(targets)
    share_series_descriptions(sorted_results)
    sorted_results
  end

  private

  # （ここに上記リストのメソッドを work_search_service.rb から移設する。
  #   各メソッドのコメントも一緒に移す。normalize_for_parent_match のみ以下に置き換え）

  # 親マッチ用の表記揺れ吸収。正規化ロジックは SearchTextNormalizer に集約した
  def normalize_for_parent_match(text)
    SearchTextNormalizer.normalize(text)
  end
end
```

- [ ] **Step 4: WorkSearchService から補完ロジックを除去して委譲に置き換え**

`work_search_service.rb` に残すもの: `CACHE_TTL` / `CACHE_VERSION` / `search` / `fetch_and_process` / `adapter_map` / `fetch_from_adapters_in_parallel` / `select_adapters` / `all_adapters` / `quality_score` / `sort_by_quality_and_popularity`。`ENRICHMENT_BATCH_SIZE` 定数と移設済みメソッドは削除する。

`fetch_and_process` を以下に変更（このTaskでは挙動を変えない＝全件補完のまま）:

```ruby
  def fetch_and_process(query, media_type)
    adapters = select_adapters(media_type)
    results = fetch_from_adapters_in_parallel(adapters, query, media_type)
    results = results.select { |r| r.media_type == media_type } if media_type.present?

    WorkEnrichmentService.new.enrich(results)
    sort_by_quality_and_popularity(results)
  end
```

クラス先頭の `# rubocop:disable Metrics/ClassLength` が不要になったら外す。

- [ ] **Step 5: 新旧テストがパスすることを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/work_enrichment_service_spec.rb spec/services/work_search_service_spec.rb`
Expected: PASS（既存テストは無修正で全パス。落ちる場合は移設ミス — 挙動を変えないこと）

- [ ] **Step 6: コミット**

```bash
git add backend/app/services/work_enrichment_service.rb backend/app/services/work_search_service.rb backend/spec/services/work_enrichment_service_spec.rb
git commit -m "refactor: 補完ロジックをWorkEnrichmentServiceに分離しlimit対応を追加"
```

---

### Task 3: タイトル単位の補完キャッシュ（説明＋openBD）

補完結果を作品タイトル/ISBN 単位でキャッシュし、検索クエリをまたいで再利用する。

**Files:**
- Modify: `backend/app/services/work_enrichment_service.rb`
- Test: `backend/spec/services/work_enrichment_service_spec.rb`（追記）

**Interfaces:**
- Produces: キャッシュキー体系（他タスクは参照しないが、運用時のデバッグ用に固定）
  - 説明: `work_search:desc:v1:<正規化タイトル>`（ヒット値は説明文字列 or `'NOT_FOUND'`）
  - openBD: `work_search:openbd:v1:<ISBN>`（ヒット値は `{cover_image_url:, description:}` Hash or `'NOT_FOUND'`）

- [ ] **Step 1: 失敗するテストを書く（work_enrichment_service_spec.rb に追記）**

```ruby
  describe '補完キャッシュ' do
    let(:memory_store) { ActiveSupport::Cache::MemoryStore.new }

    before do
      allow(Rails).to receive(:cache).and_return(memory_store)
    end

    it '取得した日本語説明をタイトル単位でキャッシュし、2回目は外部APIを呼ばない' do
      allow(tmdb_double).to receive(:fetch_japanese_description).with('葬送のフリーレン').and_return('魔王討伐後の物語。')

      first = build_result('葬送のフリーレン')
      service.enrich([first])
      second = build_result('葬送のフリーレン')
      service.enrich([second])

      expect(second.description).to eq('魔王討伐後の物語。')
      expect(tmdb_double).to have_received(:fetch_japanese_description).with('葬送のフリーレン').once
    end

    it 'タイトルの表記揺れ（末尾空白・大文字小文字）でも同じキャッシュにヒットする' do
      allow(tmdb_double).to receive(:fetch_japanese_description).with('STEINS;GATE').and_return('タイムリープSF。')

      service.enrich([build_result('STEINS;GATE')])
      second = build_result('steins;gate ')
      service.enrich([second])

      expect(second.description).to eq('タイムリープSF。')
      expect(tmdb_double).to have_received(:fetch_japanese_description).once
    end

    it '説明が見つからなかった事実もキャッシュし、2回目は再試行しない（ネガティブキャッシュ）' do
      service.enrich([build_result('無名の作品')])
      service.enrich([build_result('無名の作品')])

      expect(tmdb_double).to have_received(:fetch_japanese_description).with('無名の作品').once
      expect(wiki_double).to have_received(:search_and_fetch_extract).with('無名の作品').once
    end

    it 'ネガティブキャッシュヒット時は既存の説明を保持する' do
      service.enrich([build_result('無名の作品')]) # NOT_FOUND がキャッシュされる
      second = build_result('無名の作品', description: 'English description here.')
      service.enrich([second])

      expect(second.description).to eq('English description here.')
    end

    it 'openBDの書誌データをISBN単位でキャッシュし、2回目は外部APIを呼ばない' do
      openbd_double = instance_double(ExternalApis::OpenbdClient)
      allow(ExternalApis::OpenbdClient).to receive(:new).and_return(openbd_double)
      allow(openbd_double).to receive(:fetch).with('9784101001340')
                                             .and_return({ cover_image_url: 'https://c.jpg', description: '名作。' })

      book = ExternalApis::BaseAdapter::SearchResult.new(
        '人間失格', 'book', nil, nil, nil, 'g1', 'google_books', { isbn: '9784101001340', popularity: 0.5 }
      )
      service.enrich([book])
      book2 = ExternalApis::BaseAdapter::SearchResult.new(
        '人間失格', 'book', nil, nil, nil, 'g1', 'google_books', { isbn: '9784101001340', popularity: 0.5 }
      )
      service.enrich([book2])

      expect(book2.cover_image_url).to eq('https://c.jpg')
      expect(openbd_double).to have_received(:fetch).once
    end
  end
```

注意: 既存の `describe '#enrich の limit'` テストはキャッシュなし（null_store）のまま動くので変更不要。

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/work_enrichment_service_spec.rb`
Expected: 追記した5例が FAIL（キャッシュ未実装のため `fetch_japanese_description` が2回呼ばれる等）

- [ ] **Step 3: キャッシュを実装**

`WorkEnrichmentService` に定数を追加:

```ruby
  DESCRIPTION_CACHE_PREFIX = 'work_search:desc:v1'
  OPENBD_CACHE_PREFIX = 'work_search:openbd:v1'
  # 作品の説明文・書誌データはほぼ変わらないため長期キャッシュにする
  ENRICHMENT_CACHE_TTL = 30.days
  # 「見つからなかった」は外部APIのデータ追加で変わりうるため短めに再試行させる
  NEGATIVE_CACHE_TTL = 1.day
  # Rails.cache は nil を「キャッシュなし」と区別できないため、未発見を表すマーカー値
  NOT_FOUND = 'NOT_FOUND'
```

`try_enrich_description` を以下に置き換え:

```ruby
  # 補完の試行順:
  # 1. タイトル単位キャッシュ（検索クエリをまたいで再利用する）
  # 2. TMDB日本語説明（AniList結果は title_english/title_romaji も試す）
  # 3. Wikipedia search_and_fetch_extract
  # 4. 元の説明にフォールバック（英語でも nil にせずそのまま残す）
  def try_enrich_description(result)
    cache_key = "#{DESCRIPTION_CACHE_PREFIX}:#{SearchTextNormalizer.normalize(result.title)}"
    cached = Rails.cache.read(cache_key)
    if cached
      result.description = cached unless cached == NOT_FOUND
      return
    end

    description = fetch_description_from_apis(result)
    write_enrichment_cache(cache_key, description)
    result.description = resolve_description(description, result.description)
  end

  # スレッドごとに独立したクライアントインスタンスを使用する
  # （Faradayコネクションの共有を避けるため）
  def fetch_description_from_apis(result)
    tmdb = ExternalApis::TmdbAdapter.new
    wikipedia = ExternalApis::WikipediaClient.new

    description = fetch_japanese_description_from_tmdb(result, tmdb)
    description || wikipedia.search_and_fetch_extract(result.title)
  end

  # 見つかった値は長期、未発見は NOT_FOUND マーカーで短期キャッシュする
  def write_enrichment_cache(cache_key, value)
    if value.present?
      Rails.cache.write(cache_key, value, expires_in: ENRICHMENT_CACHE_TTL)
    else
      Rails.cache.write(cache_key, NOT_FOUND, expires_in: NEGATIVE_CACHE_TTL)
    end
  end
```

`enrich_single_book` を以下に置き換え:

```ruby
  # 欠損している項目だけを補完する（既存データは上書きしない）
  def enrich_single_book(result)
    data = fetch_openbd_with_cache(result.metadata[:isbn])
    return if data.nil?

    result.cover_image_url ||= data[:cover_image_url]
    result.description ||= data[:description]
  end

  # ISBN単位でopenBD書誌をキャッシュする（説明キャッシュと同じNOT_FOUND方式）
  def fetch_openbd_with_cache(isbn)
    cache_key = "#{OPENBD_CACHE_PREFIX}:#{isbn}"
    cached = Rails.cache.read(cache_key)
    return cached == NOT_FOUND ? nil : cached unless cached.nil?

    data = ExternalApis::OpenbdClient.new.fetch(isbn)
    write_enrichment_cache(cache_key, data)
    data
  end
```

注意: `write_enrichment_cache` は Hash も受けるため `value.present?` 判定でよい（空Hashは実質発生しない）。

- [ ] **Step 4: 全テストがパスすることを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/work_enrichment_service_spec.rb spec/services/work_search_service_spec.rb`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/work_enrichment_service.rb backend/spec/services/work_enrichment_service_spec.rb
git commit -m "feat: 補完結果をタイトル/ISBN単位でキャッシュしクエリ間で再利用"
```

---

### Task 4: 補完系APIのタイムアウト短縮

補完は失敗しても英語表示にフォールバックするだけなので、タイムアウトを攻めて「1件詰まると全体が10秒待つ」事故を防ぐ。**一次検索（各アダプターの search）のタイムアウトは変更しない。**

**Files:**
- Modify: `backend/app/services/external_apis/base_adapter.rb`（connection にタイムアウト引数を追加）
- Modify: `backend/app/services/external_apis/wikipedia_client.rb`
- Modify: `backend/app/services/external_apis/openbd_client.rb`
- Modify: `backend/app/services/external_apis/tmdb_adapter.rb`（補完専用コネクションを分離）

**Interfaces:**
- Consumes: なし
- Produces: `BaseAdapter#connection(url:, open_timeout: 5, timeout: 10)`（デフォルト値は現行と同一なので既存アダプターは無変更で動く）

- [ ] **Step 1: BaseAdapter#connection を引数化**

```ruby
    def connection(url:, open_timeout: 5, timeout: 10)
      Faraday.new(url: url, request: { open_timeout: open_timeout, timeout: timeout }) do |f|
        f.request :json
        # POSTも含める（AniList GraphQL等の検索クエリは冪等のため安全）
        f.request :retry, max: 2, retry_statuses: [500, 502, 503, 504],
                          methods: %i[get head options put delete post]
        f.response :logger, Rails.logger, headers: false, bodies: !Rails.env.production?
        f.response :json
        f.adapter Faraday.default_adapter
      end
    end
```

- [ ] **Step 2: TmdbAdapter の補完パスを専用コネクションに分離**

`fetch_japanese_description` 内の `tmdb_connection` を `enrichment_connection` に変更し、以下を追加:

```ruby
    # 補完は失敗しても英語説明にフォールバックするだけなので短いタイムアウトで攻める
    # 一次検索（tmdb_connection）は失敗＝結果ゼロになるため現行の 5/10 秒を維持する
    ENRICHMENT_OPEN_TIMEOUT = 2
    ENRICHMENT_TIMEOUT = 3
```

```ruby
    def enrichment_connection
      @enrichment_connection ||= connection(
        url: BASE_URL, open_timeout: ENRICHMENT_OPEN_TIMEOUT, timeout: ENRICHMENT_TIMEOUT
      )
    end
```

- [ ] **Step 3: WikipediaClient / OpenbdClient のタイムアウトを短縮**

両ファイルに定数を追加し、`connection` の `request:` 指定を置き換える:

```ruby
    # 補完用クライアントのため短いタイムアウトで攻める（失敗時は補完なしで表示するだけ）
    OPEN_TIMEOUT = 2
    TIMEOUT = 3
```

```ruby
      # WikipediaClient / OpenbdClient それぞれの connection メソッド内:
      request: { open_timeout: OPEN_TIMEOUT, timeout: TIMEOUT }
```

- [ ] **Step 4: 既存テストがパスすることを確認**

Run: `docker compose exec backend bundle exec rspec spec/services`
Expected: PASS（タイムアウト値はテスト対象外のため既存テストに影響なし）

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/external_apis
git commit -m "feat: 補完系APIのタイムアウトを3秒に短縮"
```

---

### Task 5: WorkSearchService の再構成（上位N件補完・キー正規化・二段階対応）

パイプラインを「fetch→一次ソート→上位20件補完→最終ソート」に変更し、キャッシュキーを正規化（v7）、`enrich: false` と生結果キャッシュを実装する。

**Files:**
- Modify: `backend/app/services/work_search_service.rb`（全面書き換え）
- Test: `backend/spec/services/work_search_service_spec.rb`（既存のキャッシュ関連テストの修正＋新規テスト追記）

**Interfaces:**
- Consumes: `WorkEnrichmentService#enrich(sorted_results, limit:)`（Task 2）、`SearchTextNormalizer.normalize`（Task 1）
- Produces:
  - `WorkSearchService#search(query, media_type: nil) -> Array<SearchResult>`（後方互換。WorkRecommender が使用。常に補完込み）
  - `WorkSearchService#search_with_status(query, media_type: nil, enrich: true) -> WorkSearchService::Outcome`
  - `WorkSearchService::Outcome = Struct.new(:results, :enriched)`（`results`: Array<SearchResult>, `enriched`: Boolean）
  - `WorkSearchService::ENRICHMENT_TOP_N = 20`

- [ ] **Step 1: 失敗するテストを書く（work_search_service_spec.rb に追記）**

```ruby
  describe '#search_with_status（二段階レスポンス）' do
    let(:memory_store) { ActiveSupport::Cache::MemoryStore.new }

    before do
      allow(Rails).to receive(:cache).and_return(memory_store)
      # 補完の呼び出し有無を検証するため WorkEnrichmentService をスパイする
      allow(WorkEnrichmentService).to receive(:new).and_call_original
    end

    it 'enrich: false は補完をスキップし enriched: false を返す' do
      outcome = service.search_with_status('テスト', media_type: 'anime', enrich: false)

      expect(outcome.enriched).to be false
      expect(outcome.results.length).to eq(1)
      expect(WorkEnrichmentService).not_to have_received(:new)
    end

    it 'enrich: true（デフォルト）は補完を実行し enriched: true を返す' do
      outcome = service.search_with_status('テスト', media_type: 'anime')

      expect(outcome.enriched).to be true
      expect(WorkEnrichmentService).to have_received(:new)
    end

    it 'enrich: false でもフルキャッシュヒット時は enriched: true で補完済み結果を返す' do
      service.search_with_status('テスト', media_type: 'anime') # フルキャッシュを作る
      outcome = service.search_with_status('テスト', media_type: 'anime', enrich: false)

      expect(outcome.enriched).to be true
    end

    it 'enrich: false の生結果は5分キャッシュされ、直後の enrich: true が外部API検索を再実行しない' do
      service.search_with_status('テスト', media_type: 'anime', enrich: false)
      service.search_with_status('テスト', media_type: 'anime')

      expect(anilist_double).to have_received(:safe_search).once
    end

    it 'enrich: false の結果はフルキャッシュに書き込まない' do
      service.search_with_status('テスト', media_type: 'anime', enrich: false)
      key = "work_search:#{WorkSearchService::CACHE_VERSION}:anime:テスト"

      expect(Rails.cache.exist?(key)).to be false
    end
  end

  describe 'キャッシュキーの正規化' do
    let(:memory_store) { ActiveSupport::Cache::MemoryStore.new }

    before { allow(Rails).to receive(:cache).and_return(memory_store) }

    it '末尾空白・大文字の揺れで同じキャッシュにヒットする' do
      service.search('STEINS;GATE', media_type: 'anime')
      service.search('steins;gate ', media_type: 'anime')

      expect(anilist_double).to have_received(:safe_search).once
    end
  end

  describe '補完対象の上位N件限定' do
    it '一次ソート上位 ENRICHMENT_TOP_N 件のみを limit として補完に渡す' do
      enrichment = instance_double(WorkEnrichmentService)
      allow(WorkEnrichmentService).to receive(:new).and_return(enrichment)
      allow(enrichment).to receive(:enrich) { |results, **| results }

      service.search('テスト', media_type: 'anime')

      expect(enrichment).to have_received(:enrich)
        .with(anything, limit: WorkSearchService::ENRICHMENT_TOP_N)
    end
  end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/work_search_service_spec.rb`
Expected: 追記分が FAIL（`search_with_status` 未定義）

- [ ] **Step 3: WorkSearchService を書き換え**

```ruby
# backend/app/services/work_search_service.rb
# frozen_string_literal: true

# 検索パイプライン: fetch(並列) → 一次ソート → 上位N件のみ補完 → 最終ソート
# 補完ロジックは WorkEnrichmentService に分離している。
# enrich: false で補完をスキップした速報結果を返せる（二段階レスポンス・ADR-0042）
class WorkSearchService
  CACHE_TTL = 12.hours
  # 二段階レスポンスで2回目のリクエストが外部API検索をやり直さないための短期キャッシュ
  RAW_CACHE_TTL = 5.minutes
  # 実装変更時にインクリメントしてキャッシュを無効化する
  # v7: キャッシュキーのクエリ正規化＋二段階レスポンス導入（v6以前の履歴はgit参照）
  CACHE_VERSION = 'v7'
  # ユーザーが最初に見るのは上位の結果だけなので、重いHTTP補完は上位に限定する
  ENRICHMENT_TOP_N = 20

  Outcome = Struct.new(:results, :enriched)

  # 後方互換API（WorkRecommender等が使用）。常に補完込みの結果を返す
  def search(query, media_type: nil)
    search_with_status(query, media_type: media_type).results
  end

  # enrich: false で補完（openBD・説明・親説明流用）をスキップして即返す
  # フルキャッシュがあれば enrich 指定に関わらず補完済み結果を enriched: true で返す
  def search_with_status(query, media_type: nil, enrich: true)
    cached = Rails.cache.read(full_cache_key(query, media_type))
    return Outcome.new(cached, true) unless cached.nil?
    return Outcome.new(fetch_raw(query, media_type), false) unless enrich

    results = enrich_and_sort(fetch_raw(query, media_type))
    # 外部APIの一時障害で空になった結果を12時間キャッシュしない（1件以上のときのみ書き込む）
    Rails.cache.write(full_cache_key(query, media_type), results, expires_in: CACHE_TTL) if results.any?
    Outcome.new(results, true)
  end

  private

  # 生の検索結果（補完前・一次ソート済み）を取得する
  def fetch_raw(query, media_type)
    key = raw_cache_key(query, media_type)
    cached = Rails.cache.read(key)
    return cached unless cached.nil?

    results = fetch_and_sort(query, media_type)
    Rails.cache.write(key, results, expires_in: RAW_CACHE_TTL) if results.any?
    results
  end

  def fetch_and_sort(query, media_type)
    adapters = select_adapters(media_type)
    results = fetch_from_adapters_in_parallel(adapters, query, media_type)
    results = results.select { |r| r.media_type == media_type } if media_type.present?
    sort_by_quality_and_popularity(results)
  end

  # 補完で説明が付くと品質スコアが変わるため、補完後に最終ソートし直す
  def enrich_and_sort(results)
    WorkEnrichmentService.new.enrich(results, limit: ENRICHMENT_TOP_N)
    sort_by_quality_and_popularity(results)
  end

  def full_cache_key(query, media_type)
    "work_search:#{CACHE_VERSION}:#{media_type || 'all'}:#{SearchTextNormalizer.normalize(query)}"
  end

  def raw_cache_key(query, media_type)
    "work_search:raw:#{CACHE_VERSION}:#{media_type || 'all'}:#{SearchTextNormalizer.normalize(query)}"
  end

  # クラス定数ではなくメソッドで返す（Zeitwerkのオートロード順序問題を回避）
  # movieにAniListを含める（アニメ映画はTMDBで除外されるためAniList経由で取得）
  def adapter_map
    {
      'movie' => [ExternalApis::TmdbAdapter, ExternalApis::AniListAdapter],
      'drama' => [ExternalApis::TmdbAdapter],
      'anime' => [ExternalApis::AniListAdapter],
      'manga' => [ExternalApis::AniListAdapter],
      'book' => [ExternalApis::GoogleBooksAdapter],
      'game' => [ExternalApis::IgdbAdapter]
    }
  end

  # 複数のアダプターを並列にAPI呼び出しし、結果を統合する
  # 各アダプターのsafe_searchは個別にエラーハンドリング済みのため、
  # 1つのスレッドが失敗しても他のスレッドには影響しない
  def fetch_from_adapters_in_parallel(adapters, query, media_type)
    threads = adapters.map do |adapter|
      Thread.new { adapter.safe_search(query, media_type: media_type) }
    end
    threads.flat_map(&:value)
  end

  def select_adapters(media_type)
    if media_type.present?
      classes = adapter_map[media_type]
      classes ? classes.map(&:new) : []
    else
      all_adapters
    end
  end

  def all_adapters
    [
      ExternalApis::TmdbAdapter.new,
      ExternalApis::AniListAdapter.new,
      ExternalApis::GoogleBooksAdapter.new,
      ExternalApis::IgdbAdapter.new
    ]
  end

  # 品質スコア（0.0〜1.0）: 画像あり=0.5, 説明あり=0.5
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
end
```

- [ ] **Step 4: 既存テストの修正**

`spec/services/work_search_service_spec.rb` の既存キャッシュテスト（`CACHE_VERSION` を含むキー文字列を組み立てている箇所、Grepで `work_search:` を検索）を確認する。キー形式は `work_search:v7:<media>:<正規化クエリ>` になった。テストのクエリが日本語のみ（例: `テスト`）なら正規化後も同一文字列なので、`CACHE_VERSION` 定数参照のままパスするはず。落ちるテストがあれば期待キーを正規化後の文字列に直す。

- [ ] **Step 5: サービス全テストがパスすることを確認**

Run: `docker compose exec backend bundle exec rspec spec/services`
Expected: PASS（work_recommender_spec は `search` をスタブしているため無影響）

- [ ] **Step 6: コミット**

```bash
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "feat: 検索を上位N件補完・キー正規化・二段階レスポンス対応に再構成"
```

---

### Task 6: コントローラーの enrich パラメータ対応

**Files:**
- Modify: `backend/app/controllers/api/v1/works_controller.rb`
- Test: `backend/spec/requests/api/v1/works_spec.rb`

**Interfaces:**
- Consumes: `WorkSearchService#search_with_status`（Task 5）
- Produces: `GET /api/v1/works/search?q=...&media_type=...&enrich=false` → `{ "results": [...], "enriched": false }`（`enrich` 省略時は現行どおりフル処理で `enriched: true`）

- [ ] **Step 1: 失敗するテストを書く**

`spec/requests/api/v1/works_spec.rb` の検索スタブを確認する。現在は `instance_spy(WorkSearchService)` を `search` メソッド前提でスタブしているため、`search_with_status` を返すよう修正する:

```ruby
    # 修正: search → search_with_status（Outcome を返す）
    service_double = instance_spy(WorkSearchService)
    allow(WorkSearchService).to receive(:new).and_return(service_double)
    allow(service_double).to receive(:search_with_status)
      .and_return(WorkSearchService::Outcome.new([], true))
```

新規テストを追記:

```ruby
    it 'enrich=false をサービスに引き渡し enriched を返す' do
      allow(service_double).to receive(:search_with_status)
        .and_return(WorkSearchService::Outcome.new([], false))

      get '/api/v1/works/search', params: { q: 'テスト', enrich: 'false' }, headers: auth_headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['enriched']).to be false
      expect(service_double).to have_received(:search_with_status)
        .with('テスト', media_type: nil, enrich: false)
    end

    it 'enrich 省略時は enrich: true でサービスを呼ぶ（後方互換）' do
      get '/api/v1/works/search', params: { q: 'テスト' }, headers: auth_headers

      expect(response.parsed_body['enriched']).to be true
      expect(service_double).to have_received(:search_with_status)
        .with('テスト', media_type: nil, enrich: true)
    end
```

注意: `auth_headers` 等の認証ヘルパーは既存テストの書き方に合わせること（ファイル冒頭の既存テストを参照）。

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/works_spec.rb`
Expected: FAIL

- [ ] **Step 3: コントローラーを実装**

```ruby
      # GET /api/v1/works/search?q=キーワード&media_type=anime&enrich=false
      # enrich=false は補完をスキップした速報結果を返す（二段階レスポンス・ADR-0042）
      def search
        query = params[:q]
        return render json: { error: '検索キーワードを入力してください' }, status: :unprocessable_content if query.blank?

        outcome = WorkSearchService.new.search_with_status(
          query, media_type: params[:media_type], enrich: params[:enrich] != 'false'
        )
        render json: { results: outcome.results.map(&:to_h), enriched: outcome.enriched }
      end
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/works_spec.rb`
Expected: PASS

- [ ] **Step 5: バックエンド全テスト＋RuboCop**

Run: `docker compose exec backend bundle exec rspec && docker compose exec backend bundle exec rubocop`
Expected: 全パス・違反0（違反があれば修正してから次へ）

- [ ] **Step 6: コミット**

```bash
git add backend/app/controllers/api/v1/works_controller.rb backend/spec/requests/api/v1/works_spec.rb
git commit -m "feat: 検索APIにenrichパラメータとenrichedフィールドを追加"
```

---

### Task 7: フロントエンド型定義と worksApi の enrich 対応

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/worksApi.ts`
- Test: `frontend/src/lib/worksApi.test.ts`

**Interfaces:**
- Produces:
  - `SearchResponse { results: SearchResult[]; enriched: boolean }`
  - `worksApi.search(query, mediaType?, options?: { signal?: AbortSignal; enrich?: boolean })`（`enrich: false` のときのみ `&enrich=false` をクエリに付与）

- [ ] **Step 1: 失敗するテストを書く（worksApi.test.ts に追記。既存テストのモックレスポンスに `enriched: true` を追加）**

```typescript
  it('enrich: false のとき enrich=false クエリパラメータを付与する', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [], enriched: false }), { status: 200 }),
    )

    await worksApi.search('テスト', undefined, { enrich: false })

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('enrich=false')
  })

  it('enrich 未指定のとき enrich パラメータを付与しない', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [], enriched: true }), { status: 200 }),
    )

    await worksApi.search('テスト')

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).not.toContain('enrich')
  })
```

注意: 既存の worksApi.test.ts のモック方式（`vi.mock('./api')` か `fetch` モックか）を先に確認し、既存の書き方に合わせること。上記は fetch モック前提の例。

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec frontend npm test -- --run src/lib/worksApi.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`types.ts`:

```typescript
export interface SearchResponse {
  results: SearchResult[]
  // 補完（日本語説明等）済みかどうか。false は速報結果（二段階レスポンスの1段目）
  enriched: boolean
}
```

`worksApi.ts` の search:

```typescript
  // options.signal で AbortController と連携できるようにする（検索のレース条件対策）
  // options.enrich: false で補完スキップの速報結果を要求する（二段階レスポンス）
  search(
    query: string,
    mediaType?: MediaType,
    options?: { signal?: AbortSignal; enrich?: boolean },
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query })
    if (mediaType) params.append('media_type', mediaType)
    if (options?.enrich === false) params.append('enrich', 'false')
    return request<SearchResponse>(`/works/search?${params.toString()}`, {
      signal: options?.signal,
    })
  },
```

- [ ] **Step 4: 型エラーの波及を修正**

`SearchResponse` に `enriched` が必須になったため、`worksApi.search` をモックしている既存テスト（`SearchPage.test.tsx` 等、Grep: `results:` × `worksApi`）のモック戻り値に `enriched: true` を追加する。

Run: `docker compose exec frontend npx tsc --noEmit`
Expected: エラー0

- [ ] **Step 5: テストがパスすることを確認**

Run: `docker compose exec frontend npm test -- --run`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/worksApi.ts frontend/src/lib/worksApi.test.ts frontend/src/pages/SearchPage/SearchPage.test.tsx
git commit -m "feat: worksApi.searchにenrichオプションとenriched型を追加"
```

---

### Task 8: SearchProgress に message プロパティを追加

補完中の進行表示に既存コンポーネントを流用する（新規CSS直書き禁止ルールに従い、新コンポーネントは作らない）。

**Files:**
- Modify: `frontend/src/components/SearchProgress/SearchProgress.tsx`
- Test: `frontend/src/components/SearchProgress/SearchProgress.test.tsx`（追記）

**Interfaces:**
- Produces: `<SearchProgress message="..." />` — `message` 指定時は3段階のタイマー切り替えをせず固定メッセージを表示。未指定時は現行どおり

- [ ] **Step 1: 失敗するテストを書く（SearchProgress.test.tsx に追記）**

```typescript
  it('message 指定時は固定メッセージを表示しタイマー切り替えをしない', () => {
    vi.useFakeTimers()
    render(<SearchProgress message="日本語の説明を取得中…" />)

    expect(screen.getByText('日本語の説明を取得中…')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText('日本語の説明を取得中…')).toBeInTheDocument()
    vi.useRealTimers()
  })
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec frontend npm test -- --run src/components/SearchProgress`
Expected: FAIL

- [ ] **Step 3: 実装**

```typescript
// message 指定時は固定メッセージ表示（補完中表示等に流用）。未指定時は3段階の演出
export function SearchProgress({ message }: { message?: string }) {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (message) return undefined
    const timers = STEPS.slice(1).map((step, i) =>
      setTimeout(() => setStepIndex(i + 1), step.delay),
    )
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [message])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.spinner} />
        <span className={styles.message}>{message ?? STEPS[stepIndex].message}</span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} role="progressbar" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `docker compose exec frontend npm test -- --run src/components/SearchProgress`
Expected: PASS（既存テスト含む）

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/SearchProgress
git commit -m "feat: SearchProgressに固定メッセージ表示のmessageプロパティを追加"
```

---

### Task 9: SearchPage の二段階検索フロー

**Files:**
- Modify: `frontend/src/pages/SearchPage/SearchPage.tsx`
- Test: `frontend/src/pages/SearchPage/SearchPage.test.tsx`

**Interfaces:**
- Consumes: `worksApi.search(..., { enrich: false })`（Task 7）、`<SearchProgress message>`（Task 8）
- Produces: なし（画面のみ）

- [ ] **Step 1: 失敗するテストを書く（SearchPage.test.tsx に追記）**

既存テストのモック方式に合わせること。`worksApi.search` のモックが2回呼ばれる想定のテスト:

```typescript
  it('二段階検索: 速報結果を即表示し、補完済み結果で差し替える', async () => {
    const quick = {
      results: [makeSearchResult({ title: '速報タイトル', description: 'English description.' })],
      enriched: false,
    }
    const full = {
      results: [makeSearchResult({ title: '速報タイトル', description: '日本語の説明。' })],
      enriched: true,
    }
    vi.mocked(worksApi.search)
      .mockResolvedValueOnce(quick)
      .mockResolvedValueOnce(full)

    renderSearchPage()
    await submitSearch('テスト')

    // ①速報が表示され、②の間は補完中メッセージが出る
    expect(await screen.findByText('速報タイトル')).toBeInTheDocument()
    // ②完了後、補完中メッセージが消え説明が差し替わる
    await waitFor(() => {
      expect(screen.queryByText('日本語の説明を取得中…')).not.toBeInTheDocument()
    })
    expect(worksApi.search).toHaveBeenCalledTimes(2)
    // 1回目は enrich: false、2回目は enrich 指定なし
    expect(vi.mocked(worksApi.search).mock.calls[0][2]).toMatchObject({ enrich: false })
  })

  it('速報が enriched: true（キャッシュヒット）なら2回目のリクエストをしない', async () => {
    vi.mocked(worksApi.search).mockResolvedValueOnce({
      results: [makeSearchResult({ title: 'キャッシュ済み' })],
      enriched: true,
    })

    renderSearchPage()
    await submitSearch('テスト')

    expect(await screen.findByText('キャッシュ済み')).toBeInTheDocument()
    expect(worksApi.search).toHaveBeenCalledTimes(1)
  })

  it('2回目のリクエストが失敗しても速報結果を表示し続けエラーを出さない', async () => {
    vi.mocked(worksApi.search)
      .mockResolvedValueOnce({
        results: [makeSearchResult({ title: '速報タイトル' })],
        enriched: false,
      })
      .mockRejectedValueOnce(new Error('network error'))

    renderSearchPage()
    await submitSearch('テスト')

    expect(await screen.findByText('速報タイトル')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('日本語の説明を取得中…')).not.toBeInTheDocument()
    })
    expect(screen.queryByText('検索に失敗しました')).not.toBeInTheDocument()
  })
```

```typescript
  it('補完待ちの間に新しい検索を開始すると古い補完結果を反映しない', async () => {
    // 1回目の検索: ②をpendingのまま保留する
    let resolveFull: (value: SearchResponse) => void = () => {}
    vi.mocked(worksApi.search)
      .mockResolvedValueOnce({
        results: [makeSearchResult({ title: '古い速報' })],
        enriched: false,
      })
      .mockImplementationOnce(
        (_q, _m, options) =>
          new Promise((resolve, reject) => {
            resolveFull = resolve
            // AbortSignal で中断されたら AbortError を投げる（実際の fetch と同じ挙動）
            options?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            )
          }),
      )
      // 2回目の検索: キャッシュヒットで1リクエスト完結
      .mockResolvedValueOnce({
        results: [makeSearchResult({ title: '新しい結果' })],
        enriched: true,
      })

    renderSearchPage()
    await submitSearch('古いクエリ')
    expect(await screen.findByText('古い速報')).toBeInTheDocument()

    await submitSearch('新しいクエリ')
    expect(await screen.findByText('新しい結果')).toBeInTheDocument()
    // 保留していた古い②が後から解決しても、画面は新しい結果のまま
    resolveFull({
      results: [makeSearchResult({ title: '古い補完済み' })],
      enriched: true,
    })
    await waitFor(() => {
      expect(screen.queryByText('古い補完済み')).not.toBeInTheDocument()
    })
  })
```

`makeSearchResult` / `renderSearchPage` / `submitSearch` 相当のヘルパーが既存テストにあればそれを使い、なければ既存テストのセットアップに合わせて書くこと。

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec frontend npm test -- --run src/pages/SearchPage`
Expected: 追記分が FAIL

- [ ] **Step 3: SearchPage を実装**

`handleSearch` と `handleGenreChange` の重複した検索ロジックを `runSearch` に共通化し、二段階フローにする。state に `isEnriching` を追加:

```typescript
  const [isEnriching, setIsEnriching] = useState(false)
```

```typescript
  // 二段階検索（ADR-0042）: ①enrich=false で速報を即表示 → ②補完済み結果で差し替え
  // フルキャッシュヒット時は①が enriched: true で返るため②を省略する
  const runSearch = async (searchQuery: string, searchGenre: GenreFilter) => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setResults([])
    setIsSearching(true)
    setIsEnriching(false)
    setError('')
    setHasSearched(true)

    const mediaType = searchGenre === 'all' ? undefined : searchGenre

    let quick: SearchResponse
    try {
      quick = await worksApi.search(searchQuery, mediaType, {
        signal: controller.signal,
        enrich: false,
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(err instanceof ApiError ? err.message : '検索に失敗しました')
      setIsSearching(false)
      return
    }
    if (controller.signal.aborted) return

    setResults(quick.results)
    setIsSearching(false)

    let finalResults = quick.results
    if (!quick.enriched) {
      setIsEnriching(true)
      try {
        const full = await worksApi.search(searchQuery, mediaType, { signal: controller.signal })
        if (!controller.signal.aborted) {
          setResults(full.results)
          finalResults = full.results
        }
      } catch {
        // ②の失敗は無視する（速報結果の表示を維持。補完なしでも機能は成立する）
      } finally {
        if (!controller.signal.aborted) {
          setIsEnriching(false)
        }
      }
      if (controller.signal.aborted) return
    }

    // クエリ本文は送らず長さのみ送る（プライバシー方針）。二段階でも送信は1回だけ
    captureEvent(ANALYTICS_EVENTS.SEARCH_PERFORMED, {
      query_length: searchQuery.length,
      genre_filter: searchGenre,
      result_count: finalResults.length,
    })
  }

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    void runSearch(query, genre)
  }

  const handleGenreChange = (newGenre: GenreFilter) => {
    setGenre(newGenre)
    if (query.trim() && hasSearched) {
      void runSearch(query, newGenre)
    }
  }
```

import に `SearchResponse` 型を追加する。JSX の補完中表示（結果一覧の直前に配置）:

```tsx
        {isEnriching && <SearchProgress message="日本語の説明を取得中…" />}
```

既存の `isSearching` 時の `<SearchProgress />`（3段階演出）はそのまま残す。

- [ ] **Step 4: テストがパスすることを確認**

Run: `docker compose exec frontend npm test -- --run src/pages/SearchPage`
Expected: PASS（既存テストが `search` 1回呼び出し前提で落ちる場合は、モックを `enriched: true` を返すよう修正すれば1リクエストで完結し通る）

- [ ] **Step 5: フロント全テスト＋lint**

Run: `docker compose exec frontend npm test -- --run && docker compose exec frontend npm run lint`
Expected: 全パス・違反0

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/SearchPage
git commit -m "feat: 検索を二段階レスポンス化し速報表示と補完差し替えを実装"
```

---

### Task 10: 全体検証と仕上げ

- [ ] **Step 1: バックエンド全テスト＋RuboCop**

Run: `docker compose exec backend bundle exec rspec && docker compose exec backend bundle exec rubocop`
Expected: 全パス・違反0

- [ ] **Step 2: フロント全テスト＋lint＋format**

Run: `docker compose exec frontend npm test -- --run && docker compose exec frontend npm run lint && docker compose exec frontend npx prettier --check src`
Expected: 全パス

- [ ] **Step 3: PR前セルフチェック**

`.claude/rules/pr-self-check.md` のチェックリストを確認する。特に:
- `work_search_service.rb` / `work_enrichment_service.rb` が200行以内か
- 定数化漏れ（マジックナンバー）がないか
- async関数を onClick / onSubmit に直接渡していないか（`void runSearch(...)` でラップ済みか）

- [ ] **Step 4: 動作確認（ユーザーに確認を取る）**

`.claude/rules/workflow.md` Step 5 に従い、AskUserQuestion で手動確認かPlaywright MCP自動確認かをユーザーに聞く。確認観点:
1. 新しいキーワードで検索 → 1〜2秒で結果が出る → 「日本語の説明を取得中…」表示 → 数秒後に説明が日本語に差し替わる
2. 同じキーワードで再検索 → 即座に補完済み結果（進行表示なし）
3. ジャンル変更・連続検索でエラーが出ない

- [ ] **Step 5: PR作成**

`superpowers:finishing-a-development-branch` スキルを使用。Git運用は `.claude/rules/git-rules.md` に従う（Merge commit・PRタイトルは `feat: 検索パフォーマンス改善v2（補完コスト削減＋二段階レスポンス）`）。PR本文に `Closes #189` を含める。

---

## 補足: 実装時の落とし穴

- **テスト環境のキャッシュは null_store**: キャッシュの挙動をテストするときは必ず MemoryStore に差し替える（Global Constraints 参照）。差し替えないと「常にキャッシュミス」の挙動になりテストが無意味になる
- **`Rails.cache` は nil を保存できない**: 「見つからなかった」は `NOT_FOUND` マーカー文字列で表現している。読み出し時のマーカー判定を忘れない
- **instance_spy は null object**: スタブしていないメソッド呼び出しは自分自身を返すため、`search_with_status` をスタブし忘れると意味不明なエラーになる（Task 6 参照）
- **raw キャッシュと full キャッシュの汚染**: `enrich=false` の結果を full キャッシュ（`work_search:v7:...`）に書き込まないこと。逆に raw キャッシュは補完前のデータ専用
- **AniList等のアダプター実装は変更しない**: 変更対象は `WorkSearchService` / `WorkEnrichmentService` / タイムアウト4ファイル / コントローラー / フロント3ファイルのみ
