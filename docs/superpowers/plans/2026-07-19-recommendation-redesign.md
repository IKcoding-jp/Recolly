# レコメンド再設計（精度向上＋ジャンル横断化）実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI呼び出しを一括生成（1回）に統合し、全メディアタブで記録0件でもジャンル横断のおすすめを表示できるようにする。あわせてOVA/特別篇混入・他メディア枠が空・「分析中…」放置の3バグを解消する。

**Architecture:** `PreferenceAnalyzer`が全記録から一括プロンプトを組み立ててSonnetを1回呼び、`RecommendationService`が結果を`Recommendation`（総合）と`MediaPreferenceProfile`（6メディア）に分配保存する。`WorkRecommender`は「検索最上位が既記録なら提案ごとスキップ」＋AniList formatフィルタで実在確認する。`MediaProfileRefreshJob`は廃止し`RecommendationRefreshJob`に一本化、多重起動は`Rails.cache`フラグで防止する。

**Tech Stack:** Rails 8 / RSpec / React 19 + TypeScript / Vitest / Anthropic Ruby SDK（claude-sonnet-5）

**Spec:** `docs/superpowers/specs/2026-07-19-recommendation-redesign-design.md` / Issue #224

## Global Constraints

- 1ファイル200行以内
- コメントは「なぜ」を日本語で書く。未使用コード・importを残さない
- マジックナンバー禁止（定数化）
- TDD厳格運用: テストを先に書き、失敗を確認してから実装する
- テスト実行: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec <path>` / `docker compose run --rm frontend npm test -- --run <path>`
- リンター: `docker compose run --rm backend bundle exec rubocop` / `docker compose run --rm frontend npm run lint`
- コミットメッセージはConventional Commits（日本語）
- コミット末尾に以下を付ける:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01AAcdSiKHHqXbVsKtEvvqaM
  ```

---

### Task 1: AnilistAdapterのmetadataにformatを追加

**Files:**
- Modify: `backend/app/services/external_apis/anilist_adapter.rb`（`build_metadata`）
- Modify: `backend/app/services/work_search_service.rb`（`CACHE_VERSION`）
- Test: `backend/spec/services/external_apis/anilist_adapter_spec.rb`

**Interfaces:**
- Produces: `SearchResult#metadata[:format]`（AniListのformat文字列。例: `'TV'`, `'SPECIAL'`。Task 4のformatフィルタが参照する）

- [ ] **Step 1: 失敗するテストを書く**

`anilist_adapter_spec.rb`の`describe '#search'`ブロック内（`popularity`のテストの後）に追加:

```ruby
it 'format をmetadataに含める' do
  results = adapter.search('進撃の巨人')
  anime = results.find { |r| r.media_type == 'anime' }
  expect(anime.metadata[:format]).to eq('TV')
end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/external_apis/anilist_adapter_spec.rb`
Expected: FAIL（`metadata[:format]`がnil）

- [ ] **Step 3: 実装**

`anilist_adapter.rb`の`build_metadata`に`format`を追加:

```ruby
    def build_metadata(item)
      {
        genres: item['genres'],
        status: item['status'],
        format: item['format'],
        season_year: item['seasonYear'],
        popularity: normalize_popularity(item['popularity']),
        title_english: item.dig('title', 'english'),
        title_romaji: item.dig('title', 'romaji')
      }.compact
    end
```

`work_search_service.rb`のキャッシュバージョンを更新（metadataの形が変わったため）:

```ruby
  # 実装変更時にインクリメントしてキャッシュを無効化する
  # v13: AniList metadataにformatを追加（v12以前の履歴はgit参照）
  CACHE_VERSION = 'v13'
```

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/external_apis/anilist_adapter_spec.rb spec/services/work_search_service_spec.rb`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/external_apis/anilist_adapter.rb backend/app/services/work_search_service.rb backend/spec/services/external_apis/anilist_adapter_spec.rb
git commit -m "feat: AniList検索結果のmetadataにformatを追加"
```

---

### Task 2: PreferencePromptBuilderを一括生成プロンプトに書き換え

**Files:**
- Rewrite: `backend/app/services/preference_prompt_builder.rb`
- Test: `backend/spec/services/preference_prompt_builder_spec.rb`（新規）

**Interfaces:**
- Consumes: `PreferenceAnalyzer#collect_data`の戻り値＋`recorded_titles`キー（Task 3で追加。`["タイトル (media_type)", ...]`形式の配列）
- Produces: `#build` → String（プロンプト）。AIの出力JSONは `{ "summary", "preference_scores", "media_recommendations": { "<media_type>": { "trend", "works": [{ "query", "reason" }] } } }` 形式。定数`PROPOSALS_PER_MEDIA = 8`

- [ ] **Step 1: 失敗するテストを書く**

`backend/spec/services/preference_prompt_builder_spec.rb`を新規作成:

```ruby
require 'rails_helper'

RSpec.describe PreferencePromptBuilder do
  let(:data) do
    {
      genre_stats: [{ media_type: 'anime', count: 10, avg_rating: 8.5 }],
      top_rated: [{ title: '葬送のフリーレン', media_type: 'anime', rating: 9, genres: ['Fantasy'] }],
      dropped: [],
      tag_stats: [],
      review_excerpts: [],
      favorites: [],
      recorded_titles: ['葬送のフリーレン (anime)', 'STEINS;GATE (anime)']
    }
  end

  describe '#build' do
    it '全6メディアの出力指示を含む' do
      prompt = described_class.new(data).build
      %w[anime movie drama book manga game].each do |media_type|
        expect(prompt).to include(%("#{media_type}":))
      end
    end

    it '記録済みタイトル一覧と派生作品の除外指示を含む' do
      prompt = described_class.new(data).build
      expect(prompt).to include('記録済みの全作品')
      expect(prompt).to include('STEINS;GATE (anime)')
      expect(prompt).to include('派生作品')
    end

    it '各メディア8件の提案指示を含む' do
      prompt = described_class.new(data).build
      expect(prompt).to include("#{described_class::PROPOSALS_PER_MEDIA}件")
    end

    it '記録が無いメディアも推定して提案する指示を含む' do
      prompt = described_class.new(data).build
      expect(prompt).to include('記録が無いメディア')
    end

    it 'trendとworksの出力形式を含む' do
      prompt = described_class.new(data).build
      expect(prompt).to include('"trend"')
      expect(prompt).to include('"media_recommendations"')
    end

    it '記録済みタイトルが空でもエラーにならない' do
      prompt = described_class.new(data.merge(recorded_titles: [])).build
      expect(prompt).not_to include('記録済みの全作品')
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/preference_prompt_builder_spec.rb`
Expected: FAIL（`media_recommendations`等が含まれない）

- [ ] **Step 3: 実装（全面書き換え）**

`preference_prompt_builder.rb`を以下に置き換え:

```ruby
# Claude APIに送る一括好み分析プロンプトを組み立てる
# 総合分析と全6メディア分のおすすめを1回の呼び出しで出力させる（一括生成方式）
class PreferencePromptBuilder
  MEDIA_TYPE_JA = {
    'anime' => 'アニメ',
    'movie' => '映画',
    'drama' => 'ドラマ',
    'book' => '本',
    'manga' => '漫画・ラノベ',
    'game' => 'ゲーム'
  }.freeze

  # 検索での実在確認で落ちる分の保険として、採用数（5件）より多めに提案させる
  PROPOSALS_PER_MEDIA = 8

  def initialize(data)
    @data = data
  end

  def build
    collect_sections.join("\n")
  end

  private

  def collect_sections
    optional = {
      dropped: :dropped_section,
      tag_stats: :tags_section,
      review_excerpts: :reviews_section,
      favorites: :favorites_section,
      recorded_titles: :recorded_titles_section
    }
    extras = optional.filter_map { |key, method| send(method) if @data[key].any? }
    [base_section, *extras, output_instructions]
  end

  def base_section
    genre_lines = @data[:genre_stats].map { |s| "#{s[:media_type]}: #{s[:count]}件, 平均#{s[:avg_rating]}点" }
    top_lines = @data[:top_rated].map do |w|
      "#{w[:title]} (#{w[:media_type]}, #{w[:rating]}点, ジャンル: #{w[:genres].join(', ')})"
    end

    <<~PROMPT
      あなたはメディア作品のレコメンドアナリストです。
      以下のユーザーの視聴・閲覧記録データを分析してください。

      ■ ジャンル別統計:
      #{genre_lines.join("\n")}

      ■ 高評価作品TOP10:
      #{top_lines.join("\n")}
    PROMPT
  end

  def dropped_section
    lines = @data[:dropped].map { |w| "#{w[:title]} (#{w[:media_type]}, #{w[:rating]}点)" }
    <<~SECTION
      ■ 断念した作品:
      #{lines.join("\n")}
    SECTION
  end

  def tags_section
    lines = @data[:tag_stats].map { |t| "#{t[:name]} (#{t[:count]}回使用, 平均#{t[:avg_rating]}点)" }
    <<~SECTION
      ■ よく使うタグ:
      #{lines.join("\n")}
    SECTION
  end

  def reviews_section
    lines = @data[:review_excerpts].map { |r| "「#{r}」" }
    <<~SECTION
      ■ 感想テキスト抜粋:
      #{lines.join("\n")}
    SECTION
  end

  def favorites_section
    lines = @data[:favorites].map { |f| "#{f[:title]} (#{f[:media_type]}, ジャンル: #{f[:genres].join(', ')})" }
    <<~SECTION
      ■ お気に入り作品:
      #{lines.join("\n")}
    SECTION
  end

  def recorded_titles_section
    <<~SECTION
      ■ 記録済みの全作品（おすすめから除外すること）:
      #{@data[:recorded_titles].join(' / ')}
    SECTION
  end

  def output_instructions
    "#{json_format_instruction}\n#{rules}"
  end

  def json_format_instruction
    media_entries = MEDIA_TYPE_JA.map do |key, ja|
      %(    "#{key}": { "trend": "#{ja}での傾向・推薦方針（1〜2文）", "works": [{ "query": "実在する#{ja}作品タイトル1つ", "reason": "おすすめ理由" }] })
    end.join(",\n")

    <<~INSTRUCTIONS
      以下をJSON形式で出力してください。

      {
        "summary": "好み傾向の分析（200字程度）。ジャンルを横断した共通パターンを見つけ、具体的な作品名や感想を引用。定型的な表現を避けること。",
        "preference_scores": [
          { "label": "嗜好の軸名", "score": 1.0〜10.0 }
        ],
        "media_recommendations": {
      #{media_entries}
        }
      }
    INSTRUCTIONS
  end

  def rules
    <<~RULES
      重要なルール:
      - preference_scoresは5項目
      - media_recommendationsは全6メディア（#{MEDIA_TYPE_JA.keys.join(', ')}）を必ず含める
      - 各メディアのworksは#{PROPOSALS_PER_MEDIA}件。queryは実在する作品タイトルを1つだけ指定すること
      - 記録が無いメディアも、他メディアの記録から好みを推定して提案すること（trendにその推定根拠を書く）
      - 記録済み作品と、その派生作品（OVA・特別篇・劇場版総集編・CM・スピンオフ短編）は提案しないこと
      - reasonは各作品ごとに異なる内容にし、ユーザーの具体的な作品名・評価を引用すること
      - JSONのみ出力し、それ以外のテキストは含めないでください
    RULES
  end
end
```

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/preference_prompt_builder_spec.rb`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/preference_prompt_builder.rb backend/spec/services/preference_prompt_builder_spec.rb
git commit -m "feat: 好み分析プロンプトを全メディア一括生成形式に書き換え"
```

※この時点で`preference_analyzer_spec.rb`の`#analyze`テストは旧形式のままFAILする（Task 3で解消）。コミットはビルダー単体のGreenで行う。

---

### Task 3: PreferenceAnalyzerをSonnet化・一括レスポンス対応

**Files:**
- Modify: `backend/app/services/preference_analyzer.rb`
- Test: `backend/spec/services/preference_analyzer_spec.rb`

**Interfaces:**
- Consumes: `PreferencePromptBuilder`（Task 2）
- Produces: `#analyze` → `{ summary:, preference_scores:, media_recommendations:, genre_stats:, top_tags: }` または `nil`。`media_recommendations`は文字列キーのHash（`{ 'anime' => { 'trend' => String, 'works' => [{ 'query' =>, 'reason' => }] } }`）。`#collect_data`に`recorded_titles`キーが増える。定数`MINIMUM_RECORDS = 5`は維持

- [ ] **Step 1: 失敗するテストを書く**

`preference_analyzer_spec.rb`を更新する。

(1) `#collect_data`のdescribeに追加:

```ruby
      it '記録済みタイトル一覧を返す' do
        data = described_class.new(user).collect_data
        expect(data[:recorded_titles]).to include('作品A (anime)')
      end
```

※このitは「記録が複数ある場合」contextの中に置く。

(2) `#analyze`のdescribe内、`mock_api_response`を新形式に置き換え:

```ruby
    let(:mock_api_response) do
      {
        'summary' => 'テスト分析サマリー',
        'preference_scores' => [{ 'label' => 'キャラクター重視', 'score' => 9.2 }],
        'media_recommendations' => {
          'anime' => { 'trend' => 'ファンタジー重視の傾向', 'works' => [{ 'query' => '葬送のフリーレン', 'reason' => '作品0に9点をつけたあなたへ。' }] },
          'movie' => { 'trend' => 'アニメの好みから推定', 'works' => [{ 'query' => 'インセプション', 'reason' => '構造の凝った物語が好きなあなたへ。' }] }
        }
      }
    end
```

(3) 既存の「Claude APIを呼び出して分析結果を返す」itの検証部を新形式に変更:

```ruby
      result = described_class.new(user).analyze
      expect(result[:summary]).to eq('テスト分析サマリー')
      expect(result[:preference_scores].first['label']).to eq('キャラクター重視')
      expect(result[:media_recommendations]['anime']['works']).not_to be_empty
```

(4) `#analyze`のdescribeに以下のitを追加（モデル指定とリトライの検証）:

```ruby
    it 'claude-sonnet-5を使用する' do
      text_block = double('TextBlock', text: mock_api_response.to_json) # rubocop:disable RSpec/VerifiedDoubles
      message = double('Message', content: [text_block]) # rubocop:disable RSpec/VerifiedDoubles
      messages_resource = double('Messages') # rubocop:disable RSpec/VerifiedDoubles
      client_double = double('Anthropic::Client', messages: messages_resource) # rubocop:disable RSpec/VerifiedDoubles
      allow(Anthropic::Client).to receive(:new).and_return(client_double)
      allow(messages_resource).to receive(:create).and_return(message)

      described_class.new(user).analyze
      expect(messages_resource).to have_received(:create)
        .with(hash_including(model: 'claude-sonnet-5'))
    end

    it 'JSON解析に失敗したら1回だけ再試行する' do
      bad_block = double('TextBlock', text: '不正なJSON') # rubocop:disable RSpec/VerifiedDoubles
      good_block = double('TextBlock', text: mock_api_response.to_json) # rubocop:disable RSpec/VerifiedDoubles
      bad_message = double('Message', content: [bad_block]) # rubocop:disable RSpec/VerifiedDoubles
      good_message = double('Message', content: [good_block]) # rubocop:disable RSpec/VerifiedDoubles
      messages_resource = double('Messages') # rubocop:disable RSpec/VerifiedDoubles
      client_double = double('Anthropic::Client', messages: messages_resource) # rubocop:disable RSpec/VerifiedDoubles
      allow(Anthropic::Client).to receive(:new).and_return(client_double)
      allow(messages_resource).to receive(:create).and_return(bad_message, good_message)

      result = described_class.new(user).analyze
      expect(result[:summary]).to eq('テスト分析サマリー')
      expect(messages_resource).to have_received(:create).twice
    end
```

※既存の「JSON解析に失敗したらnilを返す」itはそのまま残す（2回とも失敗→nilの検証になる）。

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/preference_analyzer_spec.rb`
Expected: FAIL（`media_recommendations`がnil、モデル名不一致、リトライ未実装）

- [ ] **Step 3: 実装**

`preference_analyzer.rb`を変更する。

(1) 定数を追加・変更（クラス先頭）:

```ruby
class PreferenceAnalyzer
  MINIMUM_RECORDS = 5
  MAX_TOP_RATED = 10
  MAX_DROPPED = 5
  MAX_REVIEW_EXCERPTS = 20
  MAX_EXCERPT_LENGTH = 100
  # プロンプト肥大を防ぐため、除外指示に載せる記録済みタイトル数の上限
  MAX_RECORDED_TITLES = 200
  MODEL = 'claude-sonnet-5'.freeze
  MAX_TOKENS = 8192
