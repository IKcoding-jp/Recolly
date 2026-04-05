# おすすめ機能 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ユーザーの記録データをClaude APIで分析し、ジャンル横断のおすすめ作品を表示する `/recommendations` ページを実装する。

**Architecture:** バックエンド完結型。PreferenceAnalyzer（好み分析）→ WorkRecommender（作品検索）→ RecommendationService（調整役）の3層構造。分析結果はDBに永続化し、Solid Queueジョブで非同期更新する。フロントエンドはコンパクトサマリー＋おすすめ作品リストのB案レイアウト。

**Tech Stack:** Rails 8 API / PostgreSQL (jsonb) / Anthropic Ruby SDK (claude-haiku-4-5) / Solid Queue / React 19 / TypeScript / Vitest + RTL

**Spec:** `docs/superpowers/specs/2026-04-05-recommendations-design.md`

---

## ファイル構成

### バックエンド（新規作成）

| ファイル | 責務 |
|---|---|
| `db/migrate/XXXXXX_create_recommendations.rb` | recommendationsテーブル作成 |
| `app/models/recommendation.rb` | Recommendationモデル（バリデーション、リレーション） |
| `app/services/preference_analyzer.rb` | 記録データ集計 + Claude API呼び出し |
| `app/services/work_recommender.rb` | 好み分析結果 → 外部APIで作品検索 |
| `app/services/recommendation_service.rb` | 全体の調整役 |
| `app/jobs/recommendation_refresh_job.rb` | 非同期更新ジョブ |
| `app/controllers/api/v1/recommendations_controller.rb` | APIエンドポイント |
| `spec/models/recommendation_spec.rb` | モデルテスト |
| `spec/services/preference_analyzer_spec.rb` | 好み分析テスト |
| `spec/services/work_recommender_spec.rb` | おすすめ生成テスト |
| `spec/services/recommendation_service_spec.rb` | 調整役テスト |
| `spec/jobs/recommendation_refresh_job_spec.rb` | ジョブテスト |
| `spec/requests/api/v1/recommendations_spec.rb` | リクエストテスト |

### バックエンド（変更）

| ファイル | 変更内容 |
|---|---|
| `config/routes.rb` | recommendationsルート追加 |
| `app/models/user.rb` | `has_one :recommendation` 追加 |
| `Gemfile` | `anthropic` gem 追加 |

### フロントエンド（新規作成）

| ファイル | 責務 |
|---|---|
| `src/lib/recommendationsApi.ts` | API呼び出し |
| `src/types/recommendation.ts` | 型定義 |
| `src/hooks/useRecommendations.ts` | 状態管理hook |
| `src/pages/RecommendationsPage/RecommendationsPage.tsx` | ページ本体 |
| `src/pages/RecommendationsPage/RecommendationsPage.module.css` | スタイル |
| `src/pages/RecommendationsPage/AnalysisSummaryCard.tsx` | サマリー + アコーディオン |
| `src/pages/RecommendationsPage/AnalysisDetail.tsx` | 展開される詳細 |
| `src/pages/RecommendationsPage/RecommendedWorkCard.tsx` | おすすめ作品カード |
| `src/pages/RecommendationsPage/RecommendationsPage.test.tsx` | ページテスト |

### フロントエンド（変更）

| ファイル | 変更内容 |
|---|---|
| `src/router.tsx` | `/recommendations` ルート追加 |
| `src/components/NavBar/NavBar.tsx` | ナビにおすすめリンク追加 |
| `src/components/BottomTabBar/BottomTabBar.tsx` | モバイルタブにおすすめ追加 |

---

## Task 1: Recommendationモデル + マイグレーション

**Files:**
- Create: `backend/db/migrate/XXXXXX_create_recommendations.rb`
- Create: `backend/app/models/recommendation.rb`
- Modify: `backend/app/models/user.rb`
- Test: `backend/spec/models/recommendation_spec.rb`

- [ ] **Step 1: テストを書く**

```ruby
# backend/spec/models/recommendation_spec.rb
require 'rails_helper'

RSpec.describe Recommendation, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe 'バリデーション' do
    it 'user_idが必須' do
      recommendation = Recommendation.new(user: nil)
      expect(recommendation).not_to be_valid
      expect(recommendation.errors[:user]).to include('must exist')
    end

    it '同じユーザーに2つ作れない' do
      Recommendation.create!(user: user)
      duplicate = Recommendation.new(user: user)
      expect(duplicate).not_to be_valid
    end

    it '有効なデータで保存できる' do
      recommendation = Recommendation.new(
        user: user,
        analysis_summary: 'テスト分析',
        preference_scores: [{ label: 'キャラクター重視', score: 9.2 }],
        genre_stats: [{ media_type: 'anime', count: 10, avg_rating: 8.0 }],
        top_tags: [{ name: '名作', count: 5 }],
        recommended_works: [{ title: 'テスト作品', media_type: 'anime', reason: 'テスト理由' }],
        challenge_works: [],
        record_count: 10,
        analyzed_at: Time.current
      )
      expect(recommendation).to be_valid
    end
  end

  describe 'リレーション' do
    it 'userに属する' do
      recommendation = Recommendation.create!(user: user)
      expect(recommendation.user).to eq(user)
    end

    it 'userからhas_oneでアクセスできる' do
      recommendation = Recommendation.create!(user: user)
      expect(user.recommendation).to eq(recommendation)
    end
  end

  describe 'jsonbカラム' do
    it 'preference_scoresのデフォルトが空配列' do
      recommendation = Recommendation.create!(user: user)
      expect(recommendation.preference_scores).to eq([])
    end

    it 'recommended_worksにハッシュの配列を保存できる' do
      works = [
        { 'title' => '作品A', 'media_type' => 'anime', 'reason' => '理由A' },
        { 'title' => '作品B', 'media_type' => 'movie', 'reason' => '理由B' }
      ]
      recommendation = Recommendation.create!(user: user, recommended_works: works)
      recommendation.reload
      expect(recommendation.recommended_works.length).to eq(2)
      expect(recommendation.recommended_works.first['title']).to eq('作品A')
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd backend && bundle exec rspec spec/models/recommendation_spec.rb`
Expected: FAIL — `uninitialized constant Recommendation`

- [ ] **Step 3: マイグレーションを作成**

Run: `cd backend && bin/rails generate migration CreateRecommendations`

生成されたファイルを以下のように編集:

```ruby
class CreateRecommendations < ActiveRecord::Migration[8.1]
  def change
    create_table :recommendations do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.text :analysis_summary
      t.jsonb :preference_scores, default: []
      t.jsonb :genre_stats, default: []
      t.jsonb :top_tags, default: []
      t.jsonb :recommended_works, default: []
      t.jsonb :challenge_works, default: []
      t.integer :record_count, default: 0
      t.datetime :analyzed_at

      t.timestamps
    end
  end
end
```

- [ ] **Step 4: マイグレーション実行**

Run: `cd backend && bin/rails db:migrate`
Expected: recommendations テーブルが作成される

- [ ] **Step 5: モデルを作成**

```ruby
# backend/app/models/recommendation.rb
class Recommendation < ApplicationRecord
  belongs_to :user

  validates :user_id, uniqueness: true
end
```

- [ ] **Step 6: Userモデルにリレーション追加**

`backend/app/models/user.rb` の既存のリレーション定義に追加:

```ruby
has_one :recommendation, dependent: :destroy
```

- [ ] **Step 7: テストを実行してパスを確認**

Run: `cd backend && bundle exec rspec spec/models/recommendation_spec.rb`
Expected: ALL PASS

- [ ] **Step 8: コミット**

```bash
git add backend/db/migrate/*_create_recommendations.rb backend/app/models/recommendation.rb backend/app/models/user.rb backend/spec/models/recommendation_spec.rb backend/db/schema.rb
git commit -m "feat: Recommendationモデルとマイグレーションを追加"
```

---

## Task 2: PreferenceAnalyzer — データ集計

**Files:**
- Create: `backend/app/services/preference_analyzer.rb`
- Test: `backend/spec/services/preference_analyzer_spec.rb`

このタスクではまずClaude APIを呼ばず、ユーザーの記録データを集計するロジックだけを実装する。

- [ ] **Step 1: テストを書く**

```ruby
# backend/spec/services/preference_analyzer_spec.rb
require 'rails_helper'

RSpec.describe PreferenceAnalyzer do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  def create_record(attrs = {})
    work_attrs = {
      title: attrs.delete(:title) || 'テスト作品',
      media_type: attrs.delete(:media_type) || 'anime',
      metadata: attrs.delete(:metadata) || { 'genres' => %w[Fantasy Drama] }
    }
    work = Work.create!(work_attrs)
    user.records.create!({ work: work, status: :completed, rating: 8 }.merge(attrs))
  end

  describe '#collect_data' do
    context '記録が5件以上ある場合' do
      before do
        create_record(title: '作品A', media_type: 'anime', rating: 9)
        create_record(title: '作品B', media_type: 'anime', rating: 8)
        create_record(title: '作品C', media_type: 'movie', rating: 7)
        create_record(title: '作品D', media_type: 'manga', rating: 9)
        create_record(title: '作品E', media_type: 'game', rating: 6)
      end

      it 'ジャンル別統計を返す' do
        data = described_class.new(user).collect_data
        anime_stat = data[:genre_stats].find { |s| s[:media_type] == 'anime' }
        expect(anime_stat[:count]).to eq(2)
        expect(anime_stat[:avg_rating]).to eq(8.5)
      end

      it '高評価作品TOP10を返す' do
        data = described_class.new(user).collect_data
        expect(data[:top_rated].first[:title]).to eq('作品A')
        expect(data[:top_rated].first[:rating]).to eq(9)
      end

      it '断念作品を返す' do
        create_record(title: '断念作品', media_type: 'anime', rating: 3, status: :dropped)
        data = described_class.new(user).collect_data
        expect(data[:dropped].first[:title]).to eq('断念作品')
      end
    end

    context 'タグがある場合' do
      it 'タグ集計を含める' do
        record = create_record(title: '作品A', rating: 9)
        tag = user.tags.create!(name: '名作')
        record.record_tags.create!(tag: tag)

        data = described_class.new(user).collect_data
        expect(data[:tag_stats]).not_to be_empty
        expect(data[:tag_stats].first[:name]).to eq('名作')
      end
    end

    context '感想がある場合' do
      it '感想テキスト抜粋を含める' do
        record = create_record(title: '作品A', rating: 9)
        record.episode_reviews.create!(episode_number: 1, body: '伏線回収が見事だった')

        data = described_class.new(user).collect_data
        expect(data[:review_excerpts]).to include('伏線回収が見事だった')
      end
    end

    context 'タグも感想もない場合' do
      it 'tag_statsとreview_excerptsが空になる' do
        5.times { |i| create_record(title: "作品#{i}", rating: 7 + i % 3) }
        data = described_class.new(user).collect_data
        expect(data[:tag_stats]).to be_empty
        expect(data[:review_excerpts]).to be_empty
      end
    end

    context 'お気に入りがある場合' do
      it 'favorite_worksを含める' do
        record = create_record(title: 'お気に入り作品', rating: 10)
        FavoriteWork.create!(user: user, work: record.work, position: 1)

        data = described_class.new(user).collect_data
        expect(data[:favorites]).not_to be_empty
        expect(data[:favorites].first[:title]).to eq('お気に入り作品')
      end
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd backend && bundle exec rspec spec/services/preference_analyzer_spec.rb`
Expected: FAIL — `uninitialized constant PreferenceAnalyzer`

- [ ] **Step 3: PreferenceAnalyzerの集計ロジックを実装**

