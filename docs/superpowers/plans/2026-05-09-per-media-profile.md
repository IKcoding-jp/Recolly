# per-media 好みプロファイル 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** おすすめページにメディア別タブを追加し、メディアごとの好みプロファイルとクロスメディアおすすめを表示する。

**Architecture:** バックエンドは `media_preference_profiles` テーブルを新設し、`MediaPreferenceAnalyzer` が Claude API を呼んでメディア特化分析を行う。`MediaProfileRefreshJob` がオーケストレーターとして各メディアを並列ジョブ実行する。フロントエンドは `useMediaProfiles` hook で GET /api/v1/media_preference_profiles を取得し、新コンポーネント群（MediaTabBar / MediaTabContent）を使ってタブ表示に切り替える。

**Tech Stack:** Ruby 3.3 / Rails 8 API / Anthropic Ruby SDK / RSpec / React 19 / TypeScript / Vitest / React Testing Library / Docker Compose

---

## ファイル構成

### 新規作成（バックエンド）
- `db/migrate/YYYYMMDDHHMMSS_create_media_preference_profiles.rb`
- `app/models/media_preference_profile.rb`
- `app/services/media_preference_prompt_builder.rb`
- `app/services/media_preference_analyzer.rb`
- `app/jobs/media_profile_refresh_job.rb`
- `app/controllers/api/v1/media_preference_profiles_controller.rb`
- `spec/models/media_preference_profile_spec.rb`
- `spec/services/media_preference_prompt_builder_spec.rb`
- `spec/services/media_preference_analyzer_spec.rb`
- `spec/jobs/media_profile_refresh_job_spec.rb`
- `spec/requests/api/v1/media_preference_profiles_spec.rb`

### 変更（バックエンド）
- `config/routes.rb` — `resources :media_preference_profiles, only: [:index]` を追加
- `app/controllers/api/v1/recommendations_controller.rb` — `refresh` と `render_recommendation` に `MediaProfileRefreshJob` を追加

### 新規作成（フロントエンド）
- `frontend/src/types/mediaPreferenceProfile.ts`
- `frontend/src/lib/mediaPreferenceProfilesApi.ts`
- `frontend/src/hooks/useMediaProfiles.ts`
- `frontend/src/hooks/useMediaProfiles.test.ts`
- `frontend/src/pages/RecommendationsPage/MediaAnalysisSummaryCard.tsx`
- `frontend/src/pages/RecommendationsPage/MediaAnalysisSummaryCard.test.tsx`
- `frontend/src/pages/RecommendationsPage/MediaTabBar.tsx`
- `frontend/src/pages/RecommendationsPage/MediaTabBar.test.tsx`
- `frontend/src/pages/RecommendationsPage/MediaTabContent.tsx`
- `frontend/src/pages/RecommendationsPage/MediaTabContent.test.tsx`

### 変更（フロントエンド）
- `frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx` — タブ追加
- `frontend/src/pages/RecommendationsPage/RecommendationsPage.module.css` — タブスタイル追加
- `frontend/src/pages/RecommendationsPage/RecommendationsPage.test.tsx` — 既存テスト維持確認

---

## Task 1: DBマイグレーション + MediaPreferenceProfileモデル

**Files:**
- Create: `db/migrate/YYYYMMDDHHMMSS_create_media_preference_profiles.rb`（rails generateで生成）
- Create: `app/models/media_preference_profile.rb`
- Create: `spec/models/media_preference_profile_spec.rb`

- [ ] **Step 1: マイグレーションを生成する**

```bash
docker compose run --rm backend bin/rails generate migration CreateMediaPreferenceProfiles
```

生成されたファイルを以下の内容に書き換える（`db/migrate/YYYYMMDDHHMMSS_create_media_preference_profiles.rb`）:

```ruby
class CreateMediaPreferenceProfiles < ActiveRecord::Migration[8.0]
  def change
    create_table :media_preference_profiles do |t|
      t.references :user, null: false, foreign_key: true
      t.integer :media_type, null: false
      t.text :analysis_summary
      t.jsonb :preference_scores, default: []
      t.jsonb :top_tags, default: []
      t.jsonb :same_media_works, default: []
      t.jsonb :cross_media_works, default: []
      t.integer :record_count, default: 0
      t.datetime :analyzed_at
      t.timestamps
    end

    add_index :media_preference_profiles, [:user_id, :media_type], unique: true
  end
end
```

- [ ] **Step 2: マイグレーションを実行する**

```bash
docker compose run --rm backend bin/rails db:migrate
docker compose run --rm -e RAILS_ENV=test backend bin/rails db:migrate
```

期待: エラーなく完了

- [ ] **Step 3: モデルspecを書く**

`spec/models/media_preference_profile_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe MediaPreferenceProfile, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe 'バリデーション' do
    it 'user_id + media_type の組み合わせはユニークであること' do
      MediaPreferenceProfile.create!(user: user, media_type: :anime, record_count: 5)
      duplicate = MediaPreferenceProfile.new(user: user, media_type: :anime, record_count: 3)
      expect(duplicate).not_to be_valid
    end

    it '同一ユーザーで異なるmedia_typeは作成できること' do
      MediaPreferenceProfile.create!(user: user, media_type: :anime, record_count: 5)
      other = MediaPreferenceProfile.new(user: user, media_type: :movie, record_count: 4)
      expect(other).to be_valid
    end
  end

  describe 'jsonbカラム' do
    it 'preference_scoresを読み書きできること' do
      scores = [{ 'label' => '感情的な深さ', 'score' => 9.1 }]
      profile = MediaPreferenceProfile.create!(user: user, media_type: :anime, preference_scores: scores, record_count: 5)
      expect(profile.reload.preference_scores).to eq(scores)
    end

    it 'same_media_worksを読み書きできること' do
      works = [{ 'title' => '葬送のフリーレン', 'media_type' => 'anime' }]
      profile = MediaPreferenceProfile.create!(user: user, media_type: :anime, same_media_works: works, record_count: 5)
      expect(profile.reload.same_media_works).to eq(works)
    end
  end
end
```

- [ ] **Step 4: テストが失敗することを確認する**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/media_preference_profile_spec.rb -f doc
```

期待: `MediaPreferenceProfile` is not defined（モデルがないため失敗）

- [ ] **Step 5: モデルを実装する**

`app/models/media_preference_profile.rb`:

```ruby
class MediaPreferenceProfile < ApplicationRecord
  belongs_to :user

  enum :media_type, {
    anime: 0,
    movie: 1,
    drama: 2,
    book: 3,
    manga: 4,
    game: 5
  }

  validates :media_type, presence: true
  validates :user_id, uniqueness: { scope: :media_type }
end
```

- [ ] **Step 6: テストが通ることを確認する**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/media_preference_profile_spec.rb -f doc
```

期待: 3 examples, 0 failures

- [ ] **Step 7: コミット**

```bash
git add db/migrate/ app/models/media_preference_profile.rb spec/models/media_preference_profile_spec.rb
git commit -m "feat: media_preference_profilesテーブルとモデルを追加"
```

---

## Task 2: MediaPreferencePromptBuilder

**Files:**
- Create: `app/services/media_preference_prompt_builder.rb`
- Create: `spec/services/media_preference_prompt_builder_spec.rb`

- [ ] **Step 1: specを書く**

`spec/services/media_preference_prompt_builder_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe MediaPreferencePromptBuilder do
  let(:media_type) { 'anime' }
  let(:data) do
    {
      media_type: 'anime',
      record_count: 10,
      avg_rating: 8.2,
      top_rated: [
        { title: 'ヴァイオレット・エヴァーガーデン', rating: 9, genres: ['Drama', 'Fantasy'] }
      ],
      dropped: [],
      tag_stats: [{ name: '泣ける', count: 5, avg_rating: 8.9 }],
      review_excerpts: ['伏線回収が見事'],
      favorites: []
    }
  end

  subject(:prompt) { described_class.new(data).build }

  it 'メディア種別名が含まれること' do
    expect(prompt).to include('アニメ')
  end

  it '高評価作品のタイトルが含まれること' do
    expect(prompt).to include('ヴァイオレット・エヴァーガーデン')
  end

  it 'タグが含まれること' do
    expect(prompt).to include('泣ける')
  end

  it '感想テキストが含まれること' do
    expect(prompt).to include('伏線回収が見事')
  end

  it 'same_media_keywordsの出力フォーマットが含まれること' do
    expect(prompt).to include('same_media_keywords')
  end

  it 'cross_media_keywordsの出力フォーマットが含まれること' do
    expect(prompt).to include('cross_media_keywords')
  end

  context '断念作品がない場合' do
    it '断念セクションを含まないこと' do
      expect(prompt).not_to include('断念した作品')
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/media_preference_prompt_builder_spec.rb -f doc
```