```

(2) `collect_data`に`recorded_titles`を追加:

```ruby
  def collect_data
    {
      genre_stats: genre_stats,
      top_rated: top_rated_works,
      dropped: dropped_works,
      tag_stats: tag_stats,
      review_excerpts: review_excerpts,
      favorites: favorite_works,
      recorded_titles: recorded_titles
    }
  end
```

(3) `analyze`をリトライ付きに変更:

```ruby
  def analyze
    return nil if @records.count < MINIMUM_RECORDS

    data = collect_data
    # 一括出力はJSONが大きく崩れやすいため、パース失敗時に1回だけ再生成を試みる
    parse_response(call_claude_api(data), data) || parse_response(call_claude_api(data), data)
  end
```

(4) privateに`recorded_titles`を追加:

```ruby
  def recorded_titles
    @records.limit(MAX_RECORDED_TITLES).map { |r| "#{r.work.title} (#{r.work.media_type})" }
  end
```

(5) `call_claude_api`を定数参照に変更:

```ruby
  def call_claude_api(data)
    client = Anthropic::Client.new(api_key: ENV.fetch('ANTHROPIC_API_KEY'))
    prompt = PreferencePromptBuilder.new(data).build
    client.messages.create(
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }]
    )
  end
```

(6) `parse_response`を新形式に変更:

```ruby
  def parse_response(response, data)
    text = response.content[0].text.strip
    # LLMが```json...```で囲む場合があるので除去
    text = text.sub(/\A```json\s*\n?/, '').sub(/\n?```\s*\z/, '')
    parsed = JSON.parse(text)

    {
      summary: parsed['summary'],
      preference_scores: parsed['preference_scores'] || [],
      media_recommendations: parsed['media_recommendations'] || {},
      genre_stats: data[:genre_stats],
      top_tags: data[:tag_stats]
    }
  rescue JSON::ParserError => e
    Rails.logger.error("[PreferenceAnalyzer] JSON解析エラー: #{e.message}")
    nil
  end
```

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/preference_analyzer_spec.rb`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/preference_analyzer.rb backend/spec/services/preference_analyzer_spec.rb
git commit -m "feat: 好み分析をSonnet化し一括レスポンス形式・リトライに対応"
```

---

### Task 4: WorkRecommenderをメディア単位API＋formatフィルタ＋既記録スキップに書き換え

**Files:**
- Rewrite: `backend/app/services/work_recommender.rb`
- Test: `backend/spec/services/work_recommender_spec.rb`（書き換え）

**Interfaces:**
- Consumes: `WorkSearchService#search(query, media_type:)`、`SearchResult#metadata[:format]`（Task 1）
- Produces: `WorkRecommender.new(user)`＋`#recommend(media_type, keywords, max_count: 5)` → `[{ title:, media_type:, description:, cover_url:, reason:, external_api_id:, external_api_source:, metadata: }]`。定数`MAX_ADOPTED = 5`、`EXCLUDED_ANILIST_FORMATS = %w[SPECIAL OVA MUSIC TV_SHORT]`

- [ ] **Step 1: 失敗するテストを書く**

`work_recommender_spec.rb`を以下に全面置き換え:

```ruby
require 'rails_helper'

RSpec.describe WorkRecommender do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  let(:keywords) do
    [
      { 'query' => '葬送のフリーレン', 'reason' => '作品Aに9点をつけたあなたへ。' },
      { 'query' => 'ぼっち・ざ・ろっく！', 'reason' => '日常系が好きなあなたへ。' }
    ]
  end

  def build_result(title:, external_api_id:, format: 'TV', source: 'anilist')
    Struct.new(:title, :media_type, :description, :cover_image_url,
               :external_api_id, :external_api_source, :metadata)
          .new(
            title: title,
            media_type: 'anime',
            description: 'テスト説明',
            cover_image_url: 'https://example.com/cover.jpg',
            external_api_id: external_api_id,
            external_api_source: source,
            metadata: { format: format, popularity: 0.5 }
          )
  end

  describe '#recommend' do
    it '提案キーワードごとに検索最上位を採用する' do
      allow_any_instance_of(WorkSearchService).to receive(:search).and_return( # rubocop:disable RSpec/AnyInstance
        [build_result(title: '葬送のフリーレン', external_api_id: '1')],
        [build_result(title: 'ぼっち・ざ・ろっく！', external_api_id: '2')]
      )

      results = described_class.new(user).recommend('anime', keywords)
      expect(results.length).to eq(2)
      expect(results.first[:reason]).to include('9点')
      expect(results.first).to include(:title, :media_type, :description, :cover_url,
                                       :reason, :external_api_id, :external_api_source, :metadata)
    end

    it '最上位が既記録なら派生作品へ繰り下げず提案自体をスキップする' do
      work = Work.create!(title: '葬送のフリーレン', media_type: 'anime',
                          external_api_id: '1', external_api_source: 'anilist')
      user.records.create!(work: work, status: :completed)

      allow_any_instance_of(WorkSearchService).to receive(:search).and_return( # rubocop:disable RSpec/AnyInstance
        [build_result(title: '葬送のフリーレン', external_api_id: '1'),
         build_result(title: '葬送のフリーレン 特別篇', external_api_id: '99')],
        [build_result(title: 'ぼっち・ざ・ろっく！', external_api_id: '2')]
      )

      results = described_class.new(user).recommend('anime', keywords)
      titles = results.pluck(:title)
      expect(titles).not_to include('葬送のフリーレン 特別篇')
      expect(titles).to include('ぼっち・ざ・ろっく！')
    end

    it 'SPECIAL/OVA/MUSIC/TV_SHORTのAniList作品を採用しない' do
      allow_any_instance_of(WorkSearchService).to receive(:search).and_return( # rubocop:disable RSpec/AnyInstance
        [build_result(title: '葬送のフリーレン 特別篇', external_api_id: '99', format: 'SPECIAL'),
         build_result(title: '葬送のフリーレン', external_api_id: '1', format: 'TV')],
        []
      )

      results = described_class.new(user).recommend('anime', keywords)
      expect(results.pluck(:title)).to eq(['葬送のフリーレン'])
    end

    it 'AniList以外のソースはformatフィルタの対象外' do
      tmdb_result = build_result(title: '君の名前で僕を呼んで', external_api_id: '5', source: 'tmdb')

      allow_any_instance_of(WorkSearchService).to receive(:search).and_return([tmdb_result], []) # rubocop:disable RSpec/AnyInstance

      results = described_class.new(user).recommend('movie', keywords)
      expect(results.pluck(:title)).to include('君の名前で僕を呼んで')
    end

    it 'max_countに達したら残りの提案を処理しない' do
      allow_any_instance_of(WorkSearchService).to receive(:search).and_return( # rubocop:disable RSpec/AnyInstance
        [build_result(title: '葬送のフリーレン', external_api_id: '1')],
        [build_result(title: 'ぼっち・ざ・ろっく！', external_api_id: '2')]
      )

      results = described_class.new(user).recommend('anime', keywords, max_count: 1)
      expect(results.length).to eq(1)
    end

    it '同じタイトルの重複を採用しない' do
      allow_any_instance_of(WorkSearchService).to receive(:search).and_return( # rubocop:disable RSpec/AnyInstance
        [build_result(title: '同じ作品', external_api_id: '1')],
        [build_result(title: '同じ作品', external_api_id: '1')]
      )

      results = described_class.new(user).recommend('anime', keywords)
      expect(results.length).to eq(1)
    end

    it '検索結果が空の提案はスキップする' do
      allow_any_instance_of(WorkSearchService).to receive(:search).and_return( # rubocop:disable RSpec/AnyInstance
        [],
        [build_result(title: 'ぼっち・ざ・ろっく！', external_api_id: '2')]
      )

      results = described_class.new(user).recommend('anime', keywords)
      expect(results.pluck(:title)).to eq(['ぼっち・ざ・ろっく！'])
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/work_recommender_spec.rb`
Expected: FAIL（`#recommend`の引数が旧形式）