```ruby
# backend/app/services/preference_analyzer.rb
class PreferenceAnalyzer
  MAX_TOP_RATED = 10
  MAX_DROPPED = 5
  MAX_REVIEW_EXCERPTS = 20
  MAX_EXCERPT_LENGTH = 100

  def initialize(user)
    @user = user
    @records = user.records.includes(:work, :tags, :episode_reviews)
  end

  def collect_data
    {
      genre_stats: genre_stats,
      top_rated: top_rated_works,
      dropped: dropped_works,
      tag_stats: tag_stats,
      review_excerpts: review_excerpts,
      favorites: favorite_works
    }
  end

  private

  def genre_stats
    stats = @records.joins(:work)
                    .group('works.media_type')
                    .select(
                      'works.media_type',
                      'COUNT(*) as count',
                      'AVG(records.rating) as avg_rating',
                      "SUM(CASE WHEN records.status = #{Record.statuses[:completed]} THEN 1 ELSE 0 END) as completed_count",
                      "SUM(CASE WHEN records.status = #{Record.statuses[:dropped]} THEN 1 ELSE 0 END) as dropped_count"
                    )

    stats.map do |stat|
      {
        media_type: stat.media_type,
        count: stat.count,
        avg_rating: stat.avg_rating&.round(1)&.to_f,
        completed: stat.completed_count,
        dropped: stat.dropped_count
      }
    end
  end

  def top_rated_works
    @records.where.not(rating: nil)
            .order(rating: :desc, updated_at: :desc)
            .limit(MAX_TOP_RATED)
            .map { |r| work_summary(r) }
  end

  def dropped_works
    @records.where(status: :dropped)
            .order(updated_at: :desc)
            .limit(MAX_DROPPED)
            .map { |r| work_summary(r) }
  end

  def tag_stats
    Tag.joins(:record_tags)
       .joins(record_tags: :record)
       .where(records: { user_id: @user.id })
       .group('tags.name')
       .select(
         'tags.name',
         'COUNT(*) as usage_count',
         'AVG(records.rating) as avg_rating'
       )
       .order('usage_count DESC')
       .limit(10)
       .map do |tag|
         { name: tag.name, count: tag.usage_count, avg_rating: tag.avg_rating&.round(1)&.to_f }
       end
  end

  def review_excerpts
    EpisodeReview.joins(record: :user)
                 .where(records: { user_id: @user.id })
                 .where.not(body: [nil, ''])
                 .order(created_at: :desc)
                 .limit(MAX_REVIEW_EXCERPTS)
                 .pluck(:body)
                 .map { |body| body.truncate(MAX_EXCERPT_LENGTH) }
  end

  def favorite_works
    FavoriteWork.where(user: @user)
                .includes(:work)
                .order(:position)
                .map do |fav|
                  {
                    title: fav.work.title,
                    media_type: fav.work.media_type,
                    genres: fav.work.metadata&.dig('genres') || []
                  }
                end
  end

  def work_summary(record)
    {
      title: record.work.title,
      media_type: record.work.media_type,
      rating: record.rating,
      genres: record.work.metadata&.dig('genres') || []
    }
  end
end
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `cd backend && bundle exec rspec spec/services/preference_analyzer_spec.rb`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/preference_analyzer.rb backend/spec/services/preference_analyzer_spec.rb
git commit -m "feat: PreferenceAnalyzerのデータ集計ロジックを実装"
```

---

## Task 3: PreferenceAnalyzer — Claude API連携

**Files:**
- Modify: `backend/Gemfile`
- Modify: `backend/app/services/preference_analyzer.rb`
- Modify: `backend/spec/services/preference_analyzer_spec.rb`

- [ ] **Step 1: anthropic gemを追加**

`backend/Gemfile` に追加:

```ruby
gem 'anthropic'
```

Run: `cd backend && bundle install`

- [ ] **Step 2: テストを書く**

`backend/spec/services/preference_analyzer_spec.rb` に追記:

```ruby
describe '#analyze' do
  before do
    5.times { |i| create_record(title: "作品#{i}", rating: 7 + i % 3, media_type: %w[anime movie manga game book][i]) }
  end

  it 'Claude APIを呼び出して分析結果を返す' do
    mock_response = {
      'summary' => 'テスト分析サマリー',
      'preference_scores' => [{ 'label' => 'キャラクター重視', 'score' => 9.2 }],
      'search_keywords' => {
        'recommended' => [{ 'media_type' => 'anime', 'query' => 'ファンタジー 感動' }],
        'challenge' => [{ 'media_type' => 'book', 'query' => '社会派 小説' }]
      },
      'reasons' => {
        'ファンタジー 感動' => '作品0に9点をつけたあなたへ。',
        '社会派 小説' => '普段あまり読まないジャンルから。'
      }
    }

    client_double = instance_double(Anthropic::Client)
    allow(Anthropic::Client).to receive(:new).and_return(client_double)
    allow(client_double).to receive(:messages).and_return(
      { 'content' => [{ 'text' => mock_response.to_json }] }
    )

    result = described_class.new(user).analyze
    expect(result[:summary]).to eq('テスト分析サマリー')
    expect(result[:preference_scores].first['label']).to eq('キャラクター重視')
    expect(result[:search_keywords]['recommended']).not_to be_empty
  end

  it '記録が5件未満だとnilを返す' do
    user2 = User.create!(username: 'user2', email: 'user2@example.com', password: 'password123')
    create_record_for(user2, title: '少数作品', rating: 8)

    result = described_class.new(user2).analyze
    expect(result).to be_nil
  end
end
```

テストのヘルパーメソッドも追加:

```ruby
def create_record_for(target_user, attrs = {})
  work_attrs = {
    title: attrs.delete(:title) || 'テスト作品',
    media_type: attrs.delete(:media_type) || 'anime',
    metadata: attrs.delete(:metadata) || { 'genres' => %w[Fantasy Drama] }
  }
  work = Work.create!(work_attrs)
  target_user.records.create!({ work: work, status: :completed, rating: 8 }.merge(attrs))
end
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `cd backend && bundle exec rspec spec/services/preference_analyzer_spec.rb`
Expected: FAIL — `analyze` メソッドが未定義

- [ ] **Step 4: analyze メソッドを実装**

`backend/app/services/preference_analyzer.rb` に追加:

```ruby
class PreferenceAnalyzer
  MINIMUM_RECORDS = 5

  # 既存のコード（initialize, collect_data等）はそのまま

  def analyze
    return nil if @records.count < MINIMUM_RECORDS

    data = collect_data
    response = call_claude_api(data)
    parse_response(response, data)
  end

  private

  # 既存のprivateメソッドはそのまま

  def call_claude_api(data)
    client = Anthropic::Client.new(api_key: ENV.fetch('ANTHROPIC_API_KEY'))
    client.messages(
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: build_prompt(data) }]
    )
  end

  def build_prompt(data)
    prompt = <<~PROMPT
      あなたはメディア作品のレコメンドアナリストです。
      以下のユーザーの視聴・閲覧記録データを分析してください。

      ■ ジャンル別統計:
      #{data[:genre_stats].map { |s| "#{s[:media_type]}: #{s[:count]}件, 平均#{s[:avg_rating]}点" }.join("\n")}

      ■ 高評価作品TOP10:
      #{data[:top_rated].map { |w| "#{w[:title]} (#{w[:media_type]}, #{w[:rating]}点, ジャンル: #{w[:genres].join(', ')})" }.join("\n")}
    PROMPT

    if data[:dropped].any?
      prompt += <<~DROPPED

        ■ 断念した作品:
        #{data[:dropped].map { |w| "#{w[:title]} (#{w[:media_type]}, #{w[:rating]}点)" }.join("\n")}
      DROPPED
    end

    if data[:tag_stats].any?
      prompt += <<~TAGS

        ■ よく使うタグ:
        #{data[:tag_stats].map { |t| "#{t[:name]} (#{t[:count]}回使用, 平均#{t[:avg_rating]}点)" }.join("\n")}
      TAGS
    end

    if data[:review_excerpts].any?
      prompt += <<~REVIEWS

        ■ 感想テキスト抜粋:
        #{data[:review_excerpts].map { |r| "「#{r}」" }.join("\n")}
      REVIEWS
    end

    if data[:favorites].any?
      prompt += <<~FAVORITES

        ■ お気に入り作品:
        #{data[:favorites].map { |f| "#{f[:title]} (#{f[:media_type]}, ジャンル: #{f[:genres].join(', ')})" }.join("\n")}
      FAVORITES
    end

    prompt += <<~OUTPUT

      以下をJSON形式で出力してください。

      {
        "summary": "好み傾向の分析（200字程度）。ジャンルを横断した共通パターンを見つけ、具体的な作品名や感想の言葉を引用。定型的な表現を避けること。",
        "preference_scores": [
          { "label": "嗜好の軸名（例: キャラクター重視）", "score": 1.0〜10.0 }
        ],
        "search_keywords": {
          "recommended": [
            { "media_type": "anime", "query": "外部APIで検索するキーワード" }
          ],
          "challenge": [
            { "media_type": "book", "query": "普段触れないジャンルのキーワード" }
          ]
        },
        "reasons": {
          "検索キーワード": "ユーザーの具体的な作品名・評価・感想を引用したおすすめ理由"
        }
      }

      preference_scoresは5項目。search_keywordsのrecommendedは7件、challengeは3件。
      reasonsはsearch_keywordsの各queryに対応する理由文。
      JSONのみ出力し、それ以外のテキストは含めないでください。
    OUTPUT

    prompt
  end

  def parse_response(response, data)
    text = response.dig('content', 0, 'text')
    parsed = JSON.parse(text)

    {
      summary: parsed['summary'],
      preference_scores: parsed['preference_scores'],
      search_keywords: parsed['search_keywords'],
      reasons: parsed['reasons'],
      genre_stats: data[:genre_stats],
      top_tags: data[:tag_stats]
    }
  rescue JSON::ParserError => e
    Rails.logger.error("[PreferenceAnalyzer] JSON解析エラー: #{e.message}")
    nil
  end
end
```

- [ ] **Step 5: テストを実行してパスを確認**

Run: `cd backend && bundle exec rspec spec/services/preference_analyzer_spec.rb`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add backend/Gemfile backend/Gemfile.lock backend/app/services/preference_analyzer.rb backend/spec/services/preference_analyzer_spec.rb
git commit -m "feat: PreferenceAnalyzerにClaude API連携を追加"
```

---

## Task 4: WorkRecommender

**Files:**
- Create: `backend/app/services/work_recommender.rb`
- Test: `backend/spec/services/work_recommender_spec.rb`

- [ ] **Step 1: テストを書く**

```ruby
# backend/spec/services/work_recommender_spec.rb
require 'rails_helper'

RSpec.describe WorkRecommender do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  let(:analysis_result) do
    {
      search_keywords: {
        'recommended' => [
          { 'media_type' => 'anime', 'query' => 'ファンタジー 感動' },
          { 'media_type' => 'movie', 'query' => '社会派 ドラマ' }
        ],
        'challenge' => [
          { 'media_type' => 'book', 'query' => '現代文学' }
        ]
      },
      reasons: {
        'ファンタジー 感動' => '作品Aに9点をつけたあなたへ。',
        '社会派 ドラマ' => '社会派テーマが好きなあなたへ。',
        '現代文学' => '普段あまり読まないジャンルから。'
      }
    }
  end

  let(:mock_search_results) do
    [
      OpenStruct.new(
        title: 'おすすめ作品', media_type: 'anime', description: 'テスト説明',
        cover_url: 'https://example.com/cover.jpg',
        external_api_id: '12345', external_api_source: 'anilist',
        metadata: { 'genres' => %w[Fantasy], 'season_year' => 2023 }
      )
    ]
  end

  before do
    allow_any_instance_of(WorkSearchService).to receive(:search).and_return(mock_search_results)
  end

  describe '#recommend' do
    it 'recommended_worksとchallenge_worksを返す' do
      result = described_class.new(user, analysis_result).recommend
      expect(result[:recommended_works]).not_to be_empty
      expect(result[:challenge_works]).not_to be_empty
    end

    it '各作品にreasonが含まれる' do
      result = described_class.new(user, analysis_result).recommend
      expect(result[:recommended_works].first[:reason]).to include('9点')
    end

    it '記録済みの作品を除外する' do
      work = Work.create!(title: 'おすすめ作品', media_type: 'anime',
                          external_api_id: '12345', external_api_source: 'anilist')
      user.records.create!(work: work, status: :completed)

      result = described_class.new(user, analysis_result).recommend
      titles = result[:recommended_works].map { |w| w[:title] }
      expect(titles).not_to include('おすすめ作品')
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd backend && bundle exec rspec spec/services/work_recommender_spec.rb`
Expected: FAIL — `uninitialized constant WorkRecommender`

- [ ] **Step 3: WorkRecommenderを実装**

```ruby
# backend/app/services/work_recommender.rb
class WorkRecommender
  MAX_RECOMMENDED = 7
  MAX_CHALLENGE = 3

  def initialize(user, analysis_result)
    @user = user
    @analysis_result = analysis_result
    @search_service = WorkSearchService.new
    @recorded_external_ids = fetch_recorded_external_ids
  end

  def recommend
    recommended = search_works(@analysis_result[:search_keywords]['recommended'], MAX_RECOMMENDED)
    challenge = search_works(@analysis_result[:search_keywords]['challenge'], MAX_CHALLENGE)

    { recommended_works: recommended, challenge_works: challenge }
  end

  private

  def search_works(keywords, max_count)
    results = []

    keywords.each do |keyword|
      break if results.length >= max_count

      search_results = @search_service.search(keyword['query'], media_type: keyword['media_type'])
      reason = @analysis_result[:reasons][keyword['query']] || ''

      search_results.each do |work|
        break if results.length >= max_count
        next if already_recorded?(work)
        next if results.any? { |r| r[:title] == work.title }

        results << build_work_data(work, reason)
      end
    end

    results
  end

  def build_work_data(work, reason)
    {
      title: work.title,
      media_type: work.media_type,
      description: work.description,
      cover_url: work.cover_url,
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
         .map { |source, id| "#{source}:#{id}" }
         .to_set
  end
end
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `cd backend && bundle exec rspec spec/services/work_recommender_spec.rb`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/work_recommender.rb backend/spec/services/work_recommender_spec.rb
git commit -m "feat: WorkRecommenderを実装（外部API検索 + 記録済み除外）"
```