期待: `MediaPreferencePromptBuilder` is not defined

- [ ] **Step 3: 実装する**

`app/services/media_preference_prompt_builder.rb`:

```ruby
class MediaPreferencePromptBuilder
  MEDIA_TYPE_JA = {
    'anime' => 'アニメ',
    'movie' => '映画',
    'drama' => 'ドラマ',
    'book' => '本',
    'manga' => '漫画',
    'game' => 'ゲーム'
  }.freeze
  def initialize(data)
    @data = data
  end

  def build
    collect_sections.join("\n")
  end

  private

  def collect_sections
    media_ja = MEDIA_TYPE_JA[@data[:media_type]] || @data[:media_type]
    optional = {
      dropped: :dropped_section,
      tag_stats: :tags_section,
      review_excerpts: :reviews_section,
      favorites: :favorites_section
    }
    extras = optional.filter_map { |key, method| send(method) if @data[key].any? }
    [base_section(media_ja), *extras, output_instructions(media_ja)]
  end

  def base_section(media_ja)
    top_lines = @data[:top_rated].map do |w|
      genres = w[:genres].join(', ')
      "#{w[:title]} (#{w[:rating]}点, ジャンル: #{genres})"
    end

    <<~PROMPT
      あなたはメディア作品のレコメンドアナリストです。
      以下は「#{media_ja}」ジャンルのみの記録データです。

      ■ 記録統計: #{@data[:record_count]}件 / 平均#{@data[:avg_rating]}点

      ■ 高評価作品TOP5:
      #{top_lines.join("\n")}
    PROMPT
  end

  def dropped_section
    lines = @data[:dropped].map { |w| "#{w[:title]} (#{w[:rating]}点)" }
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
    lines = @data[:favorites].map { |f| "#{f[:title]} (ジャンル: #{f[:genres].join(', ')})" }
    <<~SECTION
      ■ お気に入り作品:
      #{lines.join("\n")}
    SECTION
  end

  def output_instructions(media_ja)
    other_media = (MEDIA_TYPE_JA.keys - [@data[:media_type]]).map { |k| MEDIA_TYPE_JA[k] }.join(', ')

    <<~INSTRUCTIONS
      以下をJSON形式で出力してください。

      {
        "summary": "#{media_ja}での好み傾向（200字程度）。具体的な作品名や感想を引用すること。",
        "preference_scores": [
          { "label": "嗜好の軸名", "score": 1.0〜10.0 }
        ],
        "same_media_keywords": [
          { "query": "具体的な#{media_ja}作品タイトル1つ", "reason": "おすすめ理由（ユーザーの作品名・評価を引用）" }
        ],
        "cross_media_keywords": [
          { "media_type": "他メディア名（#{other_media}のいずれか）", "query": "具体的な作品タイトル1つ", "reason": "#{media_ja}好みから他メディアをおすすめする理由" }
        ]
      }

      重要なルール:
      - preference_scoresは5項目
      - same_media_keywordsは5件（queryは実在する#{media_ja}作品タイトル）
      - cross_media_keywordsは3件（queryは実在する作品タイトル、media_typeは#{other_media}から選ぶ）
      - reasonは各作品ごとに異なる内容にすること
      - JSONのみ出力し、それ以外のテキストは含めないでください
    INSTRUCTIONS
  end
end
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/media_preference_prompt_builder_spec.rb -f doc
```

期待: 7 examples, 0 failures

- [ ] **Step 5: コミット**

```bash
git add app/services/media_preference_prompt_builder.rb spec/services/media_preference_prompt_builder_spec.rb
git commit -m "feat: MediaPreferencePromptBuilderを追加（メディア特化プロンプト生成）"
```

---

## Task 3: MediaPreferenceAnalyzer

**Files:**
- Create: `app/services/media_preference_analyzer.rb`
- Create: `spec/services/media_preference_analyzer_spec.rb`

- [ ] **Step 1: specを書く**

`spec/services/media_preference_analyzer_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe MediaPreferenceAnalyzer do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  def create_anime_records(count)
    count.times do |i|
      work = Work.create!(title: "アニメ#{i}", media_type: :anime)
      user.records.create!(work: work, status: :completed, rating: 8)
    end
  end

  describe '#analyze_and_save' do
    context '記録が3件未満の場合' do
      before { create_anime_records(2) }

      it 'nilを返してDBに保存しないこと' do
        analyzer = described_class.new(user, 'anime')
        result = analyzer.analyze_and_save
        expect(result).to be_nil
        expect(MediaPreferenceProfile.count).to eq(0)
      end
    end

    context '記録が3件以上の場合' do
      before { create_anime_records(5) }

      let(:mock_response) do
        double('response', content: [double('content', text: JSON.generate({
          'summary' => 'アニメの好み傾向テキスト',
          'preference_scores' => [{ 'label' => '感情的な深さ', 'score' => 9.1 }],
          'same_media_keywords' => [{ 'query' => '葬送のフリーレン', 'reason' => 'テスト理由' }],
          'cross_media_keywords' => [{ 'media_type' => 'manga', 'query' => 'ナウシカ', 'reason' => 'クロス理由' }]
        }))])
      end

      let(:mock_search_result) do
        double('work',
          title: '葬送のフリーレン',
          media_type: 'anime',
          description: 'テスト説明',
          cover_image_url: nil,
          external_api_id: '154587',
          external_api_source: 'anilist',
          metadata: {}
        )
      end

      before do
        allow_any_instance_of(Anthropic::Client).to receive_message_chain(:messages, :create).and_return(mock_response)
        allow_any_instance_of(WorkSearchService).to receive(:search).and_return([mock_search_result])
      end

      it 'MediaPreferenceProfileをDBに保存すること' do
        described_class.new(user, 'anime').analyze_and_save
        profile = MediaPreferenceProfile.find_by(user: user, media_type: :anime)
        expect(profile).not_to be_nil
        expect(profile.analysis_summary).to eq('アニメの好み傾向テキスト')
        expect(profile.preference_scores).to eq([{ 'label' => '感情的な深さ', 'score' => 9.1 }])
      end

      it 'same_media_worksに作品が保存されること' do
        described_class.new(user, 'anime').analyze_and_save
        profile = MediaPreferenceProfile.find_by(user: user, media_type: :anime)
        expect(profile.same_media_works).not_to be_empty
        expect(profile.same_media_works.first['title']).to eq('葬送のフリーレン')
      end

      it '再実行時は既存レコードを上書きすること' do
        described_class.new(user, 'anime').analyze_and_save
        described_class.new(user, 'anime').analyze_and_save
        expect(MediaPreferenceProfile.where(user: user, media_type: :anime).count).to eq(1)
      end
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/media_preference_analyzer_spec.rb -f doc
```

期待: `MediaPreferenceAnalyzer` is not defined

- [ ] **Step 3: 実装する**

`app/services/media_preference_analyzer.rb`:

```ruby
class MediaPreferenceAnalyzer
  MINIMUM_RECORDS = 3
  MAX_TOP_RATED = 5
  MAX_DROPPED = 3
  MAX_REVIEW_EXCERPTS = 10
  MAX_EXCERPT_LENGTH = 100

  def initialize(user, media_type)
    @user = user
    @media_type = media_type
    @records = user.records.joins(:work)
                   .where(works: { media_type: Work.media_types[@media_type] })
                   .includes(:work, :tags, :episode_reviews)
  end

  def analyze_and_save
    return nil if @records.count < MINIMUM_RECORDS

    data = collect_data
    analysis = call_claude_api(data)
    return nil if analysis.nil?

    works = search_works(analysis)
    save_result(analysis, works)
  end

  private

  def collect_data
    {
      media_type: @media_type,
      record_count: @records.count,
      avg_rating: @records.average(:rating)&.round(1)&.to_f || 0.0,
      top_rated: top_rated_works,
      dropped: dropped_works,
      tag_stats: tag_stats,
      review_excerpts: review_excerpts,
      favorites: []
    }
  end

  def top_rated_works
    @records.where.not(rating: nil)
            .order(rating: :desc, updated_at: :desc)
            .limit(MAX_TOP_RATED)
            .map { |r| { title: r.work.title, rating: r.rating, genres: r.work.metadata&.dig('genres') || [] } }
  end

  def dropped_works
    @records.where(status: :dropped)
            .order(updated_at: :desc)
            .limit(MAX_DROPPED)
            .map { |r| { title: r.work.title, rating: r.rating } }
  end

  def tag_stats
    Tag.joins(record_tags: { record: :work })
       .where(records: { user_id: @user.id })
       .where(works: { media_type: Work.media_types[@media_type] })
       .group('tags.name')
       .select('tags.name', 'COUNT(*) as usage_count', 'AVG(records.rating) as avg_rating')
       .order(usage_count: :desc)
       .limit(5)
       .map { |t| { name: t.name, count: t.usage_count, avg_rating: t.avg_rating&.round(1)&.to_f } }
  end

  def review_excerpts
    EpisodeReview.joins(record: :user)
                 .joins(record: :work)
                 .where(records: { user_id: @user.id })
                 .where(works: { media_type: Work.media_types[@media_type] })
                 .where.not(body: [nil, ''])
                 .order(created_at: :desc)
                 .limit(MAX_REVIEW_EXCERPTS)
                 .pluck(:body)
                 .map { |body| body.truncate(MAX_EXCERPT_LENGTH) }
  end

  def call_claude_api(data)
    client = Anthropic::Client.new(api_key: ENV.fetch('ANTHROPIC_API_KEY'))
    prompt = MediaPreferencePromptBuilder.new(data).build
    response = client.messages.create(
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    )
    parse_response(response)
  rescue StandardError => e
    Rails.logger.error("[MediaPreferenceAnalyzer] #{@media_type}のClaude API呼び出し失敗: #{e.message}")
    nil
  end

  def parse_response(response)
    text = response.content[0].text.strip
    text = text.sub(/\A```json\s*\n?/, '').sub(/\n?```\s*\z/, '')
    JSON.parse(text)
  rescue JSON::ParserError => e
    Rails.logger.error("[MediaPreferenceAnalyzer] JSON解析エラー: #{e.message}")
    nil
  end

  def search_works(analysis)
    same_keywords = (analysis['same_media_keywords'] || []).map do |k|
      k.merge('media_type' => @media_type)
    end
    cross_keywords = analysis['cross_media_keywords'] || []

    adapted = {
      search_keywords: {
        'recommended' => same_keywords,
        'challenge' => cross_keywords
      }
    }
    WorkRecommender.new(@user, adapted).recommend
  end

  def save_result(analysis, works)
    attributes = {
      analysis_summary: analysis['summary'],
      preference_scores: analysis['preference_scores'] || [],
      top_tags: [],
      same_media_works: stringify_keys(works[:recommended_works]),
      cross_media_works: stringify_keys(works[:challenge_works]),
      record_count: @records.count,
      analyzed_at: Time.current
    }

    profile = MediaPreferenceProfile.find_or_initialize_by(
      user: @user,
      media_type: Work.media_types[@media_type]
    )
    profile.update!(attributes)
    profile
  end

  def stringify_keys(array)
    array.map { |item| item.transform_keys(&:to_s) }
  end
end
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/media_preference_analyzer_spec.rb -f doc
```

期待: 5 examples, 0 failures

- [ ] **Step 5: コミット**

```bash
git add app/services/media_preference_analyzer.rb spec/services/media_preference_analyzer_spec.rb
git commit -m "feat: MediaPreferenceAnalyzerを追加（メディア別Claude API分析）"
```

---

## Task 4: MediaProfileRefreshJob

**Files:**
- Create: `app/jobs/media_profile_refresh_job.rb`
- Create: `spec/jobs/media_profile_refresh_job_spec.rb`

- [ ] **Step 1: specを書く**

`spec/jobs/media_profile_refresh_job_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe MediaProfileRefreshJob, type: :job do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe '#perform' do
    context 'media_typeなし（オーケストレーターモード）' do
      before do
        # アニメ記録を3件作成
        3.times do |i|
          work = Work.create!(title: "アニメ#{i}", media_type: :anime)
          user.records.create!(work: work, status: :completed, rating: 8)
        end
        # 映画記録は2件（3件未満）
        2.times do |i|
          work = Work.create!(title: "映画#{i}", media_type: :movie)
          user.records.create!(work: work, status: :completed, rating: 7)
        end
      end

      it '記録が3件以上のメディアのみジョブをエンキューすること' do
        expect(MediaProfileRefreshJob).to receive(:perform_later).with(user.id, 'anime')
        expect(MediaProfileRefreshJob).not_to receive(:perform_later).with(user.id, 'movie')
        expect(MediaProfileRefreshJob).not_to receive(:perform_later).with(user.id, 'drama')

        described_class.perform_now(user.id)
      end
    end

    context 'media_typeあり（単一メディア処理モード）' do
      it 'MediaPreferenceAnalyzer#analyze_and_saveを呼び出すこと' do
        analyzer = instance_double(MediaPreferenceAnalyzer)
        allow(MediaPreferenceAnalyzer).to receive(:new).with(user, 'anime').and_return(analyzer)
        expect(analyzer).to receive(:analyze_and_save)

        described_class.perform_now(user.id, 'anime')
      end
    end

    context '存在しないuser_idの場合' do
      it 'エラーを起こさず終了すること' do
        expect { described_class.perform_now(99999) }.not_to raise_error
      end
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/jobs/media_profile_refresh_job_spec.rb -f doc
```

期待: `MediaProfileRefreshJob` is not defined

- [ ] **Step 3: 実装する**

`app/jobs/media_profile_refresh_job.rb`:

```ruby
class MediaProfileRefreshJob < ApplicationJob
  queue_as :default

  def perform(user_id, media_type = nil)
    user = User.find_by(id: user_id)
    return if user.nil?

    if media_type.nil?
      eligible_media_types(user).each do |mt|
        self.class.perform_later(user_id, mt)
      end
    else
      MediaPreferenceAnalyzer.new(user, media_type).analyze_and_save
      Rails.logger.info("[MediaProfileRefreshJob] #{media_type}の分析完了（ユーザー#{user_id}）")
    end
  rescue StandardError => e
    Rails.logger.error("[MediaProfileRefreshJob] 失敗（ユーザー#{user_id}, #{media_type}）: #{e.message}")
    raise
  end

  private

  def eligible_media_types(user)
    Work.media_types.keys.select do |mt|
      user.records.joins(:work)
                  .where(works: { media_type: Work.media_types[mt] })
                  .count >= MediaPreferenceAnalyzer::MINIMUM_RECORDS
    end
  end
end
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/jobs/media_profile_refresh_job_spec.rb -f doc
```

期待: 3 examples, 0 failures

- [ ] **Step 5: コミット**

```bash
git add app/jobs/media_profile_refresh_job.rb spec/jobs/media_profile_refresh_job_spec.rb
git commit -m "feat: MediaProfileRefreshJobを追加（メディア別分析の非同期実行）"
```

---

## Task 5: MediaPreferenceProfilesController + ルーティング

**Files:**
- Create: `app/controllers/api/v1/media_preference_profiles_controller.rb`
- Create: `spec/requests/api/v1/media_preference_profiles_spec.rb`
- Modify: `config/routes.rb`

- [ ] **Step 1: request specを書く**

`spec/requests/api/v1/media_preference_profiles_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe 'Api::V1::MediaPreferenceProfiles', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe 'GET /api/v1/media_preference_profiles' do
    it '未認証なら401を返す' do
      get '/api/v1/media_preference_profiles', as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    context '認証済み — 記録がない場合' do
      before { sign_in user }

      it '6メディア全てno_recordsで返すこと' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        expect(json.length).to eq(6)
        expect(json.all? { |p| p['status'] == 'no_records' }).to be true
      end

      it 'media_typeの順序がanime/movie/drama/book/manga/gameであること' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        expect(json.map { |p| p['media_type'] }).to eq(%w[anime movie drama book manga game])
      end
    end

    context '認証済み — アニメ記録が2件（不足）の場合' do
      before do
        sign_in user
        2.times do |i|
          work = Work.create!(title: "アニメ#{i}", media_type: :anime)
          user.records.create!(work: work, status: :completed, rating: 8)
        end
      end

      it 'アニメがinsufficient_recordsで返ること' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        anime = json.find { |p| p['media_type'] == 'anime' }
        expect(anime['status']).to eq('insufficient_records')
        expect(anime['record_count']).to eq(2)
        expect(anime['required_count']).to eq(3)
      end
    end

    context '認証済み — アニメのプロファイルがDBにある場合' do
      before do
        sign_in user
        5.times do |i|
          work = Work.create!(title: "アニメ#{i}", media_type: :anime)
          user.records.create!(work: work, status: :completed, rating: 8)
        end
        MediaPreferenceProfile.create!(
          user: user,
          media_type: :anime,
          analysis_summary: 'テスト分析',
          preference_scores: [{ 'label' => '感情', 'score' => 9.0 }],
          same_media_works: [{ 'title' => '葬送のフリーレン' }],
          cross_media_works: [],
          top_tags: [],
          record_count: 5,
          analyzed_at: Time.current
        )
      end

      it 'アニメがreadyで分析結果を返すこと' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        anime = json.find { |p| p['media_type'] == 'anime' }
        expect(anime['status']).to eq('ready')
        expect(anime['analysis_summary']).to eq('テスト分析')
        expect(anime['same_media_works'].first['title']).to eq('葬送のフリーレン')
      end
    end

    context '認証済み — アニメ記録は3件以上だがプロファイルなし' do
      before do
        sign_in user
        3.times do |i|
          work = Work.create!(title: "アニメ#{i}", media_type: :anime)
          user.records.create!(work: work, status: :completed, rating: 8)
        end
      end

      it 'アニメがgeneratingを返すこと' do
        get '/api/v1/media_preference_profiles', as: :json
        json = response.parsed_body
        anime = json.find { |p| p['media_type'] == 'anime' }
        expect(anime['status']).to eq('generating')
      end
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/media_preference_profiles_spec.rb -f doc
```

期待: ルーティングエラー or コントローラー not found

- [ ] **Step 3: ルーティングを追加する**

`config/routes.rb` の `resource :recommendations` の次の行に追加:

```ruby
# おすすめ（単一リソースのためIDなし）
resource :recommendations, only: [:show] do
  post :refresh, on: :collection
end

# メディア別好みプロファイル
resources :media_preference_profiles, only: [:index]
```

- [ ] **Step 4: コントローラーを実装する**

`app/controllers/api/v1/media_preference_profiles_controller.rb`:

```ruby
module Api
  module V1
    class MediaPreferenceProfilesController < ApplicationController
      before_action :authenticate_user!

      def index
        profiles = Work.media_types.keys.map do |media_type|
          build_profile_data(media_type)
        end
        render json: profiles
      end

      private

      def build_profile_data(media_type)
        record_count = current_user.records.joins(:work)
                                   .where(works: { media_type: Work.media_types[media_type] })
                                   .count

        if record_count.zero?
          return { media_type:, status: 'no_records', record_count: }
        end

        if record_count < MediaPreferenceAnalyzer::MINIMUM_RECORDS
          return { media_type:, status: 'insufficient_records', record_count:,
                   required_count: MediaPreferenceAnalyzer::MINIMUM_RECORDS }
        end

        profile = current_user.media_preference_profiles
                               .find_by(media_type: Work.media_types[media_type])

        return { media_type:, status: 'generating', record_count: } if profile.nil?

        format_profile(profile, media_type)
      end

      def format_profile(profile, media_type)
        {
          media_type:,
          status: 'ready',
          analysis_summary: profile.analysis_summary,
          preference_scores: profile.preference_scores,
          top_tags: profile.top_tags,
          same_media_works: profile.same_media_works,
          cross_media_works: profile.cross_media_works,
          record_count: profile.record_count,
          analyzed_at: profile.analyzed_at&.iso8601
        }
      end
    end
  end
end
```

- [ ] **Step 5: UserモデルにHasManyを追加する**

`app/models/user.rb` を開き `has_many :recommendations` の次の行に追加:

```ruby
has_many :media_preference_profiles, dependent: :destroy
```

- [ ] **Step 6: テストが通ることを確認する**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/media_preference_profiles_spec.rb -f doc
```

期待: 6 examples, 0 failures

- [ ] **Step 7: コミット**

```bash
git add config/routes.rb app/controllers/api/v1/media_preference_profiles_controller.rb app/models/user.rb spec/requests/api/v1/media_preference_profiles_spec.rb
git commit -m "feat: MediaPreferenceProfilesControllerとルーティングを追加"
```

---

## Task 6: RecommendationsController refreshアクションの更新

**Files:**
- Modify: `app/controllers/api/v1/recommendations_controller.rb`
- Modify: `spec/requests/api/v1/recommendations_spec.rb`

- [ ] **Step 1: 既存テストが通ることを確認する（ベースライン）**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/recommendations_spec.rb -f doc
```

期待: 全テストがパス（ベースライン確認）

- [ ] **Step 2: refreshアクションのテストを追加する**

`spec/requests/api/v1/recommendations_spec.rb` の `describe 'POST /api/v1/recommendations/refresh'` ブロックを探し（または追加し）、以下のテストを追加:

```ruby
describe 'POST /api/v1/recommendations/refresh' do
  before { sign_in user }

  it 'MediaProfileRefreshJobもエンキューすること' do
    expect(MediaProfileRefreshJob).to receive(:perform_later).with(user.id)
    post '/api/v1/recommendations/refresh', as: :json
  end
end
```

- [ ] **Step 3: テストが失敗することを確認する**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/recommendations_spec.rb -f doc
```

期待: 追加したテストのみ失敗

- [ ] **Step 4: コントローラーを更新する**

`app/controllers/api/v1/recommendations_controller.rb` の `refresh` メソッドと `render_recommendation` メソッドを以下に変更:

```ruby
def refresh
  RecommendationRefreshJob.perform_later(current_user.id)
  MediaProfileRefreshJob.perform_later(current_user.id)
  render json: { message: '分析を開始しました', status: 'processing' }, status: :accepted
end
```

`render_recommendation` メソッド内の `recommendation.nil?` ブロック:

```ruby
def render_recommendation
  recommendation = RecommendationService.new(current_user).fetch

  if recommendation.nil?
    RecommendationRefreshJob.perform_later(current_user.id)
    MediaProfileRefreshJob.perform_later(current_user.id)
    return render json: { recommendation: nil, status: 'generating' }
  end

  render json: { recommendation: format_recommendation(recommendation), status: 'ready' }
end
```

- [ ] **Step 5: テストが通ることを確認する**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/recommendations_spec.rb -f doc
```

期待: 全テストがパス

- [ ] **Step 6: バックエンド全体テストを実行する**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec -f doc
```

期待: 全テストがパス（新規追加分も含めて）

- [ ] **Step 7: コミット**

```bash
git add app/controllers/api/v1/recommendations_controller.rb spec/requests/api/v1/recommendations_spec.rb
git commit -m "feat: refreshアクションでMediaProfileRefreshJobを並列エンキュー"
```

---

## Task 7: フロントエンド型定義 + APIクライアント

**Files:**
- Create: `frontend/src/types/mediaPreferenceProfile.ts`
- Create: `frontend/src/lib/mediaPreferenceProfilesApi.ts`

- [ ] **Step 1: 型定義を作成する**

`frontend/src/types/mediaPreferenceProfile.ts`:

```typescript
import type { RecommendedWork } from './recommendation'

export type MediaProfileStatus = 'ready' | 'insufficient_records' | 'no_records' | 'generating'

export interface MediaPreferenceScore {
  label: string
  score: number
}

export interface MediaPreferenceProfileReady {
  media_type: string
  status: 'ready'
  analysis_summary: string
  preference_scores: MediaPreferenceScore[]
  top_tags: Array<{ name: string; count: number }>
  same_media_works: RecommendedWork[]
  cross_media_works: RecommendedWork[]
  record_count: number
  analyzed_at: string
}

export interface MediaPreferenceProfileInsufficient {
  media_type: string
  status: 'insufficient_records'
  record_count: number
  required_count: number
}

export interface MediaPreferenceProfileEmpty {
  media_type: string
  status: 'no_records' | 'generating'
  record_count: number
}

export type MediaPreferenceProfile =
  | MediaPreferenceProfileReady
  | MediaPreferenceProfileInsufficient
  | MediaPreferenceProfileEmpty
```

- [ ] **Step 2: APIクライアントを作成する**

`frontend/src/lib/mediaPreferenceProfilesApi.ts`:

```typescript
import { request } from './api'
import type { MediaPreferenceProfile } from '../types/mediaPreferenceProfile'

export const mediaPreferenceProfilesApi = {
  getAll(): Promise<MediaPreferenceProfile[]> {
    return request<MediaPreferenceProfile[]>('/media_preference_profiles')
  },
}
```

- [ ] **Step 3: TypeScriptの型チェックを通す**

```bash
docker compose run --rm frontend npm run build 2>&1 | grep -E "error|Error" | head -20
```

期待: 型エラーなし

- [ ] **Step 4: コミット**

```bash
git add frontend/src/types/mediaPreferenceProfile.ts frontend/src/lib/mediaPreferenceProfilesApi.ts
git commit -m "feat: MediaPreferenceProfile型定義とAPIクライアントを追加"
```

---

## Task 8: useMediaProfilesフック

**Files:**
- Create: `frontend/src/hooks/useMediaProfiles.ts`
- Create: `frontend/src/hooks/useMediaProfiles.test.ts`

- [ ] **Step 1: テストを書く**

`frontend/src/hooks/useMediaProfiles.test.ts`:

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMediaProfiles } from './useMediaProfiles'
import { mediaPreferenceProfilesApi } from '../lib/mediaPreferenceProfilesApi'

vi.mock('../lib/mediaPreferenceProfilesApi')

const mockProfiles = [
  { media_type: 'anime', status: 'ready' as const, analysis_summary: 'テスト', preference_scores: [], top_tags: [], same_media_works: [], cross_media_works: [], record_count: 24, analyzed_at: '2026-05-09T10:00:00+09:00' },
  { media_type: 'movie', status: 'insufficient_records' as const, record_count: 1, required_count: 3 },
  { media_type: 'drama', status: 'no_records' as const, record_count: 0 },
  { media_type: 'book', status: 'no_records' as const, record_count: 0 },
  { media_type: 'manga', status: 'no_records' as const, record_count: 0 },
  { media_type: 'game', status: 'no_records' as const, record_count: 0 },
]

describe('useMediaProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('初期状態はisLoading=true', () => {
    vi.mocked(mediaPreferenceProfilesApi.getAll).mockResolvedValue(mockProfiles)
    const { result } = renderHook(() => useMediaProfiles())
    expect(result.current.isLoading).toBe(true)
  })

  it('APIレスポンスをprofilesにセットする', async () => {
    vi.mocked(mediaPreferenceProfilesApi.getAll).mockResolvedValue(mockProfiles)
    const { result } = renderHook(() => useMediaProfiles())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.profiles).toHaveLength(6)
    expect(result.current.profiles[0].media_type).toBe('anime')
  })

  it('APIエラー時はerrorをセットする', async () => {
    vi.mocked(mediaPreferenceProfilesApi.getAll).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useMediaProfiles())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })

  it('getProfileByMediaTypeで特定メディアのプロファイルを取得できる', async () => {
    vi.mocked(mediaPreferenceProfilesApi.getAll).mockResolvedValue(mockProfiles)
    const { result } = renderHook(() => useMediaProfiles())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const anime = result.current.getProfileByMediaType('anime')
    expect(anime?.status).toBe('ready')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
docker compose run --rm frontend npm test -- --run src/hooks/useMediaProfiles.test.ts
```

期待: useMediaProfiles not found

- [ ] **Step 3: 実装する**

`frontend/src/hooks/useMediaProfiles.ts`:

```typescript
import { useState, useCallback, useEffect } from 'react'
import { mediaPreferenceProfilesApi } from '../lib/mediaPreferenceProfilesApi'
import type { MediaPreferenceProfile } from '../types/mediaPreferenceProfile'

export function useMediaProfiles() {
  const [profiles, setProfiles] = useState<MediaPreferenceProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await mediaPreferenceProfilesApi.getAll()
      setProfiles(data)
    } catch {
      setError('メディア別プロファイルの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchProfiles()
  }, [fetchProfiles])

  const getProfileByMediaType = useCallback(
    (mediaType: string) => profiles.find((p) => p.media_type === mediaType) ?? null,
    [profiles],
  )

  return { profiles, isLoading, error, refetch: fetchProfiles, getProfileByMediaType }
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
docker compose run --rm frontend npm test -- --run src/hooks/useMediaProfiles.test.ts
```

期待: 4 tests pass

- [ ] **Step 5: コミット**

```bash
git add frontend/src/hooks/useMediaProfiles.ts frontend/src/hooks/useMediaProfiles.test.ts
git commit -m "feat: useMediaProfilesフックを追加"
```

---

## Task 9: MediaAnalysisSummaryCardコンポーネント

**Files:**
- Create: `frontend/src/pages/RecommendationsPage/MediaAnalysisSummaryCard.tsx`
- Create: `frontend/src/pages/RecommendationsPage/MediaAnalysisSummaryCard.test.tsx`

- [ ] **Step 1: テストを書く**

`frontend/src/pages/RecommendationsPage/MediaAnalysisSummaryCard.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { MediaAnalysisSummaryCard } from './MediaAnalysisSummaryCard'

const mockProfile = {
  media_type: 'anime',
  status: 'ready' as const,
  analysis_summary: 'アニメの好み傾向テキスト',
  preference_scores: [
    { label: '感情的な深さ', score: 9.1 },
    { label: '伏線・構成力', score: 8.7 },
  ],
  top_tags: [{ name: '泣ける', count: 5 }],
  same_media_works: [],
  cross_media_works: [],
  record_count: 24,
  analyzed_at: '2026-05-09T10:00:00+09:00',
}

describe('MediaAnalysisSummaryCard', () => {
  it('分析テキストを表示する', () => {
    render(<MediaAnalysisSummaryCard profile={mockProfile} />)
    expect(screen.getByText('アニメの好み傾向テキスト')).toBeInTheDocument()
  })

  it('セクションタイトルにメディア名が含まれる', () => {
    render(<MediaAnalysisSummaryCard profile={mockProfile} />)
    expect(screen.getByText('アニメでの好み傾向')).toBeInTheDocument()
  })

  it('詳細展開ボタンをクリックするとスコアバーが表示される', async () => {
    const user = userEvent.setup()
    render(<MediaAnalysisSummaryCard profile={mockProfile} />)

    expect(screen.queryByText('感情的な深さ')).not.toBeInTheDocument()
    await user.click(screen.getByText('好み分析の詳細を見る'))
    expect(screen.getByText('感情的な深さ')).toBeInTheDocument()
  })

  it('AI分析バッジを表示する', () => {
    render(<MediaAnalysisSummaryCard profile={mockProfile} />)
    expect(screen.getByText('AI分析')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
docker compose run --rm frontend npm test -- --run src/pages/RecommendationsPage/MediaAnalysisSummaryCard.test.tsx
```

期待: component not found

- [ ] **Step 3: 実装する**

`frontend/src/pages/RecommendationsPage/MediaAnalysisSummaryCard.tsx`:

```tsx
import { useState } from 'react'
import type { MediaPreferenceProfileReady } from '../../types/mediaPreferenceProfile'
import styles from './RecommendationsPage.module.css'

const MEDIA_LABEL: Record<string, string> = {
  anime: 'アニメ',
  movie: '映画',
  drama: 'ドラマ',
  book: '本',
  manga: '漫画',
  game: 'ゲーム',
}

type Props = {
  profile: MediaPreferenceProfileReady
}

export function MediaAnalysisSummaryCard({ profile }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const mediaLabel = MEDIA_LABEL[profile.media_type] ?? profile.media_type

  return (
    <>
      <div className={`${styles.summaryCard} ${styles[`mediaBorder${profile.media_type}`]}`}>
        <div className={styles.summaryHeader}>
          <span className={styles.summaryLabel}>{mediaLabel}での好み傾向</span>
          <span className={styles.aiBadge}>AI分析</span>
        </div>
        <p className={styles.summaryText}>{profile.analysis_summary}</p>
      </div>

      <button
        className={`${styles.expandToggle} ${isExpanded ? styles.expandOpen : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? '好み分析の詳細を閉じる' : '好み分析の詳細を見る'}
        <span className={styles.arrow}>▼</span>
      </button>

      {isExpanded && (
        <div className={styles.detailInner}>
          {profile.preference_scores.length > 0 && (
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>好み傾向スコア</div>
              <div className={styles.prefBars}>
                {profile.preference_scores.map((s) => (
                  <div key={s.label} className={styles.prefRow}>
                    <span className={styles.prefLabel}>{s.label}</span>
                    <div className={styles.prefBarBg}>
                      <div
                        className={`${styles.prefBar} ${styles[`prefBar${profile.media_type}`]}`}
                        style={{ width: `${(s.score / 10) * 100}%` }}
                      />
                    </div>
                    <span className={styles.prefScore}>{s.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: RecommendationsPage.module.css にメディア別ボーダースタイルを追加する**

`frontend/src/pages/RecommendationsPage/RecommendationsPage.module.css` の末尾に追加:

```css
/* メディア別サマリーカードのボーダーカラー */
.mediaBorderanime::before { background: var(--color-anime); }
.mediaBordermovie::before { background: var(--color-movie); }
.mediaBorderdrama::before { background: var(--color-drama); }
.mediaBorderbook::before { background: var(--color-book); }
.mediaBordermanga::before { background: var(--color-manga); }
.mediaBordergame::before { background: var(--color-game); }

/* メディア別スコアバー */
.prefBaranime { background: var(--color-anime); }
.prefBarmovie { background: var(--color-movie); }
.prefBardrama { background: var(--color-drama); }
.prefBarbook { background: var(--color-book); }
.prefBarmanga { background: var(--color-manga); }
.prefBargame { background: var(--color-game); }

/* タブバー */
.tabBar {
  display: flex;
  border-bottom: 2px solid var(--color-border-light);
  margin-bottom: var(--spacing-xl);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  gap: 0;
}
.tabBar::-webkit-scrollbar { display: none; }

.tab {
  padding: var(--spacing-sm) var(--spacing-lg);
  font-size: var(--font-size-label);
  font-family: var(--font-body);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  border: none;
  background: transparent;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  transition: color var(--transition-fast);
}
.tab:hover { color: var(--color-text); }

.tabActive { color: var(--color-text); font-weight: var(--font-weight-bold); }
.tabActiveOverall { border-bottom-color: var(--color-text); }
.tabActiveAnime { border-bottom-color: var(--color-anime); color: var(--color-anime); }
.tabActiveMovie { border-bottom-color: var(--color-movie); color: var(--color-movie); }
.tabActiveDrama { border-bottom-color: var(--color-drama); color: var(--color-drama); }
.tabActiveBook { border-bottom-color: var(--color-book); color: var(--color-book); }
.tabActiveManga { border-bottom-color: var(--color-manga); color: var(--color-manga); }
.tabActiveGame { border-bottom-color: var(--color-game); color: var(--color-game); }

.tabBadge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--color-border-light);
  border-radius: var(--radius-full);
  font-size: 10px;
  color: var(--color-text-muted);
}
.tabBadgeActive {
  color: var(--color-bg-white);
}
.tabBadgeAnime { background: var(--color-anime); }
.tabBadgeMovie { background: var(--color-movie); }
.tabBadgeDrama { background: var(--color-drama); }
.tabBadgeBook { background: var(--color-book); }
.tabBadgeManga { background: var(--color-manga); }
.tabBadgeGame { background: var(--color-game); }

/* タブコンテンツ: 記録不足・記録なし状態 */
.mediaEmptyState {
  text-align: center;
  padding: var(--spacing-2xl) var(--spacing-xl);
  background: var(--color-bg-white);
  border: 1px dashed var(--color-border-light);
  border-radius: var(--radius-md);
}
.mediaEmptyTitle {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--spacing-sm);
}
.mediaEmptyDesc {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-lg);
}
.mediaProgressCard {
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  text-align: center;
}
.mediaSectionTitle {
  font-family: var(--font-heading);
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--spacing-sm);
  margin-top: var(--spacing-xl);
}
```

- [ ] **Step 5: テストが通ることを確認する**

```bash
docker compose run --rm frontend npm test -- --run src/pages/RecommendationsPage/MediaAnalysisSummaryCard.test.tsx
```

期待: 4 tests pass

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/RecommendationsPage/MediaAnalysisSummaryCard.tsx frontend/src/pages/RecommendationsPage/MediaAnalysisSummaryCard.test.tsx frontend/src/pages/RecommendationsPage/RecommendationsPage.module.css
git commit -m "feat: MediaAnalysisSummaryCardコンポーネントとメディア別スタイルを追加"
```

---

## Task 10: MediaTabBarコンポーネント

**Files:**
- Create: `frontend/src/pages/RecommendationsPage/MediaTabBar.tsx`
- Create: `frontend/src/pages/RecommendationsPage/MediaTabBar.test.tsx`

- [ ] **Step 1: テストを書く**

`frontend/src/pages/RecommendationsPage/MediaTabBar.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MediaTabBar } from './MediaTabBar'
import type { MediaPreferenceProfile } from '../../types/mediaPreferenceProfile'

const mockProfiles: MediaPreferenceProfile[] = [
  { media_type: 'anime', status: 'ready', analysis_summary: '', preference_scores: [], top_tags: [], same_media_works: [], cross_media_works: [], record_count: 24, analyzed_at: '' },
  { media_type: 'movie', status: 'insufficient_records', record_count: 1, required_count: 3 },
  { media_type: 'drama', status: 'no_records', record_count: 0 },
  { media_type: 'book', status: 'no_records', record_count: 0 },
  { media_type: 'manga', status: 'no_records', record_count: 0 },
  { media_type: 'game', status: 'no_records', record_count: 0 },
]

describe('MediaTabBar', () => {
  it('全体タブを含む7タブを表示する', () => {
    render(
      <MediaTabBar
        profiles={mockProfiles}
        activeTab="overall"
        onTabChange={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /全体/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /アニメ/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /映画/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ドラマ/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /本/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /漫画/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ゲーム/ })).toBeInTheDocument()
  })

  it('アニメタブに記録数バッジ（24）が表示される', () => {
    render(
      <MediaTabBar profiles={mockProfiles} activeTab="overall" onTabChange={vi.fn()} />
    )
    expect(screen.getByText('24')).toBeInTheDocument()
  })

  it('タブをクリックするとonTabChangeが呼ばれる', async () => {
    const onTabChange = vi.fn()
    const user = userEvent.setup()
    render(
      <MediaTabBar profiles={mockProfiles} activeTab="overall" onTabChange={onTabChange} />
    )
    await user.click(screen.getByRole('button', { name: /アニメ/ }))
    expect(onTabChange).toHaveBeenCalledWith('anime')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
docker compose run --rm frontend npm test -- --run src/pages/RecommendationsPage/MediaTabBar.test.tsx
```

期待: component not found

- [ ] **Step 3: 実装する**

`frontend/src/pages/RecommendationsPage/MediaTabBar.tsx`:

```tsx
import type { MediaPreferenceProfile } from '../../types/mediaPreferenceProfile'
import styles from './RecommendationsPage.module.css'

const TABS = [
  { id: 'overall', label: '全体' },
  { id: 'anime', label: 'アニメ' },
  { id: 'movie', label: '映画' },
  { id: 'drama', label: 'ドラマ' },
  { id: 'book', label: '本' },
  { id: 'manga', label: '漫画' },
  { id: 'game', label: 'ゲーム' },
] as const

type TabId = (typeof TABS)[number]['id']

type Props = {
  profiles: MediaPreferenceProfile[]
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const CAPITALIZE = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function MediaTabBar({ profiles, activeTab, onTabChange }: Props) {
  const getRecordCount = (mediaType: string) =>
    profiles.find((p) => p.media_type === mediaType)?.record_count ?? 0

  const getActiveClass = (tabId: string) => {
    if (tabId !== activeTab) return ''
    if (tabId === 'overall') return styles.tabActiveOverall
    return styles[`tabActive${CAPITALIZE(tabId)}` as keyof typeof styles] ?? styles.tabActive
  }

  const getBadgeClass = (tabId: string) => {
    if (tabId !== activeTab || tabId === 'overall') return ''
    return styles[`tabBadge${CAPITALIZE(tabId)}` as keyof typeof styles] ?? ''
  }

  return (
    <div className={styles.tabBar} role="tablist">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          aria-selected={activeTab === id}
          className={`${styles.tab} ${getActiveClass(id)}`}
          onClick={() => onTabChange(id)}
        >
          {label}
          {id !== 'overall' && (
            <span className={`${styles.tabBadge} ${getBadgeClass(id)}`}>
              {getRecordCount(id)}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export type { TabId }
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
docker compose run --rm frontend npm test -- --run src/pages/RecommendationsPage/MediaTabBar.test.tsx
```

期待: 3 tests pass

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/RecommendationsPage/MediaTabBar.tsx frontend/src/pages/RecommendationsPage/MediaTabBar.test.tsx
git commit -m "feat: MediaTabBarコンポーネントを追加"
```

---

## Task 11: MediaTabContentコンポーネント

**Files:**
- Create: `frontend/src/pages/RecommendationsPage/MediaTabContent.tsx`
- Create: `frontend/src/pages/RecommendationsPage/MediaTabContent.test.tsx`

- [ ] **Step 1: テストを書く**

`frontend/src/pages/RecommendationsPage/MediaTabContent.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { MediaTabContent } from './MediaTabContent'
import type { MediaPreferenceProfile } from '../../types/mediaPreferenceProfile'

const readyProfile: MediaPreferenceProfile = {
  media_type: 'anime',
  status: 'ready',
  analysis_summary: 'アニメの好み傾向テスト',
  preference_scores: [],
  top_tags: [],
  same_media_works: [
    { title: '葬送のフリーレン', media_type: 'anime', description: '', cover_url: null, reason: 'テスト理由', external_api_id: '1', external_api_source: 'anilist', metadata: {} }
  ],
  cross_media_works: [
    { title: '風の谷のナウシカ', media_type: 'manga', description: '', cover_url: null, reason: 'クロス理由', external_api_id: '2', external_api_source: 'anilist', metadata: {} }
  ],
  record_count: 24,
  analyzed_at: '2026-05-09T10:00:00+09:00',
}

describe('MediaTabContent', () => {
  const wrap = (profile: MediaPreferenceProfile) =>
    render(
      <MemoryRouter>
        <MediaTabContent profile={profile} onRecord={vi.fn()} recordedIds={new Set()} recordingId={null} />
      </MemoryRouter>
    )

  it('ready状態: 分析テキストを表示する', () => {
    wrap(readyProfile)
    expect(screen.getByText('アニメの好み傾向テスト')).toBeInTheDocument()
  })

  it('ready状態: 同メディアおすすめを表示する', () => {
    wrap(readyProfile)
    expect(screen.getByText('葬送のフリーレン')).toBeInTheDocument()
    expect(screen.getByText('アニメのおすすめ')).toBeInTheDocument()
  })

  it('ready状態: クロスメディアおすすめを表示する', () => {
    wrap(readyProfile)
    expect(screen.getByText('風の谷のナウシカ')).toBeInTheDocument()
    expect(screen.getByText('アニメ好きにおすすめの他メディア')).toBeInTheDocument()
  })

  it('insufficient_records状態: プログレス表示', () => {
    const profile: MediaPreferenceProfile = { media_type: 'movie', status: 'insufficient_records', record_count: 1, required_count: 3 }
    wrap(profile)
    expect(screen.getByText(/あと2件/)).toBeInTheDocument()
  })

  it('no_records状態: 空状態を表示する', () => {
    const profile: MediaPreferenceProfile = { media_type: 'game', status: 'no_records', record_count: 0 }
    wrap(profile)
    expect(screen.getByText(/まだゲームの記録がありません/)).toBeInTheDocument()
  })

  it('generating状態: 分析中メッセージを表示する', () => {
    const profile: MediaPreferenceProfile = { media_type: 'book', status: 'generating', record_count: 5 }
    wrap(profile)
    expect(screen.getByText(/分析中/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
docker compose run --rm frontend npm test -- --run src/pages/RecommendationsPage/MediaTabContent.test.tsx
```

期待: component not found

- [ ] **Step 3: 実装する**

`frontend/src/pages/RecommendationsPage/MediaTabContent.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button/Button'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import type { MediaPreferenceProfile } from '../../types/mediaPreferenceProfile'
import type { RecommendedWork } from '../../types/recommendation'
import { MediaAnalysisSummaryCard } from './MediaAnalysisSummaryCard'
import { RecommendedWorkCard } from './RecommendedWorkCard'
import styles from './RecommendationsPage.module.css'

const MEDIA_LABEL: Record<string, string> = {
  anime: 'アニメ',
  movie: '映画',
  drama: 'ドラマ',
  book: '本',
  manga: '漫画',
  game: 'ゲーム',
}

type Props = {
  profile: MediaPreferenceProfile
  onRecord: (work: RecommendedWork, position: number) => void
  recordedIds: Set<string>
  recordingId: string | null
}

export function MediaTabContent({ profile, onRecord, recordedIds, recordingId }: Props) {
  const mediaLabel = MEDIA_LABEL[profile.media_type] ?? profile.media_type

  if (profile.status === 'no_records') {
    return (
      <div className={styles.mediaEmptyState}>
        <p className={styles.mediaEmptyDesc}>まだ{mediaLabel}の記録がありません。記録を追加するとAI分析が使えるようになります。</p>
        <Link to="/search">
          <Button variant="secondary" size="sm">{mediaLabel}を検索して記録する</Button>
        </Link>
      </div>
    )
  }

  if (profile.status === 'insufficient_records') {
    const remaining = profile.required_count - profile.record_count
    return (
      <div className={styles.mediaProgressCard}>
        <div className={styles.progressTitle}>あと{remaining}件記録すると{mediaLabel}のAI分析が使えます</div>
        <div className={styles.progressBarContainer}>
          <div className={styles.progressBarBg}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${(profile.record_count / profile.required_count) * 100}%` }}
            />
          </div>
          <span className={styles.progressCount}>{profile.record_count} / {profile.required_count}</span>
        </div>
        <Link to="/search">
          <Button variant="secondary" size="sm">{mediaLabel}を検索して記録する</Button>
        </Link>
      </div>
    )
  }

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

  const workKey = (work: RecommendedWork) => `${work.external_api_source}:${work.external_api_id}`

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

      {profile.cross_media_works.length > 0 && (
        <>
          <h2 className={styles.mediaSectionTitle}>{mediaLabel}好きにおすすめの他メディア</h2>
          <div className={styles.recList}>
            {profile.cross_media_works.map((work, index) => (
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

- [ ] **Step 4: テストが通ることを確認する**

```bash
docker compose run --rm frontend npm test -- --run src/pages/RecommendationsPage/MediaTabContent.test.tsx
```

期待: 6 tests pass

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/RecommendationsPage/MediaTabContent.tsx frontend/src/pages/RecommendationsPage/MediaTabContent.test.tsx
git commit -m "feat: MediaTabContentコンポーネントを追加（状態別表示）"
```

---

## Task 12: RecommendationsPageの更新

**Files:**
- Modify: `frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx`
- Modify: `frontend/src/pages/RecommendationsPage/RecommendationsPage.test.tsx`

- [ ] **Step 1: 既存テストがパスすることを確認する（ベースライン）**

```bash
docker compose run --rm frontend npm test -- --run src/pages/RecommendationsPage/RecommendationsPage.test.tsx
```

期待: 全テストがパス

- [ ] **Step 2: タブ切り替えのテストを追加する**

`frontend/src/pages/RecommendationsPage/RecommendationsPage.test.tsx` に以下のテストを追加（既存テストの末尾）:

```typescript
// useMediaProfilesをモック（既存のviモック宣言の末尾に追加）
vi.mock('../../hooks/useMediaProfiles', () => ({
  useMediaProfiles: () => ({
    profiles: [
      { media_type: 'anime', status: 'ready', analysis_summary: 'アニメ分析', preference_scores: [], top_tags: [], same_media_works: [], cross_media_works: [], record_count: 24, analyzed_at: '' },
      { media_type: 'movie', status: 'no_records', record_count: 0 },
      { media_type: 'drama', status: 'no_records', record_count: 0 },
      { media_type: 'book', status: 'no_records', record_count: 0 },
      { media_type: 'manga', status: 'no_records', record_count: 0 },
      { media_type: 'game', status: 'no_records', record_count: 0 },
    ],
    isLoading: false,
    error: null,
    getProfileByMediaType: (mt: string) => ({
      anime: { media_type: 'anime', status: 'ready', analysis_summary: 'アニメ分析', preference_scores: [], top_tags: [], same_media_works: [], cross_media_works: [], record_count: 24, analyzed_at: '' },
    }[mt] ?? { media_type: mt, status: 'no_records', record_count: 0 }),
    refetch: vi.fn(),
  }),
}))

it('タブバーが表示される（readyステータス時）', async () => {
  vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)

  render(
    <MemoryRouter>
      <RecommendationsPage />
    </MemoryRouter>,
  )

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /全体/ })).toBeInTheDocument()
  })
  expect(screen.getByRole('button', { name: /アニメ/ })).toBeInTheDocument()
})

it('アニメタブをクリックするとアニメ分析が表示される', async () => {
  vi.mocked(recommendationsApi.get).mockResolvedValue(mockReadyResponse)
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <RecommendationsPage />
    </MemoryRouter>,
  )

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /アニメ/ })).toBeInTheDocument()
  })

  await user.click(screen.getByRole('button', { name: /アニメ/ }))
  expect(screen.getByText('アニメ分析')).toBeInTheDocument()
})
```

- [ ] **Step 3: 追加テストが失敗することを確認する**

```bash
docker compose run --rm frontend npm test -- --run src/pages/RecommendationsPage/RecommendationsPage.test.tsx
```

期待: 追加した2件のみ失敗（既存は引き続きパス）

- [ ] **Step 4: RecommendationsPage.tsx を更新する**

`frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx` を以下に更新:

```tsx
import { useState } from 'react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { Button } from '../../components/ui/Button/Button'
import { RecordModal } from '../../components/RecordModal/RecordModal'
import { useRecommendations } from '../../hooks/useRecommendations'
import { useMediaProfiles } from '../../hooks/useMediaProfiles'
import { recordsApi } from '../../lib/recordsApi'
import { getGenreLabel, getMediaTypeLabel } from '../../lib/mediaTypeUtils'
import { useRecollyMotion } from '../../lib/motion'
import { captureEvent } from '../../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'
import { updateMediaTypesCount } from '../../lib/analytics/userProperties'
import type { MediaType, RecordStatus } from '../../lib/types'
import type { RecommendedWork } from '../../types/recommendation'
import { AnalysisSummaryCard } from './AnalysisSummaryCard'
import { RecommendedWorkCard } from './RecommendedWorkCard'
import { MediaTabBar } from './MediaTabBar'
import type { TabId } from './MediaTabBar'
import { MediaTabContent } from './MediaTabContent'
import styles from './RecommendationsPage.module.css'

export function RecommendationsPage() {
  const { data, status, isLoading, isRefreshing, error, refresh } = useRecommendations()
  const { profiles, getProfileByMediaType } = useMediaProfiles()
  const [activeTab, setActiveTab] = useState<TabId>('overall')
  const [modalWork, setModalWork] = useState<RecommendedWork | null>(null)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set())
  const m = useRecollyMotion()

  const handleOpenModal = (work: RecommendedWork, position: number) => {
    captureEvent(ANALYTICS_EVENTS.RECOMMENDATION_CLICKED, {
      media_type: work.media_type as MediaType,
      position,
      has_reason: Boolean(work.reason),
    })
    setModalWork(work)
  }

  const handleConfirmRecord = async (recordData: { status: RecordStatus; rating: number | null }) => {
    if (!modalWork) return
    const workKey = `${modalWork.external_api_source}:${modalWork.external_api_id}`
    setRecordingId(workKey)
    try {
      await recordsApi.createFromSearchResult(
        {
          title: modalWork.title,
          media_type: modalWork.media_type as MediaType,
          description: modalWork.description,
          cover_image_url: modalWork.cover_url,
          total_episodes: null,
          external_api_id: modalWork.external_api_id,
          external_api_source: modalWork.external_api_source,
          metadata: modalWork.metadata,
        },
        recordData,
      )
      captureEvent(ANALYTICS_EVENTS.RECORD_CREATED, { media_type: modalWork.media_type as MediaType })
      void updateMediaTypesCount()
      setRecordedIds((prev) => new Set(prev).add(workKey))
      setModalWork(null)
    } catch {
      // エラーハンドリングはRecordModal側で表示
    } finally {
      setRecordingId(null)
    }
  }

  if (isLoading) {
    return <div className={styles.container}><div className={styles.loading}>読み込み中...</div></div>
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <div className={styles.errorTitle}>おすすめの取得に失敗しました</div>
          <p className={styles.errorDesc}>サーバーとの通信に問題が発生しました。しばらく経ってからもう一度お試しください。</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>もう一度試す</Button>
        </div>
      </div>
    )
  }

  if (status === 'no_records') {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>作品を記録しておすすめを受け取ろう</div>
          <p className={styles.emptyDesc}>観た作品を記録して評価すると、あなたの好みを分析してジャンルを超えた作品をおすすめします</p>
          <Link to="/search"><Button variant="primary">作品を検索する</Button></Link>
        </div>
      </div>
    )
  }

  if (status === 'insufficient_records' && data) {
    const remaining = (data.required_count ?? 5) - data.record_count
    return (
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>おすすめ</h1>
        <div className={styles.progressCard}>
          <div className={styles.progressTitle}>あと{remaining}件記録するとAI分析が使えます</div>
          <div className={styles.progressBarContainer}>
            <div className={styles.progressBarBg}>
              <div className={styles.progressBarFill} style={{ width: `${(data.record_count / (data.required_count ?? 5)) * 100}%` }} />
            </div>
            <span className={styles.progressCount}>{data.record_count} / {data.required_count ?? 5}</span>
          </div>
          <p className={styles.progressHint}>評価をつけると分析の精度が上がります</p>
        </div>
        {data.genre_stats && data.genre_stats.length > 0 && (
          <>
            <SectionTitle>現在の記録</SectionTitle>
            <div className={styles.simpleGenreRow}>
              {data.genre_stats.map((stat) => (
                <div key={stat.media_type} className={styles.simpleGenre}>
                  <div className={styles.simpleGenreNum}>{stat.count}</div>
                  <div className={styles.simpleGenreLabel}>{getMediaTypeLabel(stat.media_type)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  if (status === 'generating') {
    return (
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>おすすめ</h1>
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <div>
            <div className={styles.loadingText}>分析を更新しています...</div>
            <div className={styles.loadingSub}>記録データの分析とおすすめ作品の検索を行っています。1〜2分かかることがあります。</div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'ready' && data) {
    const activeProfile = activeTab !== 'overall' ? getProfileByMediaType(activeTab) : null

    return (
      <div className={styles.container}>
        <motion.div variants={m.listContainer} initial="hidden" animate="visible">
          <motion.div className={styles.pageHeader} variants={m.fadeInUp}>
            <h1 className={styles.pageTitle}>おすすめ</h1>
            <p className={styles.pageSubtitle}>あなたの記録データから好みを分析し、ジャンルを超えた作品をおすすめします</p>
          </motion.div>

          <motion.div className={styles.updateBar} variants={m.fadeInUp}>
            <div className={styles.updateInfo}>
              <span className={styles.updateDot} />
              <span>{data.record_count}件の記録をもとに分析</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={isRefreshing}>
              {isRefreshing ? '更新中...' : '分析を更新'}
            </Button>
          </motion.div>

          <motion.div variants={m.fadeInUp}>
            <MediaTabBar profiles={profiles} activeTab={activeTab} onTabChange={setActiveTab} />
          </motion.div>

          {activeTab === 'overall' ? (
            <motion.div variants={m.fadeInUp}>
              {data.analysis && <AnalysisSummaryCard analysis={data.analysis} />}
              {data.recommended_works.length > 0 && (
                <>
                  <SectionTitle>あなたへのおすすめ</SectionTitle>
                  <div className={styles.recList}>
                    {data.recommended_works.map((work, index) => (
                      <RecommendedWorkCard
                        key={`${work.external_api_source}:${work.external_api_id}`}
                        work={work}
                        onRecord={(w) => handleOpenModal(w, index + 1)}
                        isLoading={recordingId === `${work.external_api_source}:${work.external_api_id}`}
                        isRecorded={recordedIds.has(`${work.external_api_source}:${work.external_api_id}`)}
                      />
                    ))}
                  </div>
                </>
              )}
              {data.challenge_works.length > 0 && (
                <>
                  <SectionTitle className={styles.challengeTitle}>いつもと違うジャンルに挑戦</SectionTitle>
                  <div className={styles.recList}>
                    {data.challenge_works.map((work, index) => (
                      <RecommendedWorkCard
                        key={`${work.external_api_source}:${work.external_api_id}`}
                        work={work}
                        onRecord={(w) => handleOpenModal(w, index + 1)}
                        isLoading={recordingId === `${work.external_api_source}:${work.external_api_id}`}
                        isRecorded={recordedIds.has(`${work.external_api_source}:${work.external_api_id}`)}
                      />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          ) : activeProfile ? (
            <motion.div variants={m.fadeInUp}>
              <MediaTabContent
                profile={activeProfile}
                onRecord={handleOpenModal}
                recordedIds={recordedIds}
                recordingId={recordingId}
              />
            </motion.div>
          ) : null}
        </motion.div>

        <RecordModal
          key={modalWork ? `${modalWork.external_api_source}:${modalWork.external_api_id}` : 'closed'}
          isOpen={modalWork !== null}
          title={modalWork?.title ?? ''}
          mediaType={(modalWork?.media_type as MediaType) ?? 'anime'}
          mediaTypeLabel={modalWork ? getGenreLabel(modalWork.media_type as MediaType) : ''}
          onConfirm={(d) => void handleConfirmRecord(d)}
          onCancel={() => setModalWork(null)}
          isLoading={recordingId !== null}
        />
      </div>
    )
  }

  return null
}
```

- [ ] **Step 5: 全テストが通ることを確認する**

```bash
docker compose run --rm frontend npm test -- --run src/pages/RecommendationsPage/RecommendationsPage.test.tsx
```

期待: 全テストがパス（既存 + 追加した2件）

- [ ] **Step 6: フロントエンド全体テストを実行する**

```bash
docker compose run --rm frontend npm test -- --run
```

期待: 全テストがパス

- [ ] **Step 7: コミット**

```bash
git add frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx frontend/src/pages/RecommendationsPage/RecommendationsPage.test.tsx
git commit -m "feat: RecommendationsPageにメディア別タブ切り替えを追加"
```

---

## Task 13: 最終確認 + RuboCop

- [ ] **Step 1: バックエンド全テスト実行**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec -f doc
```

期待: 全テストがパス

- [ ] **Step 2: RuboCop実行**

```bash
docker compose run --rm backend bundle exec rubocop app/models/media_preference_profile.rb app/services/media_preference_prompt_builder.rb app/services/media_preference_analyzer.rb app/jobs/media_profile_refresh_job.rb app/controllers/api/v1/media_preference_profiles_controller.rb app/controllers/api/v1/recommendations_controller.rb
```

期待: no offenses detected（違反があれば修正してから再実行）

- [ ] **Step 3: フロントエンド全テスト実行**

```bash
docker compose run --rm frontend npm test -- --run
```

期待: 全テストがパス

- [ ] **Step 4: ESLint実行**

```bash
docker compose run --rm frontend npm run lint
```

期待: エラーなし

- [ ] **Step 5: 最終コミット**

```bash
git add -A
git commit -m "chore: per-media好みプロファイル機能の最終確認完了"
```