- [ ] **Step 3: 実装（全面書き換え）**

`work_recommender.rb`を以下に置き換え:

```ruby
# 好み分析の提案キーワードを外部API検索で実在確認し、採用作品リストを作る
class WorkRecommender
  MAX_ADOPTED = 5
  # 本編ではない派生作品（特別篇・OVA等）はおすすめに採用しない
  EXCLUDED_ANILIST_FORMATS = %w[SPECIAL OVA MUSIC TV_SHORT].freeze

  def initialize(user)
    @user = user
    @search_service = WorkSearchService.new
    @recorded_external_ids = fetch_recorded_external_ids
  end

  # keywords: [{ 'query' => 作品タイトル, 'reason' => 理由 }, ...]
  # 提案順に実在確認し、採用数がmax_countに達したら打ち切る
  def recommend(media_type, keywords, max_count: MAX_ADOPTED)
    results = []
    keywords.each do |keyword|
      break if results.length >= max_count

      work = best_candidate(keyword['query'], media_type, results)
      next if work.nil?

      results << build_work_data(work, keyword['reason'] || '')
    end
    results
  end

  private

  # 検索最上位（本編想定）が既記録なら派生作品へ繰り下げず、その提案自体を見送る
  # （繰り下げると本編を記録済みのユーザーほどOVA・特別篇がおすすめされてしまうため）
  def best_candidate(query, media_type, existing_results)
    return nil if query.blank?

    candidates = @search_service.search(query, media_type: media_type)
                                .reject { |work| excluded_format?(work) }
    best = candidates.first
    return nil if best.nil? || already_recorded?(best)
    return nil if existing_results.any? { |r| r[:title] == best.title }

    best
  end

  def excluded_format?(work)
    work.external_api_source == 'anilist' &&
      EXCLUDED_ANILIST_FORMATS.include?(work.metadata[:format])
  end

  def build_work_data(work, reason)
    {
      title: work.title,
      media_type: work.media_type,
      description: work.description,
      cover_url: work.cover_image_url,
      reason: reason,
      external_api_id: work.external_api_id,
      external_api_source: work.external_api_source,
      metadata: work.metadata || {}
    }
  end

  def already_recorded?(work)
    return false if work.external_api_id.blank?

    key = "#{work.external_api_source}:#{work.external_api_id}"
    @recorded_external_ids.include?(key)
  end

  def fetch_recorded_external_ids
    @user.records.joins(:work)
         .where.not(works: { external_api_id: nil })
         .pluck('works.external_api_source', 'works.external_api_id')
         .to_set { |source, id| "#{source}:#{id}" }
  end
end
```

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/work_recommender_spec.rb`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/work_recommender.rb backend/spec/services/work_recommender_spec.rb
git commit -m "feat: WorkRecommenderにformatフィルタと既記録スキップを導入"
```

※この時点で`RecommendationService`と`MediaPreferenceAnalyzer`は旧`WorkRecommender` APIを呼んでいるため関連specがFAILする（Task 5で解消）。

---

### Task 5: RecommendationServiceを分配保存に書き換え＋MediaPreferenceAnalyzer削除

**Files:**
- Rewrite: `backend/app/services/recommendation_service.rb`
- Delete: `backend/app/services/media_preference_analyzer.rb`、`backend/app/services/media_preference_prompt_builder.rb`
- Delete: `backend/spec/services/media_preference_analyzer_spec.rb`・`backend/spec/services/media_preference_prompt_builder_spec.rb`（存在すれば）
- Test: `backend/spec/services/recommendation_service_spec.rb`（書き換え）

**Interfaces:**
- Consumes: `PreferenceAnalyzer#analyze`（Task 3）、`WorkRecommender#recommend(media_type, keywords)`（Task 4）
- Produces: `#generate` → `Recommendation`（総合を保存し、`MediaPreferenceProfile`6行も同一トランザクションで保存）。`#fetch`は現状維持。`needs_refresh?`と`REFRESH_THRESHOLD`は削除（未使用のため）

- [ ] **Step 1: 失敗するテストを書く**

`recommendation_service_spec.rb`を以下に全面置き換え:

```ruby
require 'rails_helper'

RSpec.describe RecommendationService do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  let(:mock_analysis) do
    {
      summary: 'テスト分析',
      preference_scores: [{ 'label' => 'テスト', 'score' => 8.0 }],
      media_recommendations: {
        'anime' => { 'trend' => 'ファンタジー重視',
                     'works' => [{ 'query' => '作品A', 'reason' => '理由A' }] },
        'movie' => { 'trend' => 'アニメの好みから推定',
                     'works' => [{ 'query' => '作品B', 'reason' => '理由B' }] }
      },
      genre_stats: [{ media_type: 'anime', count: 10, avg_rating: 8.0 }],
      top_tags: [{ name: '名作', count: 5 }]
    }
  end

  let(:mock_works) do
    [{ title: '作品A', media_type: 'anime', reason: '理由A' }]
  end

  before do
    allow_any_instance_of(PreferenceAnalyzer).to receive(:analyze).and_return(mock_analysis) # rubocop:disable RSpec/AnyInstance
    allow_any_instance_of(WorkRecommender).to receive(:recommend).and_return(mock_works) # rubocop:disable RSpec/AnyInstance
  end

  describe '#generate' do
    it '新規にRecommendationを作成する' do
      expect { described_class.new(user).generate }.to change(Recommendation, :count).by(1)
    end

    it '総合の分析結果を保存する' do
      result = described_class.new(user).generate
      expect(result.analysis_summary).to eq('テスト分析')
      expect(result.genre_stats.first['media_type']).to eq('anime')
    end

    it '全6メディアのMediaPreferenceProfileを保存する' do
      expect { described_class.new(user).generate }.to change(MediaPreferenceProfile, :count).by(6)
    end

    it 'メディア別プロファイルにtrendと採用作品を保存する' do
      described_class.new(user).generate
      profile = user.media_preference_profiles.find_by(media_type: 'anime')
      expect(profile.analysis_summary).to eq('ファンタジー重視')
      expect(profile.same_media_works.first['title']).to eq('作品A')
    end

    it '分析結果に無いメディアも空のプロファイルを保存する' do
      described_class.new(user).generate
      profile = user.media_preference_profiles.find_by(media_type: 'game')
      expect(profile).not_to be_nil
      expect(profile.same_media_works).to eq([])
    end

    it 'メディア別の記録件数を保存する' do
      work = Work.create!(title: 'アニメ作品', media_type: 'anime')
      user.records.create!(work: work, status: :completed, rating: 8)

      described_class.new(user).generate
      profile = user.media_preference_profiles.find_by(media_type: 'anime')
      expect(profile.record_count).to eq(1)
    end

    it '既存のRecommendationとプロファイルを更新する' do
      Recommendation.create!(user: user, analysis_summary: '古い分析', analyzed_at: 1.day.ago)
      MediaPreferenceProfile.create!(user: user, media_type: 'anime',
                                     analysis_summary: '古い傾向', analyzed_at: 1.day.ago)

      expect { described_class.new(user).generate }.not_to change(Recommendation, :count)
      expect(user.recommendation.reload.analysis_summary).to eq('テスト分析')
      expect(user.media_preference_profiles.find_by(media_type: 'anime')
                 .analysis_summary).to eq('ファンタジー重視')
    end

    it 'PreferenceAnalyzerがnilを返す場合はnilを返し何も保存しない' do
      allow_any_instance_of(PreferenceAnalyzer).to receive(:analyze).and_return(nil) # rubocop:disable RSpec/AnyInstance

      expect(described_class.new(user).generate).to be_nil
      expect(Recommendation.count).to eq(0)
      expect(MediaPreferenceProfile.count).to eq(0)
    end
  end

  describe '#fetch' do
    it 'DBに結果があればそれを返す' do
      Recommendation.create!(user: user, analysis_summary: 'キャッシュ済み', analyzed_at: Time.current)
      expect(described_class.new(user).fetch.analysis_summary).to eq('キャッシュ済み')
    end

    it 'DBに結果がなければnilを返す' do
      expect(described_class.new(user).fetch).to be_nil
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/recommendation_service_spec.rb`
Expected: FAIL（旧実装は`search_keywords`前提）

- [ ] **Step 3: 実装（全面書き換え）**

`recommendation_service.rb`を以下に置き換え:

```ruby
# おすすめ機能の全体調整役
# 一括分析の結果を総合（Recommendation）とメディア別（MediaPreferenceProfile）に分配保存する
class RecommendationService
  def initialize(user)
    @user = user
  end

  def fetch
    @user.recommendation
  end

  def generate
    analysis = PreferenceAnalyzer.new(@user).analyze
    return nil if analysis.nil?

    save_result(analysis, build_media_results(analysis))
  end

  private

  def build_media_results(analysis)
    recommender = WorkRecommender.new(@user)
    Work.media_types.keys.index_with do |media_type|
      media_rec = (analysis[:media_recommendations] || {})[media_type] || {}
      {
        trend: media_rec['trend'].to_s,
        works: recommender.recommend(media_type, media_rec['works'] || [])
      }
    end
  end

  # 総合とメディア別の表示が食い違わないよう、同一トランザクションで保存する
  def save_result(analysis, media_results)
    counts = media_record_counts
    analyzed_at = Time.current
    recommendation = Recommendation.find_or_initialize_by(user: @user)

    ActiveRecord::Base.transaction do
      recommendation.update!(recommendation_attributes(analysis, analyzed_at))
      media_results.each do |media_type, result|
        save_media_profile(media_type, result, counts, analyzed_at)
      end
    end
    recommendation
  end

  def recommendation_attributes(analysis, analyzed_at)
    {
      analysis_summary: analysis[:summary],
      preference_scores: analysis[:preference_scores],
      genre_stats: stringify_keys_in_array(analysis[:genre_stats]),
      top_tags: stringify_keys_in_array(analysis[:top_tags]),
      record_count: @user.records.count,
      analyzed_at: analyzed_at
    }
  end

  def save_media_profile(media_type, result, counts, analyzed_at)
    profile = MediaPreferenceProfile.find_or_initialize_by(user: @user, media_type: media_type)
    profile.update!(
      analysis_summary: result[:trend],
      same_media_works: stringify_keys_in_array(result[:works]),
      record_count: counts[media_type] || 0,
      analyzed_at: analyzed_at
    )
  end

  def media_record_counts
    @user.records.joins(:work).group('works.media_type').count
         .transform_keys { |k| Work.media_types.key(k) }
  end

  def stringify_keys_in_array(array)
    (array || []).map { |item| item.transform_keys(&:to_s) }
  end
end
```

あわせて以下を削除する:

```bash
rm backend/app/services/media_preference_analyzer.rb
rm backend/app/services/media_preference_prompt_builder.rb
```

`backend/spec/services/`配下に`media_preference_analyzer_spec.rb`・`media_preference_prompt_builder_spec.rb`があればそれも削除する。

※`MediaPreferenceAnalyzer::MINIMUM_RECORDS`を参照しているコントローラーはTask 7〜8で更新するため、この時点ではコントローラー関連specがFAILする。サービス層のspecがGreenならコミットしてよい。

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/`
Expected: サービス層は全てPASS

- [ ] **Step 5: コミット**

```bash
git add -A backend/app/services backend/spec/services
git commit -m "feat: 一括分析結果を総合とメディア別に分配保存する方式へ変更"
```

---

### Task 6: RecommendationRefreshJobにenqueue_once追加＋MediaProfileRefreshJob削除

**Files:**
- Modify: `backend/app/jobs/recommendation_refresh_job.rb`
- Delete: `backend/app/jobs/media_profile_refresh_job.rb`
- Test: `backend/spec/jobs/recommendation_refresh_job_spec.rb`（追記）、`backend/spec/jobs/media_profile_refresh_job_spec.rb`（存在すれば削除）

**Interfaces:**
- Produces: `RecommendationRefreshJob.enqueue_once(user_id)`（`Rails.cache`のフラグ`recommendation_refresh_enqueued:<user_id>`・TTL 10分で多重起動を防止）。`perform`完了時（成功・失敗とも）にフラグを削除する。Task 7〜8のコントローラーが使用する

- [ ] **Step 1: 失敗するテストを書く**

`recommendation_refresh_job_spec.rb`に以下のdescribeを追加（既存テストは残す。既存テストが`MediaProfileRefreshJob`や旧`RecommendationService`のIFを参照していれば新IFに合わせて修正する）:

```ruby
  describe '.enqueue_once' do
    around do |example|
      original_cache = Rails.cache
      Rails.cache = ActiveSupport::Cache::MemoryStore.new
      example.run
    ensure
      Rails.cache = original_cache
    end

    it 'フラグが無ければジョブをエンキューする' do
      expect { described_class.enqueue_once(1) }.to have_enqueued_job(described_class).with(1)
    end

    it 'フラグが立っている間は再エンキューしない' do
      described_class.enqueue_once(1)
      expect { described_class.enqueue_once(1) }.not_to have_enqueued_job(described_class)
    end

    it 'perform完了後はフラグが消え再エンキューできる' do
      user = User.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
      allow_any_instance_of(RecommendationService).to receive(:generate).and_return(nil) # rubocop:disable RSpec/AnyInstance

      described_class.enqueue_once(user.id)
      described_class.perform_now(user.id)
      expect { described_class.enqueue_once(user.id) }.to have_enqueued_job(described_class)
    end
  end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/jobs/recommendation_refresh_job_spec.rb`
Expected: FAIL（`enqueue_once`未定義）

- [ ] **Step 3: 実装**

`recommendation_refresh_job.rb`を以下に置き換え:

```ruby
# おすすめ分析の非同期更新ジョブ（総合＋メディア別を一括で生成する）
class RecommendationRefreshJob < ApplicationJob
  queue_as :default

  # 多重起動防止フラグの有効期限。分析1回の所要時間より十分長くする
  ENQUEUE_FLAG_TTL = 10.minutes

  # フラグが立っている間は再エンキューしない（コントローラーからはこちらを使う）
  def self.enqueue_once(user_id)
    key = enqueue_flag_key(user_id)
    return if Rails.cache.exist?(key)

    Rails.cache.write(key, true, expires_in: ENQUEUE_FLAG_TTL)
    perform_later(user_id)
  end

  def self.enqueue_flag_key(user_id)
    "recommendation_refresh_enqueued:#{user_id}"
  end

  def perform(user_id)
    user = User.find_by(id: user_id)
    return if user.nil?

    RecommendationService.new(user).generate
    Rails.logger.info("[RecommendationRefreshJob] ユーザー#{user_id}の分析を完了")
  rescue StandardError => e
    Rails.logger.error("[RecommendationRefreshJob] ユーザー#{user_id}の分析に失敗: #{e.message}")
    raise
  ensure
    # 失敗時もフラグを消し、次のアクセスで再試行できるようにする
    Rails.cache.delete(self.class.enqueue_flag_key(user_id))
  end
end
```

あわせて削除:

```bash
rm backend/app/jobs/media_profile_refresh_job.rb
```

`backend/spec/jobs/media_profile_refresh_job_spec.rb`があれば削除する。

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/jobs/`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add -A backend/app/jobs backend/spec/jobs
git commit -m "feat: 分析ジョブを一本化しenqueue_onceで多重起動を防止"
```

---

### Task 7: RecommendationsControllerを新レスポンス形式に更新

**Files:**
- Modify: `backend/app/controllers/api/v1/recommendations_controller.rb`
- Test: `backend/spec/requests/api/v1/recommendations_spec.rb`

**Interfaces:**
- Consumes: `RecommendationRefreshJob.enqueue_once`（Task 6）、`PreferenceAnalyzer::MINIMUM_RECORDS`
- Produces: `GET /api/v1/recommendations`のready時レスポンスから`recommended_works`/`challenge_works`を除去。`{ recommendation: { analysis: {...}, analyzed_at, record_count }, status: 'ready' }`

- [ ] **Step 1: 失敗するテストを書く**

`recommendations_spec.rb`を修正する。

(1) 「DBに分析結果がある場合」contextの`Recommendation.create!`から`recommended_works`/`challenge_works`を外し、検証を変更:

```ruby
        Recommendation.create!(
          user: user,
          analysis_summary: '保存済み分析',
          record_count: 10,
          analyzed_at: Time.current
        )
```

```ruby
      it '保存済み結果を返す' do
        get '/api/v1/recommendations', as: :json
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['status']).to eq('ready')
        expect(json['recommendation']['analysis']['summary']).to eq('保存済み分析')
        expect(json['recommendation']).not_to have_key('recommended_works')
        expect(json['recommendation']).not_to have_key('challenge_works')
      end