---

## Task 5: RecommendationService

**Files:**
- Create: `backend/app/services/recommendation_service.rb`
- Test: `backend/spec/services/recommendation_service_spec.rb`

- [ ] **Step 1: テストを書く**

```ruby
# backend/spec/services/recommendation_service_spec.rb
require 'rails_helper'

RSpec.describe RecommendationService do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  let(:mock_analysis) do
    {
      summary: 'テスト分析',
      preference_scores: [{ 'label' => 'テスト', 'score' => 8.0 }],
      search_keywords: { 'recommended' => [], 'challenge' => [] },
      reasons: {},
      genre_stats: [{ media_type: 'anime', count: 10, avg_rating: 8.0 }],
      top_tags: [{ name: '名作', count: 5 }]
    }
  end

  let(:mock_recommendations) do
    {
      recommended_works: [{ title: '作品A', media_type: 'anime', reason: '理由A' }],
      challenge_works: [{ title: '作品B', media_type: 'book', reason: '理由B' }]
    }
  end

  before do
    allow_any_instance_of(PreferenceAnalyzer).to receive(:analyze).and_return(mock_analysis)
    allow_any_instance_of(WorkRecommender).to receive(:recommend).and_return(mock_recommendations)
  end

  describe '#generate' do
    context 'DB に結果がない場合' do
      it '新規にRecommendationを作成する' do
        expect { described_class.new(user).generate }.to change(Recommendation, :count).by(1)
      end

      it '分析結果をDBに保存する' do
        result = described_class.new(user).generate
        expect(result.analysis_summary).to eq('テスト分析')
        expect(result.recommended_works.first['title']).to eq('作品A')
        expect(result.challenge_works.first['title']).to eq('作品B')
      end
    end

    context 'DB に既存の結果がある場合' do
      before do
        Recommendation.create!(user: user, analysis_summary: '古い分析', analyzed_at: 1.day.ago)
      end

      it '既存のRecommendationを更新する' do
        expect { described_class.new(user).generate }.not_to change(Recommendation, :count)
        expect(user.recommendation.reload.analysis_summary).to eq('テスト分析')
      end
    end

    context 'PreferenceAnalyzerがnilを返す場合（記録不足）' do
      before do
        allow_any_instance_of(PreferenceAnalyzer).to receive(:analyze).and_return(nil)
      end

      it 'nilを返す' do
        result = described_class.new(user).generate
        expect(result).to be_nil
      end
    end
  end

  describe '#fetch' do
    it 'DB に結果があればそれを返す' do
      Recommendation.create!(user: user, analysis_summary: 'キャッシュ済み', analyzed_at: Time.current)
      result = described_class.new(user).fetch
      expect(result.analysis_summary).to eq('キャッシュ済み')
    end

    it 'DB に結果がなければnilを返す' do
      result = described_class.new(user).fetch
      expect(result).to be_nil
    end
  end

  describe '#needs_refresh?' do
    it '結果がなければtrue' do
      expect(described_class.new(user).needs_refresh?).to be true
    end

    it '記録が5件以上増えていればtrue' do
      Recommendation.create!(user: user, record_count: 10, analyzed_at: Time.current)
      15.times do |i|
        work = Work.create!(title: "作品#{i}", media_type: 'anime')
        user.records.create!(work: work, status: :completed)
      end
      expect(described_class.new(user).needs_refresh?).to be true
    end

    it '記録が4件以下の増加ならfalse' do
      Recommendation.create!(user: user, record_count: 10, analyzed_at: Time.current)
      12.times do |i|
        work = Work.create!(title: "作品#{i}", media_type: 'anime')
        user.records.create!(work: work, status: :completed)
      end
      expect(described_class.new(user).needs_refresh?).to be false
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd backend && bundle exec rspec spec/services/recommendation_service_spec.rb`
Expected: FAIL — `uninitialized constant RecommendationService`

- [ ] **Step 3: RecommendationServiceを実装**

```ruby
# backend/app/services/recommendation_service.rb
class RecommendationService
  REFRESH_THRESHOLD = 5

  def initialize(user)
    @user = user
  end

  def fetch
    @user.recommendation
  end

  def generate
    analysis = PreferenceAnalyzer.new(@user).analyze
    return nil if analysis.nil?

    recommendations = WorkRecommender.new(@user, analysis).recommend

    save_result(analysis, recommendations)
  end

  def needs_refresh?
    recommendation = @user.recommendation
    return true if recommendation.nil?

    current_count = @user.records.count
    current_count - recommendation.record_count >= REFRESH_THRESHOLD
  end

  private

  def save_result(analysis, recommendations)
    recommendation = @user.recommendation || @user.build_recommendation

    recommendation.update!(
      analysis_summary: analysis[:summary],
      preference_scores: analysis[:preference_scores],
      genre_stats: analysis[:genre_stats].map { |s| s.transform_keys(&:to_s) },
      top_tags: analysis[:top_tags].map { |t| t.transform_keys(&:to_s) },
      recommended_works: recommendations[:recommended_works].map { |w| w.transform_keys(&:to_s) },
      challenge_works: recommendations[:challenge_works].map { |w| w.transform_keys(&:to_s) },
      record_count: @user.records.count,
      analyzed_at: Time.current
    )

    recommendation
  end
end
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `cd backend && bundle exec rspec spec/services/recommendation_service_spec.rb`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/recommendation_service.rb backend/spec/services/recommendation_service_spec.rb
git commit -m "feat: RecommendationService（調整役）を実装"
```

---

## Task 6: RecommendationRefreshJob

**Files:**
- Create: `backend/app/jobs/recommendation_refresh_job.rb`
- Test: `backend/spec/jobs/recommendation_refresh_job_spec.rb`

- [ ] **Step 1: テストを書く**