```

(2) `MediaProfileRefreshJob`のテスト（「MediaProfileRefreshJobもエンキューすること」のit）を削除。

(3) refreshのcontextに多重起動防止の検証を追加:

```ruby
      it 'フラグが立っている間は再エンキューしない' do
        original_cache = Rails.cache
        Rails.cache = ActiveSupport::Cache::MemoryStore.new
        begin
          post '/api/v1/recommendations/refresh', as: :json
          expect do
            post '/api/v1/recommendations/refresh', as: :json
          end.not_to have_enqueued_job(RecommendationRefreshJob)
        ensure
          Rails.cache = original_cache
        end
      end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/recommendations_spec.rb`
Expected: FAIL（`recommended_works`キーが残っている・`MediaProfileRefreshJob`定数が無い等）

- [ ] **Step 3: 実装**

`recommendations_controller.rb`を以下に置き換え:

```ruby
module Api
  module V1
    class RecommendationsController < ApplicationController
      before_action :authenticate_user!

      def show
        records_count = current_user.records.count

        return render json: { recommendation: nil, status: 'no_records' } if records_count.zero?

        if records_count < PreferenceAnalyzer::MINIMUM_RECORDS
          return render json: insufficient_records_response(records_count)
        end

        render_recommendation
      end

      def refresh
        RecommendationRefreshJob.enqueue_once(current_user.id)
        render json: { message: '分析を開始しました', status: 'processing' }, status: :accepted
      end

      private

      def render_recommendation
        recommendation = RecommendationService.new(current_user).fetch

        if recommendation.nil?
          RecommendationRefreshJob.enqueue_once(current_user.id)
          return render json: { recommendation: nil, status: 'generating' }
        end

        render json: { recommendation: format_recommendation(recommendation), status: 'ready' }
      end

      def insufficient_records_response(records_count)
        {
          recommendation: {
            analysis: nil,
            genre_stats: genre_stats_for_user,
            record_count: records_count,
            required_count: PreferenceAnalyzer::MINIMUM_RECORDS
          },
          status: 'insufficient_records'
        }
      end

      def format_recommendation(rec)
        {
          analysis: {
            summary: rec.analysis_summary,
            preference_scores: rec.preference_scores,
            genre_stats: rec.genre_stats,
            top_tags: rec.top_tags
          },
          analyzed_at: rec.analyzed_at&.iso8601,
          record_count: rec.record_count
        }
      end

      def genre_stats_for_user
        Work.joins(:records)
            .where(records: { user_id: current_user.id })
            .group('works.media_type')
            .select('works.media_type', 'COUNT(*) as count', 'AVG(records.rating) as avg_rating')
            .map do |stat|
              { media_type: stat.media_type, count: stat.count, avg_rating: stat.avg_rating&.round(1)&.to_f }
            end
      end
    end
  end
end
```

※insufficient_records時の`recommended_works: []`/`challenge_works: []`キーも除去している（フロントはTask 10〜11で追随）。

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/recommendations_spec.rb`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/controllers/api/v1/recommendations_controller.rb backend/spec/requests/api/v1/recommendations_spec.rb
git commit -m "feat: おすすめAPIを分析ダッシュボード形式のレスポンスに変更"
```

---

### Task 8: MediaPreferenceProfilesControllerをジャンル横断仕様に更新

**Files:**
- Rewrite: `backend/app/controllers/api/v1/media_preference_profiles_controller.rb`
- Test: `backend/spec/requests/api/v1/media_preference_profiles_spec.rb`（書き換え）

**Interfaces:**
- Consumes: `RecommendationRefreshJob.enqueue_once`（Task 6）、`PreferenceAnalyzer::MINIMUM_RECORDS`
- Produces: `GET /api/v1/media_preference_profiles` → 6メディア分の配列。ステータスは全体記録数で決まる: 0件=`no_records` / 1〜4件=`insufficient_records` / プロファイル未生成=`generating`（ジョブ自動起動） / 生成済み=`ready`。ready時: `{ media_type, status, analysis_summary, same_media_works, record_count, analyzed_at }`（`record_count`はそのメディアの記録数。タブバッジ用）

- [ ] **Step 1: 失敗するテストを書く**

`media_preference_profiles_spec.rb`を以下に全面置き換え:

```ruby
require 'rails_helper'

RSpec.describe 'Api::V1::MediaPreferenceProfiles', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  def create_records(count, media_type: 'anime')
    count.times do |i|
      work = Work.create!(title: "#{media_type}作品#{i}", media_type: media_type)
      user.records.create!(work: work, status: :completed, rating: 8)
    end
  end

  describe 'GET /api/v1/media_preference_profiles' do
    it '未認証なら401を返す' do
      get '/api/v1/media_preference_profiles', as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    context '記録が0件の場合' do
      before { sign_in user }

      it '全メディアがno_recordsになる' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        expect(json.length).to eq(6)
        expect(json.map { |p| p['status'] }.uniq).to eq(['no_records'])
      end
    end

    context '全体の記録が1〜4件の場合' do
      before do
        sign_in user
        create_records(3)
      end

      it '全メディアがinsufficient_recordsになる' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        expect(json.map { |p| p['status'] }.uniq).to eq(['insufficient_records'])
      end

      it 'メディアごとの記録数を返す' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        anime = json.find { |p| p['media_type'] == 'anime' }
        expect(anime['record_count']).to eq(3)
      end
    end

    context '全体の記録が5件以上でプロファイル未生成の場合' do
      before do
        sign_in user
        create_records(5)
      end

      it 'generatingを返しジョブを自動起動する' do
        expect do
          get '/api/v1/media_preference_profiles', as: :json
        end.to have_enqueued_job(RecommendationRefreshJob).with(user.id)

        json = response.parsed_body
        expect(json.map { |p| p['status'] }.uniq).to eq(['generating'])
      end
    end

    context 'プロファイル生成済みの場合' do
      before do
        sign_in user
        create_records(5)
        Work.media_types.each_key do |media_type|
          MediaPreferenceProfile.create!(
            user: user,
            media_type: media_type,
            analysis_summary: "#{media_type}の傾向",
            same_media_works: [{ 'title' => "#{media_type}のおすすめ" }],
            analyzed_at: Time.current
          )
        end
      end

      it '記録0件のメディアもreadyでおすすめを返す' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        movie = json.find { |p| p['media_type'] == 'movie' }
        expect(movie['status']).to eq('ready')
        expect(movie['record_count']).to eq(0)
        expect(movie['same_media_works'].first['title']).to eq('movieのおすすめ')
        expect(movie['analysis_summary']).to eq('movieの傾向')
      end

      it 'ジョブを起動しない' do
        expect do
          get '/api/v1/media_preference_profiles', as: :json
        end.not_to have_enqueued_job(RecommendationRefreshJob)
      end
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/media_preference_profiles_spec.rb`
Expected: FAIL（旧実装はメディア別3件条件・`MediaPreferenceAnalyzer`参照）

- [ ] **Step 3: 実装（全面書き換え）**

`media_preference_profiles_controller.rb`を以下に置き換え:

```ruby
module Api
  module V1
    class MediaPreferenceProfilesController < ApplicationController
      before_action :authenticate_user!

      def index
        render json: build_profiles
      end

      private

      # ステータスは全体の記録数で決まる（メディア別の件数条件は撤廃。ジャンル横断のため）
      def build_profiles
        counts = media_record_counts
        total = current_user.records.count

        return pending_profiles('no_records', counts) if total.zero?
        return pending_profiles('insufficient_records', counts) if total < PreferenceAnalyzer::MINIMUM_RECORDS

        profiles = current_user.media_preference_profiles.index_by(&:media_type)
        Work.media_types.keys.map { |media_type| profile_entry(media_type, profiles[media_type], counts) }
      end

      def pending_profiles(status, counts)
        Work.media_types.keys.map do |media_type|
          { media_type:, status:, record_count: counts[media_type] || 0 }
        end
      end

      def profile_entry(media_type, profile, counts)
        if profile.nil?
          # 未生成のまま放置されないよう、閲覧をトリガーに分析を自動起動する
          RecommendationRefreshJob.enqueue_once(current_user.id)
          return { media_type:, status: 'generating', record_count: counts[media_type] || 0 }
        end

        {
          media_type:,
          status: 'ready',
          analysis_summary: profile.analysis_summary,
          same_media_works: profile.same_media_works,
          record_count: counts[media_type] || 0,
          analyzed_at: profile.analyzed_at&.iso8601
        }
      end

      # group(:media_type)のキーはRailsがenum文字列（'anime'等）にキャスト済みのため変換不要
      def media_record_counts
        current_user.records.joins(:work).group('works.media_type').count
      end
    end
  end
end
```

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/media_preference_profiles_spec.rb`
Expected: PASS

- [ ] **Step 5: バックエンド全体のテストとリンター**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec`
Expected: 全てPASS（残FAILがあればこのTaskの範囲で修正する。旧`MediaPreferenceAnalyzer`等への参照が残っていないか確認）

Run: `docker compose run --rm backend bundle exec rubocop`
Expected: no offenses

- [ ] **Step 6: コミット**

```bash
git add backend/app/controllers/api/v1/media_preference_profiles_controller.rb backend/spec/requests/api/v1/media_preference_profiles_spec.rb
git commit -m "feat: メディア別プロファイルAPIをジャンル横断仕様に変更しジョブ自動起動を追加"
```

---

### Task 9: 不要カラム削除マイグレーション

**Files:**
- Create: `backend/db/migrate/<timestamp>_remove_legacy_recommendation_columns.rb`（`docker compose run --rm backend bin/rails generate migration RemoveLegacyRecommendationColumns`で生成）
- Modify: `backend/db/schema.rb`（migrate実行で自動更新）

**Interfaces:**
- Produces: `recommendations`から`recommended_works`/`challenge_works`、`media_preference_profiles`から`cross_media_works`/`preference_scores`/`top_tags`が消える

- [ ] **Step 1: マイグレーション作成**

```ruby
# 一括生成方式への移行で使わなくなったカラムを削除する
# （総合の作品リストはメディア別タブへ一本化、メディア別スコアは廃止）
class RemoveLegacyRecommendationColumns < ActiveRecord::Migration[8.0]
  def change
    remove_column :recommendations, :recommended_works, :jsonb, default: []
    remove_column :recommendations, :challenge_works, :jsonb, default: []
    remove_column :media_preference_profiles, :cross_media_works, :jsonb, default: []
    remove_column :media_preference_profiles, :preference_scores, :jsonb, default: []
    remove_column :media_preference_profiles, :top_tags, :jsonb, default: []
  end
end
```

- [ ] **Step 2: マイグレーション実行**

Run: `docker compose run --rm backend bin/rails db:migrate`
Expected: 成功。`schema.rb`から該当カラムが消える

- [ ] **Step 3: 全テストが通ることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec`
Expected: 全てPASS（削除カラムを参照するコードが残っていればここで検出される）

- [ ] **Step 4: コミット**

```bash
git add backend/db
git commit -m "feat: レコメンド旧方式の未使用カラムを削除"
```

---

### Task 10: フロントエンド型定義とメディアタブの更新

**Files:**
- Modify: `frontend/src/types/mediaPreferenceProfile.ts`
- Modify: `frontend/src/types/recommendation.ts`
- Rewrite: `frontend/src/pages/RecommendationsPage/MediaTabContent.tsx`
- Rewrite: `frontend/src/pages/RecommendationsPage/MediaAnalysisSummaryCard.tsx`
- Test: `frontend/src/pages/RecommendationsPage/MediaTabContent.test.tsx`（書き換え）

**Interfaces:**
- Consumes: Task 8のAPIレスポンス
- Produces: `MediaPreferenceProfileReady`型（`analysis_summary` / `same_media_works` / `record_count` / `analyzed_at`のみ）。`RecommendationData`から`recommended_works`/`challenge_works`を除去（Task 11が前提とする）

- [ ] **Step 1: 失敗するテストを書く**

`MediaTabContent.test.tsx`を以下に全面置き換え:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { MediaPreferenceProfile } from '../../types/mediaPreferenceProfile'
import { MediaTabContent } from './MediaTabContent'

const defaultProps = {
  onRecord: vi.fn(),
  recordedIds: new Set<string>(),
  recordingId: null,
}

const renderWithRouter = (profile: MediaPreferenceProfile) =>
  render(
    <MemoryRouter>
      <MediaTabContent profile={profile} {...defaultProps} />
    </MemoryRouter>,
  )