```ruby
# backend/spec/jobs/recommendation_refresh_job_spec.rb
require 'rails_helper'

RSpec.describe RecommendationRefreshJob, type: :job do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  it 'RecommendationService#generateを呼び出す' do
    service_double = instance_double(RecommendationService)
    allow(RecommendationService).to receive(:new).with(user).and_return(service_double)
    expect(service_double).to receive(:generate)

    described_class.perform_now(user.id)
  end

  it '存在しないuser_idでもエラーにならない' do
    expect { described_class.perform_now(999999) }.not_to raise_error
  end

  it 'Solid Queueのdefaultキューに入る' do
    expect(described_class.new.queue_name).to eq('default')
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd backend && bundle exec rspec spec/jobs/recommendation_refresh_job_spec.rb`
Expected: FAIL — `uninitialized constant RecommendationRefreshJob`

- [ ] **Step 3: ジョブを実装**

```ruby
# backend/app/jobs/recommendation_refresh_job.rb
class RecommendationRefreshJob < ApplicationJob
  queue_as :default

  def perform(user_id)
    user = User.find_by(id: user_id)
    return if user.nil?

    RecommendationService.new(user).generate
    Rails.logger.info("[RecommendationRefreshJob] ユーザー#{user_id}の分析を完了")
  rescue StandardError => e
    Rails.logger.error("[RecommendationRefreshJob] ユーザー#{user_id}の分析に失敗: #{e.message}")
    raise
  end
end
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `cd backend && bundle exec rspec spec/jobs/recommendation_refresh_job_spec.rb`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/jobs/recommendation_refresh_job.rb backend/spec/jobs/recommendation_refresh_job_spec.rb
git commit -m "feat: RecommendationRefreshJob（非同期更新ジョブ）を実装"
```

---

## Task 7: RecommendationsController + ルーティング

**Files:**
- Create: `backend/app/controllers/api/v1/recommendations_controller.rb`
- Modify: `backend/config/routes.rb`
- Test: `backend/spec/requests/api/v1/recommendations_spec.rb`

- [ ] **Step 1: テストを書く**

```ruby
# backend/spec/requests/api/v1/recommendations_spec.rb
require 'rails_helper'

RSpec.describe 'Api::V1::Recommendations', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe 'GET /api/v1/recommendations' do
    context '未認証' do
      it '401を返す' do
        get '/api/v1/recommendations', as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context '認証済み' do
      before { sign_in user }

      context '記録がない場合' do
        it 'no_recordsステータスを返す' do
          get '/api/v1/recommendations', as: :json
          expect(response).to have_http_status(:ok)
          json = response.parsed_body
          expect(json['recommendation']).to be_nil
          expect(json['status']).to eq('no_records')
        end
      end

      context '記録が1〜4件の場合' do
        before do
          3.times do |i|
            work = Work.create!(title: "作品#{i}", media_type: 'anime')
            user.records.create!(work: work, status: :completed, rating: 8)
          end
        end

        it 'insufficient_recordsステータスを返す' do
          get '/api/v1/recommendations', as: :json
          json = response.parsed_body
          expect(json['status']).to eq('insufficient_records')
          expect(json['recommendation']['record_count']).to eq(3)
          expect(json['recommendation']['required_count']).to eq(5)
          expect(json['recommendation']['genre_stats']).not_to be_empty
        end
      end

      context 'DB に分析結果がある場合' do
        before do
          Recommendation.create!(
            user: user,
            analysis_summary: '保存済み分析',
            recommended_works: [{ 'title' => '作品A' }],
            challenge_works: [],
            record_count: 10,
            analyzed_at: Time.current
          )
        end

        it '保存済み結果を返す' do
          get '/api/v1/recommendations', as: :json
          expect(response).to have_http_status(:ok)
          json = response.parsed_body
          expect(json['status']).to eq('ready')
          expect(json['recommendation']['analysis']['summary']).to eq('保存済み分析')
          expect(json['recommendation']['recommended_works'].first['title']).to eq('作品A')
        end
      end
    end
  end

  describe 'POST /api/v1/recommendations/refresh' do
    context '未認証' do
      it '401を返す' do
        post '/api/v1/recommendations/refresh', as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context '認証済み' do
      before { sign_in user }

      it 'ジョブをキューに入れて202を返す' do
        expect {
          post '/api/v1/recommendations/refresh', as: :json
        }.to have_enqueued_job(RecommendationRefreshJob).with(user.id)

        expect(response).to have_http_status(:accepted)
        json = response.parsed_body
        expect(json['status']).to eq('processing')
      end
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd backend && bundle exec rspec spec/requests/api/v1/recommendations_spec.rb`
Expected: FAIL — ルーティングエラー

- [ ] **Step 3: ルーティングを追加**

`backend/config/routes.rb` の `namespace :v1` ブロック内に追加:

```ruby
resource :recommendations, only: [:show] do
  post :refresh, on: :collection
end
```

- [ ] **Step 4: コントローラーを実装**

```ruby
# backend/app/controllers/api/v1/recommendations_controller.rb
module Api
  module V1
    class RecommendationsController < ApplicationController
      before_action :authenticate_user!

      def show
        records_count = current_user.records.count

        if records_count.zero?
          return render json: { recommendation: nil, status: 'no_records' }
        end

        if records_count < PreferenceAnalyzer::MINIMUM_RECORDS
          return render json: {
            recommendation: {
              analysis: nil,
              recommended_works: [],
              challenge_works: [],
              genre_stats: genre_stats_for_user,
              record_count: records_count,
              required_count: PreferenceAnalyzer::MINIMUM_RECORDS
            },
            status: 'insufficient_records'
          }
        end

        recommendation = RecommendationService.new(current_user).fetch

        if recommendation.nil?
          RecommendationRefreshJob.perform_later(current_user.id)
          return render json: { recommendation: nil, status: 'generating' }
        end

        render json: {
          recommendation: format_recommendation(recommendation),
          status: 'ready'
        }
      end

      def refresh
        RecommendationRefreshJob.perform_later(current_user.id)
        render json: { message: '分析を開始しました', status: 'processing' }, status: :accepted
      end

      private

      def format_recommendation(rec)
        {
          analysis: {
            summary: rec.analysis_summary,
            preference_scores: rec.preference_scores,
            genre_stats: rec.genre_stats,
            top_tags: rec.top_tags
          },
          recommended_works: rec.recommended_works,
          challenge_works: rec.challenge_works,
          analyzed_at: rec.analyzed_at&.iso8601,
          record_count: rec.record_count
        }
      end

      def genre_stats_for_user
        current_user.records.joins(:work)
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

- [ ] **Step 5: テストを実行してパスを確認**

Run: `cd backend && bundle exec rspec spec/requests/api/v1/recommendations_spec.rb`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add backend/app/controllers/api/v1/recommendations_controller.rb backend/config/routes.rb backend/spec/requests/api/v1/recommendations_spec.rb
git commit -m "feat: RecommendationsController + ルーティングを実装"
```