describe('MediaTabContent', () => {
  it('generating状態でスピナーを表示する', () => {
    renderWithRouter({ media_type: 'anime', status: 'generating', record_count: 0 })
    expect(screen.getByText('アニメの分析中...')).toBeInTheDocument()
  })

  it('ready状態で傾向文とおすすめ作品を表示する', () => {
    renderWithRouter({
      media_type: 'movie',
      status: 'ready',
      analysis_summary: 'アニメの好みから映画を推定しました',
      same_media_works: [
        {
          title: 'インセプション',
          media_type: 'movie',
          description: '夢の中の物語',
          cover_url: null,
          reason: '構造の凝った物語が好きなあなたへ',
          external_api_id: '1',
          external_api_source: 'tmdb',
          metadata: {},
        },
      ],
      record_count: 0,
      analyzed_at: '2026-07-19T00:00:00Z',
    })
    expect(screen.getByText('アニメの好みから映画を推定しました')).toBeInTheDocument()
    expect(screen.getByText('インセプション')).toBeInTheDocument()
    expect(screen.getByText('映画のおすすめ')).toBeInTheDocument()
  })

  it('記録0件でもready状態ならおすすめを表示する（進捗カードを出さない）', () => {
    renderWithRouter({
      media_type: 'movie',
      status: 'ready',
      analysis_summary: '推定傾向',
      same_media_works: [],
      record_count: 0,
      analyzed_at: '2026-07-19T00:00:00Z',
    })
    expect(screen.queryByText(/あと\d+件記録すると/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm frontend npm test -- --run src/pages/RecommendationsPage/MediaTabContent.test.tsx`
Expected: FAIL（型不一致・旧UIの表示）

- [ ] **Step 3: 実装**

(1) `frontend/src/types/mediaPreferenceProfile.ts`を以下に置き換え:

```ts
import type { RecommendedWork } from './recommendation'

export type MediaProfileStatus = 'ready' | 'generating' | 'insufficient_records' | 'no_records'

export interface MediaPreferenceProfileReady {
  media_type: string
  status: 'ready'
  analysis_summary: string
  same_media_works: RecommendedWork[]
  record_count: number
  analyzed_at: string
}

export interface MediaPreferenceProfileGenerating {
  media_type: string
  status: 'generating'
  record_count: number
}

// 全体の記録が5件未満のときにAPIが返す状態（タブ自体は表示されない）
export interface MediaPreferenceProfilePending {
  media_type: string
  status: 'insufficient_records' | 'no_records'
  record_count: number
}

export type MediaPreferenceProfile =
  | MediaPreferenceProfileReady
  | MediaPreferenceProfileGenerating
  | MediaPreferenceProfilePending
```

(2) `frontend/src/types/recommendation.ts`の`RecommendationData`から`recommended_works`/`challenge_works`を削除:

```ts
export interface RecommendationData {
  analysis: RecommendationAnalysis | null
  analyzed_at: string | null
  record_count: number
  required_count?: number
  genre_stats?: GenreStat[]
}
```

（他のinterfaceは変更しない。`RecommendedWork`はメディアタブで引き続き使用する）

(3) `MediaAnalysisSummaryCard.tsx`を以下に置き換え（スコア表示・開閉トグルを削除）:

```tsx
import { getMediaTypeLabel } from '../../lib/mediaTypeUtils'
import type { MediaPreferenceProfileReady } from '../../types/mediaPreferenceProfile'
import styles from './RecommendationsPage.module.css'

type Props = {
  profile: MediaPreferenceProfileReady
}

// メディア別タブ上部の傾向文カード（一括分析のtrend文を表示する）
export function MediaAnalysisSummaryCard({ profile }: Props) {
  const mediaLabel = getMediaTypeLabel(profile.media_type)
  const borderClass = styles[`mediaBorder${profile.media_type}` as keyof typeof styles]

  return (
    <div className={`${styles.summaryCard} ${borderClass ?? ''}`}>
      <div className={styles.summaryHeader}>
        <span className={styles.summaryLabel}>{mediaLabel}での好み傾向</span>
        <span className={styles.aiBadge}>AI分析</span>
      </div>
      <p className={styles.summaryText}>{profile.analysis_summary}</p>
    </div>
  )
}
```

(4) `MediaTabContent.tsx`を以下に置き換え（進捗カード・空状態・cross_mediaセクションを削除）:

```tsx
import { getMediaTypeLabel } from '../../lib/mediaTypeUtils'
import type { MediaPreferenceProfile } from '../../types/mediaPreferenceProfile'
import type { RecommendedWork } from '../../types/recommendation'
import { MediaAnalysisSummaryCard } from './MediaAnalysisSummaryCard'
import { RecommendedWorkCard } from './RecommendedWorkCard'
import styles from './RecommendationsPage.module.css'

type Props = {
  profile: MediaPreferenceProfile
  onRecord: (work: RecommendedWork, position: number) => void
  recordedIds: Set<string>
  recordingId: string | null
}

export function MediaTabContent({ profile, onRecord, recordedIds, recordingId }: Props) {
  const mediaLabel = getMediaTypeLabel(profile.media_type)
  const workKey = (work: RecommendedWork) => `${work.external_api_source}:${work.external_api_id}`

  if (profile.status === 'generating') {
    return (
      <div className={styles.loadingOverlay}>
        <div className={styles.spinner} />
        <div>
          <div className={styles.loadingText}>{mediaLabel}の分析中...</div>
          <div className={styles.loadingSub}>1〜2分かかることがあります。</div>
        </div>
      </div>
    )
  }

  // insufficient_records / no_records は全体側の表示で扱うため、タブでは何も出さない
  if (profile.status !== 'ready') return null

  return (
    <>
      <MediaAnalysisSummaryCard profile={profile} />

      {profile.same_media_works.length > 0 && (
        <>
          <h2 className={styles.mediaSectionTitle}>{mediaLabel}のおすすめ</h2>
          <div className={styles.recList}>
            {profile.same_media_works.map((work, index) => (
              <RecommendedWorkCard
                key={workKey(work)}
                work={work}
                onRecord={(w) => onRecord(w, index + 1)}
                isLoading={recordingId === workKey(work)}
                isRecorded={recordedIds.has(workKey(work))}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}
```

※この時点で`RecommendationsPage.tsx`が`recommended_works`等を参照して型エラーになる（Task 11で解消）。tscの完走はTask 11のStepで確認する。

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose run --rm frontend npm test -- --run src/pages/RecommendationsPage/MediaTabContent.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/types frontend/src/pages/RecommendationsPage/MediaTabContent.tsx frontend/src/pages/RecommendationsPage/MediaAnalysisSummaryCard.tsx frontend/src/pages/RecommendationsPage/MediaTabContent.test.tsx
git commit -m "feat: メディアタブをジャンル横断表示に対応し傾向文カードを簡素化"
```

---

### Task 11: RecommendationsPageの総合タブを分析ダッシュボードに整理

**Files:**
- Modify: `frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx`
- Test: `frontend/src/pages/RecommendationsPage/RecommendationsPage.test.tsx`

**Interfaces:**
- Consumes: Task 10の型、`useMediaProfiles`（`refetch`）、Task 7のAPIレスポンス
- Produces: 総合タブ＝`AnalysisSummaryCard`のみ（作品リストなし）。分析完了時（statusがreadyへ遷移）にメディアプロファイルを再取得する

- [ ] **Step 1: 失敗するテストを書く**

`RecommendationsPage.test.tsx`の既存テストのうち、総合タブの`recommended_works`/`challenge_works`表示を検証しているケースを削除し、以下の検証に置き換える（既存のモック構造・レンダリングヘルパーは流用する）:

```tsx
  it('総合タブに作品リストを表示しない（分析ダッシュボードのみ）', async () => {
    // 既存のready状態モックからrecommended_works/challenge_worksを除去した上で
    renderPage()
    expect(await screen.findByText(/好み/)).toBeInTheDocument()
    expect(screen.queryByText('あなたへのおすすめ')).not.toBeInTheDocument()
    expect(screen.queryByText('いつもと違うジャンルに挑戦')).not.toBeInTheDocument()
  })
```

※`renderPage`等のヘルパー名は既存テストファイルのものに合わせる。モックの`RecommendationData`から`recommended_works`/`challenge_works`を全て除去する（型エラーで検出できる）。

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm frontend npm test -- --run src/pages/RecommendationsPage/RecommendationsPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: 実装**

`RecommendationsPage.tsx`を修正:

(1) `useMediaProfiles`から`refetch`を取得し、分析完了時に再取得する（`useEffect`をimportに追加）:

```tsx
  const { profiles, getProfileByMediaType, refetch: refetchProfiles } = useMediaProfiles()
```

```tsx
  // 分析完了（generating→ready）時にメディア別プロファイルも最新化する
  useEffect(() => {
    if (status === 'ready') void refetchProfiles()
  }, [status, refetchProfiles])
```

(2) ready時の総合タブから「あなたへのおすすめ」「いつもと違うジャンルに挑戦」の2セクション（`data.recommended_works.length > 0 && (...)`と`data.challenge_works.length > 0 && (...)`のJSXブロック）を削除し、`AnalysisSummaryCard`のみ残す:

```tsx
          {activeTab === 'overall' ? (
            <motion.div variants={m.fadeInUp}>
              {data.analysis && <AnalysisSummaryCard analysis={data.analysis} />}
            </motion.div>
          ) : activeProfile ? (
```

(3) 総合タブで使わなくなったimport（`RecommendedWorkCard`）をページから削除する。`SectionTitle`はinsufficient_records表示で使用しているので残す。

- [ ] **Step 4: テスト・型チェック・リンターが通ることを確認**

Run: `docker compose run --rm frontend npm test -- --run`
Expected: 全てPASS

Run: `docker compose run --rm frontend npm run lint`
Expected: エラーなし（tscを含むlint設定であれば型エラーもここで検出。含まれない場合は`docker compose run --rm frontend npx tsc --noEmit`も実行し、exit code 0を確認する）

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/RecommendationsPage frontend/src/hooks
git commit -m "feat: 総合タブを分析ダッシュボードに整理し分析完了時にプロファイルを再取得"
```

---

### Task 12: 全体検証

- [ ] **Step 1: バックエンド全テスト＋リンター**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec
docker compose run --rm backend bundle exec rubocop
```

Expected: 全てPASS / no offenses

- [ ] **Step 2: フロントエンド全テスト＋リンター**

```bash
docker compose run --rm frontend npm test -- --run
docker compose run --rm frontend npm run lint
```

Expected: 全てPASS / エラーなし

- [ ] **Step 3: PR前セルフチェック**

`.claude/rules/pr-self-check.md`に従い確認:
- 全ファイル200行以内か（特に`preference_prompt_builder.rb`と`RecommendationsPage.tsx`）
- 未使用import・dead codeが残っていないか（`MediaProfileRefreshJob`・`MediaPreferenceAnalyzer`への参照が全て消えているか`grep`で確認: `grep -r "MediaProfileRefreshJob\|MediaPreferenceAnalyzer" backend/ frontend/src/`で0件）
- CSSハードコード値を追加していないか（今回CSSは原則変更なし）

- [ ] **Step 4: ADR作成**

`.claude/rules/adr.md`に従い、`docs/adr/`の次番号で「レコメンドの一括生成方式への移行」のADRを作成する。内容: 一括生成 vs メディアごと生成の比較、Sonnet格上げの判断、formatフィルタ＋既記録スキップの設計。ステータス: 承認済み（2026-07-19にIK承認）。コミットする。

---

## 動作確認（Step 5・実装完了後）

ワークフローStep 5に従い、実装完了後にIKさんへ確認方法（手動 or Playwright MCP）を質問する。確認ポイント:

1. おすすめページを開き「分析を更新」→ 総合タブに分析サマリーが出る（作品リストは無い）
2. 記録があるメディアのタブ: 傾向文＋おすすめ5件。OVA・特別篇・CMが出ないこと
3. 記録が無いメディアのタブ: 「分析中…」→完了後、推定おすすめが表示されること
4. 更新ボタン連打で分析が多重実行されないこと