---

## Task 8: フロントエンド — 型定義 + APIクライアント

**Files:**
- Create: `frontend/src/types/recommendation.ts`
- Create: `frontend/src/lib/recommendationsApi.ts`

- [ ] **Step 1: 型定義を作成**

```typescript
// frontend/src/types/recommendation.ts

export interface PreferenceScore {
  label: string
  score: number
}

export interface GenreStat {
  media_type: string
  count: number
  avg_rating: number | null
}

export interface TagStat {
  name: string
  count: number
}

export interface RecommendedWork {
  title: string
  media_type: string
  description: string
  cover_url: string | null
  reason: string
  external_api_id: string
  external_api_source: string
  metadata: Record<string, unknown>
}

export interface RecommendationAnalysis {
  summary: string
  preference_scores: PreferenceScore[]
  genre_stats: GenreStat[]
  top_tags: TagStat[]
}

export interface RecommendationData {
  analysis: RecommendationAnalysis | null
  recommended_works: RecommendedWork[]
  challenge_works: RecommendedWork[]
  analyzed_at: string | null
  record_count: number
  required_count?: number
  genre_stats?: GenreStat[]
}

export type RecommendationStatus =
  | 'ready'
  | 'no_records'
  | 'insufficient_records'
  | 'generating'

export interface RecommendationResponse {
  recommendation: RecommendationData | null
  status: RecommendationStatus
}

export interface RefreshResponse {
  message: string
  status: string
}
```

- [ ] **Step 2: APIクライアントを作成**

```typescript
// frontend/src/lib/recommendationsApi.ts
import { request } from './api'
import type { RecommendationResponse, RefreshResponse } from '../types/recommendation'

export const recommendationsApi = {
  get(): Promise<RecommendationResponse> {
    return request<RecommendationResponse>('/recommendations')
  },

  refresh(): Promise<RefreshResponse> {
    return request<RefreshResponse>('/recommendations/refresh', {
      method: 'POST',
    })
  },
}
```

- [ ] **Step 3: コミット**

```bash
git add frontend/src/types/recommendation.ts frontend/src/lib/recommendationsApi.ts
git commit -m "feat: おすすめ機能の型定義とAPIクライアントを追加"
```

---

## Task 9: フロントエンド — useRecommendations hook

**Files:**
- Create: `frontend/src/hooks/useRecommendations.ts`

- [ ] **Step 1: hookを実装**

```typescript
// frontend/src/hooks/useRecommendations.ts
import { useState, useCallback, useEffect } from 'react'
import { recommendationsApi } from '../lib/recommendationsApi'
import type {
  RecommendationData,
  RecommendationStatus,
} from '../types/recommendation'

export function useRecommendations() {
  const [data, setData] = useState<RecommendationData | null>(null)
  const [status, setStatus] = useState<RecommendationStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await recommendationsApi.get()
      setData(response.recommendation)
      setStatus(response.status)
    } catch {
      setError('おすすめの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRecommendations()
  }, [fetchRecommendations])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      await recommendationsApi.refresh()
      setStatus('generating')
    } catch {
      setError('分析の更新に失敗しました')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  const pollForResult = useCallback(async () => {
    if (status !== 'generating') return

    try {
      const response = await recommendationsApi.get()
      if (response.status === 'ready') {
        setData(response.recommendation)
        setStatus('ready')
      }
    } catch {
      // ポーリング中のエラーは無視
    }
  }, [status])

  useEffect(() => {
    if (status !== 'generating') return

    const interval = setInterval(() => {
      void pollForResult()
    }, 5000)

    return () => clearInterval(interval)
  }, [status, pollForResult])

  return { data, status, isLoading, isRefreshing, error, refresh, refetch: fetchRecommendations }
}
```

- [ ] **Step 2: コミット**

```bash
git add frontend/src/hooks/useRecommendations.ts
git commit -m "feat: useRecommendations hookを実装"
```

---

## Task 10: フロントエンド — RecommendationsPage + コンポーネント

**Files:**
- Create: `frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx`
- Create: `frontend/src/pages/RecommendationsPage/RecommendationsPage.module.css`
- Create: `frontend/src/pages/RecommendationsPage/AnalysisSummaryCard.tsx`
- Create: `frontend/src/pages/RecommendationsPage/AnalysisDetail.tsx`
- Create: `frontend/src/pages/RecommendationsPage/RecommendedWorkCard.tsx`
- Test: `frontend/src/pages/RecommendationsPage/RecommendationsPage.test.tsx`

このタスクは `frontend-design:frontend-design` スキルを使って実装する。スペックの「フロントエンドUI設計」セクションとVisual Companionのモックアップ（`.superpowers/brainstorm/1279-1775356769/content/final-design-v2.html` および `edge-cases-ux.html`）を参照すること。

- [ ] **Step 1: テストを書く**

```tsx
// frontend/src/pages/RecommendationsPage/RecommendationsPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecommendationsPage } from './RecommendationsPage'
import { recommendationsApi } from '../../lib/recommendationsApi'

vi.mock('../../lib/recommendationsApi')
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, username: 'testuser' } }),
}))

const mockReadyResponse = {
  recommendation: {
    analysis: {
      summary: 'テスト分析サマリー',
      preference_scores: [{ label: 'キャラクター重視', score: 9.2 }],
      genre_stats: [{ media_type: 'anime', count: 24, avg_rating: 8.2 }],
      top_tags: [{ name: '名作', count: 12 }],
    },
    recommended_works: [
      {
        title: '葬送のフリーレン',
        media_type: 'anime',
        description: 'テスト説明',
        cover_url: null,
        reason: 'テスト理由',
        external_api_id: '154587',
        external_api_source: 'anilist',
        metadata: {},
      },
    ],
    challenge_works: [
      {
        title: 'コンビニ人間',
        media_type: 'book',
        description: 'テスト説明',
        cover_url: null,
        reason: 'チャレンジ理由',
        external_api_id: '123',
        external_api_source: 'google_books',
        metadata: {},
      },
    ],
    analyzed_at: '2026-04-05T14:30:00+09:00',
    record_count: 70,
  },
  status: 'ready' as const,
}

describe('RecommendationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常時: 分析サマリーとおすすめ作品を表示する', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('テスト分析サマリー')).toBeInTheDocument()
    })
    expect(screen.getByText('葬送のフリーレン')).toBeInTheDocument()
    expect(screen.getByText('テスト理由')).toBeInTheDocument()
    expect(screen.getByText('コンビニ人間')).toBeInTheDocument()
  })

  it('記録0件: 空状態を表示する', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue({
      recommendation: null,
      status: 'no_records',
    })

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('作品を記録しておすすめを受け取ろう')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: '作品を検索する' })).toBeInTheDocument()
  })

  it('記録不足: プログレスバーを表示する', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue({
      recommendation: {
        analysis: null,
        recommended_works: [],
        challenge_works: [],
        genre_stats: [{ media_type: 'anime', count: 2, avg_rating: 8.0 }],
        record_count: 2,
        required_count: 5,
        analyzed_at: null,
      },
      status: 'insufficient_records',
    })

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/あと3件/)).toBeInTheDocument()
    })
  })

  it('エラー時: エラーメッセージとリトライボタンを表示する', async () => {
    vi.mocked(recommendationsApi.get).mockRejectedValue(new Error('Network error'))

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('おすすめの取得に失敗しました')).toBeInTheDocument()
    })
  })

  it('アコーディオン: 詳細を展開・閉じるできる', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)

    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('テスト分析サマリー')).toBeInTheDocument()
    })

    expect(screen.queryByText('ジャンル別統計')).not.toBeInTheDocument()

    await user.click(screen.getByText('好み分析の詳細を見る'))
    expect(screen.getByText('ジャンル別統計')).toBeInTheDocument()
  })

  it('更新ボタン: refresh APIを呼び出す', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)
    vi.mocked(recommendationsApi.refresh).mockResolvedValue({
      message: '分析を開始しました',
      status: 'processing',
    })

    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('分析を更新')).toBeInTheDocument()
    })

    await user.click(screen.getByText('分析を更新'))
    expect(recommendationsApi.refresh).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd frontend && npx vitest run src/pages/RecommendationsPage/RecommendationsPage.test.tsx`
Expected: FAIL — モジュールが存在しない

- [ ] **Step 3: コンポーネントを実装**

`frontend-design:frontend-design` スキルを使用して、Visual Companionのモックアップに合わせた以下のコンポーネントを実装する:

1. `RecommendationsPage.tsx` — ページ本体。`useRecommendations` hookを使い、status に応じて4つの状態（no_records, insufficient_records, generating, ready）を分岐表示
2. `RecommendationsPage.module.css` — tokens.cssのCSS変数のみ使用
3. `AnalysisSummaryCard.tsx` — サマリーカード + アコーディオン展開ボタン
4. `AnalysisDetail.tsx` — 展開される詳細（ジャンル統計グリッド、傾向スコアバー、タグリスト）
5. `RecommendedWorkCard.tsx` — おすすめ作品カード（カバー、タイトル、ジャンルバッジ、理由、記録ボタン）

**実装の要件:**
- 既存の共通コンポーネント（SectionTitle, Badge, Button）を使用
- 記録ボタンクリック時は既存の RecordModal を再利用（SearchPage のパターンを参照）
- カバー画像クリックで `/works/:id` へ遷移（外部APIからの作品は先にWork作成が必要なためrecordsApi.createFromSearchResult のパターンを参照）
- レスポンシブ対応（768px以下でジャンル統計グリッドを2列に）

- [ ] **Step 4: テストを実行してパスを確認**

Run: `cd frontend && npx vitest run src/pages/RecommendationsPage/RecommendationsPage.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/RecommendationsPage/
git commit -m "feat: RecommendationsPageとサブコンポーネントを実装"
```

---

## Task 11: フロントエンド — ルーティング + ナビゲーション統合

**Files:**
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/components/NavBar/NavBar.tsx`
- Modify: `frontend/src/components/BottomTabBar/BottomTabBar.tsx`

- [ ] **Step 1: router.tsx にルートを追加**

`frontend/src/router.tsx` の既存のルート定義に追加:

```tsx
import { RecommendationsPage } from './pages/RecommendationsPage/RecommendationsPage'

// 既存のroutes配列内に追加
{ path: '/recommendations', element: <RecommendationsPage /> }
```

- [ ] **Step 2: NavBar にリンクを追加**

`frontend/src/components/NavBar/NavBar.tsx` の既存のナビゲーションリンク一覧に「おすすめ」を追加。既存のリンク（ホーム、検索、ライブラリ、コミュニティ）の並びに合わせて追加する。

仕様書（`docs/superpowers/specs/2026-03-20-recolly-design.md`）のナビゲーション定義:
```
ホーム | 検索 | ライブラリ | コミュニティ | おすすめ | マイページ
```

- [ ] **Step 3: BottomTabBar にタブを追加**

`frontend/src/components/BottomTabBar/BottomTabBar.tsx` にもおすすめタブを追加。既存のタブ数が4つの場合、5つに増やす（BottomTabBar のmax 5制限内）。

- [ ] **Step 4: 動作確認用にビルドが通ることを確認**

Run: `cd frontend && npx tsc --noEmit`
Expected: 型エラーなし

- [ ] **Step 5: コミット**

```bash
git add frontend/src/router.tsx frontend/src/components/NavBar/ frontend/src/components/BottomTabBar/
git commit -m "feat: おすすめページのルーティングとナビゲーション統合"
```

---

## Task 12: 全体テスト + RuboCop/ESLint

- [ ] **Step 1: バックエンドの全テスト実行**

Run: `cd backend && bundle exec rspec`
Expected: ALL PASS

- [ ] **Step 2: RuboCop実行**

Run: `cd backend && bundle exec rubocop`
Expected: 違反なし（あれば修正）

- [ ] **Step 3: フロントエンドの全テスト実行**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: ESLint + Prettier実行**

Run: `cd frontend && npx eslint src/ && npx prettier --check src/`
Expected: 違反なし（あれば修正）

- [ ] **Step 5: 最終コミット（修正があった場合のみ）**

```bash
git add -A
git commit -m "fix: lint違反を修正"
```
