# フェーズ2: 記録の充実 — 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 感想・タグ・再視聴UI・統計ダッシュボードを追加し、記録機能を充実させる

**Architecture:** 既存のRails APIモード + React SPAパターンを踏襲。新規モデル（EpisodeReview, Tag, RecordTag）を追加し、RESTful APIで公開。フロントはcustom hooks + コンポーネント分離パターンを維持する

**Tech Stack:** Ruby on Rails 8 / RSpec / React 19 / TypeScript / Vitest / React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-25-phase2-enriched-records-design.md`

---

## ファイル構成

### バックエンド — 新規作成

| ファイル | 責務 |
|---------|------|
| `backend/db/migrate/XXXXXX_add_review_fields_to_records.rb` | Recordにreview_text, visibility追加 |
| `backend/db/migrate/XXXXXX_create_episode_reviews.rb` | EpisodeReviewテーブル作成 |
| `backend/db/migrate/XXXXXX_create_tags.rb` | Tagテーブル作成 |
| `backend/db/migrate/XXXXXX_create_record_tags.rb` | RecordTagテーブル作成 |
| `backend/app/models/episode_review.rb` | EpisodeReviewモデル |
| `backend/app/models/tag.rb` | Tagモデル |
| `backend/app/models/record_tag.rb` | RecordTagモデル |
| `backend/app/controllers/api/v1/episode_reviews_controller.rb` | 話数感想CRUD |
| `backend/app/controllers/api/v1/record_tags_controller.rb` | 記録へのタグ付与・除去 |
| `backend/app/controllers/api/v1/tags_controller.rb` | タグ一覧・削除 |
| `backend/app/controllers/api/v1/statistics_controller.rb` | 統計API |
| `backend/spec/models/episode_review_spec.rb` | EpisodeReviewモデルテスト |
| `backend/spec/models/tag_spec.rb` | Tagモデルテスト |
| `backend/spec/models/record_tag_spec.rb` | RecordTagモデルテスト |
| `backend/spec/requests/api/v1/episode_reviews_spec.rb` | 話数感想APIテスト |
| `backend/spec/requests/api/v1/record_tags_spec.rb` | タグ付与APIテスト |
| `backend/spec/requests/api/v1/tags_spec.rb` | タグAPIテスト |
| `backend/spec/requests/api/v1/statistics_spec.rb` | 統計APIテスト |

### バックエンド — 既存修正

| ファイル | 変更内容 |
|---------|---------|
| `backend/app/models/record.rb` | review_text/visibility追加、リレーション追加 |
| `backend/app/models/user.rb` | tagsリレーション追加 |
| `backend/app/controllers/api/v1/records_controller.rb` | review_text/rewatch_countをStrong Paramsに追加、タグフィルタ追加 |
| `backend/config/routes.rb` | episode_reviews/tags/record_tags/statisticsルート追加 |
| `backend/spec/models/record_spec.rb` | 新カラム・リレーションのテスト追加 |

### フロントエンド — 新規作成

| ファイル | 責務 |
|---------|------|
| `frontend/src/lib/episodeReviewsApi.ts` | 話数感想APIクライアント |
| `frontend/src/lib/episodeReviewsApi.test.ts` | APIクライアントテスト |
| `frontend/src/lib/tagsApi.ts` | タグAPIクライアント |
| `frontend/src/lib/tagsApi.test.ts` | APIクライアントテスト |
| `frontend/src/lib/statisticsApi.ts` | 統計APIクライアント |
| `frontend/src/lib/statisticsApi.test.ts` | APIクライアントテスト |
| `frontend/src/components/ReviewSection/ReviewSection.tsx` | 作品全体の感想セクション |
| `frontend/src/components/ReviewSection/ReviewSection.test.tsx` | テスト |
| `frontend/src/components/ReviewSection/ReviewSection.module.css` | スタイル |
| `frontend/src/components/EpisodeReviewSection/EpisodeReviewSection.tsx` | 話数ごとの感想セクション |
| `frontend/src/components/EpisodeReviewSection/EpisodeReviewSection.test.tsx` | テスト |
| `frontend/src/components/EpisodeReviewSection/EpisodeReviewSection.module.css` | スタイル |
| `frontend/src/components/TagSection/TagSection.tsx` | タグセクション |
| `frontend/src/components/TagSection/TagSection.test.tsx` | テスト |
| `frontend/src/components/TagSection/TagSection.module.css` | スタイル |
| `frontend/src/components/RewatchControl/RewatchControl.tsx` | 再視聴回数コントロール |
| `frontend/src/components/RewatchControl/RewatchControl.test.tsx` | テスト |
| `frontend/src/components/RewatchControl/RewatchControl.module.css` | スタイル |
| `frontend/src/components/StatsSummary/StatsSummary.tsx` | 統計サマリーセクション |
| `frontend/src/components/StatsSummary/StatsSummary.test.tsx` | テスト |
| `frontend/src/components/StatsSummary/StatsSummary.module.css` | スタイル |
| `frontend/src/hooks/useEpisodeReviews.ts` | 話数感想のロジックhook（複数ページから参照可能のためhooksディレクトリに配置） |
| `frontend/src/hooks/useTags.ts` | タグのロジックhook（WorkDetailPage + LibraryPageで共有） |
| `frontend/src/hooks/useStatistics.ts` | 統計のロジックhook（DashboardPageのみで使用するがhooksに統一） |

### フロントエンド — 既存修正

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/lib/types.ts` | EpisodeReview/Tag/Statistics型追加、UserRecord型にreview_text/visibility/tags追加 |
| `frontend/src/lib/recordsApi.ts` | update paramsにreview_text/rewatch_count追加 |
| `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx` | ReviewSection/EpisodeReviewSection/TagSection/RewatchControl統合 |
| `frontend/src/pages/WorkDetailPage/useWorkDetail.ts` | review_text/rewatch_count更新ハンドラー追加 |
| `frontend/src/pages/LibraryPage/LibraryPage.tsx` | タグフィルタUI追加、カードにタグバッジ表示 |
| `frontend/src/pages/LibraryPage/useLibrary.ts` | タグフィルタパラメータ追加 |
| `frontend/src/pages/DashboardPage/DashboardPage.tsx` | StatsSummary統合 |

---

## 機能1: 話数ごとの感想・全体感想

### Task 1: DBマイグレーション — Recordにreview_text/visibility追加

**Files:**
- Create: `backend/db/migrate/XXXXXX_add_review_fields_to_records.rb`

- [ ] **Step 1: マイグレーション作成**

```bash
cd backend && docker compose exec backend bin/rails generate migration AddReviewFieldsToRecords review_text:text visibility:integer
```

- [ ] **Step 2: マイグレーションファイルを編集**

生成されたファイルを以下の内容に修正:

```ruby
class AddReviewFieldsToRecords < ActiveRecord::Migration[8.1]
  def change
    add_column :records, :review_text, :text
    add_column :records, :visibility, :integer, default: 0, null: false
  end
end
```

- [ ] **Step 3: マイグレーション実行**

```bash
docker compose exec backend bin/rails db:migrate
```

Expected: schema.rbにreview_text, visibilityカラムが追加される

- [ ] **Step 4: コミット**

```bash
git add backend/db/migrate/*_add_review_fields_to_records.rb backend/db/schema.rb
git commit -m "feat: Recordにreview_text・visibilityカラムを追加"
```

---

### Task 2: DBマイグレーション — EpisodeReviewテーブル作成

**Files:**
- Create: `backend/db/migrate/XXXXXX_create_episode_reviews.rb`

- [ ] **Step 1: マイグレーション作成**

```bash
cd backend && docker compose exec backend bin/rails generate migration CreateEpisodeReviews
```

- [ ] **Step 2: マイグレーションファイルを編集**

```ruby
class CreateEpisodeReviews < ActiveRecord::Migration[8.1]
  def change
    create_table :episode_reviews do |t|
      t.references :record, null: false, foreign_key: true
      t.integer :episode_number, null: false
      t.text :body, null: false
      t.integer :visibility, default: 0, null: false
      t.timestamps null: false
    end

    add_index :episode_reviews, [:record_id, :episode_number], unique: true
  end
end
```

- [ ] **Step 3: マイグレーション実行**

```bash
docker compose exec backend bin/rails db:migrate
```

Expected: schema.rbにepisode_reviewsテーブルが追加される

- [ ] **Step 4: コミット**

```bash
git add backend/db/migrate/*_create_episode_reviews.rb backend/db/schema.rb
git commit -m "feat: episode_reviewsテーブルを作成"
```

---

### Task 3: Recordモデル更新 — review_text/visibility/リレーション

**Files:**
- Modify: `backend/app/models/record.rb`
- Modify: `backend/spec/models/record_spec.rb`

- [ ] **Step 1: Recordモデルにテスト追加（失敗するテスト）**

`backend/spec/models/record_spec.rb` に以下を追加:

```ruby
describe 'review_text' do
  it 'review_textを保存できる' do
    record.update(review_text: '素晴らしい作品だった')
    expect(record.reload.review_text).to eq('素晴らしい作品だった')
  end

  it '10,000文字を超えるreview_textは無効' do
    record.review_text = 'あ' * 10_001
    expect(record).not_to be_valid
    expect(record.errors[:review_text]).to be_present
  end

  it '10,000文字ちょうどのreview_textは有効' do
    record.review_text = 'あ' * 10_000
    expect(record).to be_valid
  end
end

describe 'visibility' do
  it 'デフォルトでprivateになる' do
    expect(record.visibility).to eq('private_record')
  end

  it 'publicに変更できる' do
    record.update(visibility: :public_record)
    expect(record.reload.visibility).to eq('public_record')
  end
end

describe 'episode_reviews association' do
  it 'has_many :episode_reviews' do
    expect(Record.reflect_on_association(:episode_reviews).macro).to eq(:has_many)
  end
end
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/models/record_spec.rb
```

Expected: visibility enum未定義等で失敗

- [ ] **Step 3: Recordモデル実装**

`backend/app/models/record.rb` に以下を追加:

```ruby
# 既存のenum :statusの後に追加
enum :visibility, { private_record: 0, public_record: 1 }, prefix: :visibility

# リレーション追加
has_many :episode_reviews, dependent: :destroy

# バリデーション追加
validates :review_text, length: { maximum: 10_000 }
```

注意: Rubyの予約語`private`/`public`との衝突を避けるため、enum値に`_record`サフィックスを付ける。

- [ ] **Step 4: テスト実行（成功確認）**

```bash
docker compose exec backend bundle exec rspec spec/models/record_spec.rb
```

Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/models/record.rb backend/spec/models/record_spec.rb
git commit -m "feat: Recordにreview_text・visibility・episode_reviewsリレーションを追加"
```

---

### Task 4: EpisodeReviewモデル

**Files:**
- Create: `backend/app/models/episode_review.rb`
- Create: `backend/spec/models/episode_review_spec.rb`

- [ ] **Step 1: モデルテスト作成（失敗するテスト）**

`backend/spec/models/episode_review_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe EpisodeReview, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work) { Work.create!(title: 'テスト作品', media_type: :anime, total_episodes: 24) }
  let(:record) { Record.create!(user: user, work: work, status: :watching) }

  describe 'バリデーション' do
    it '有効なepisode_reviewを作成できる' do
      review = EpisodeReview.new(record: record, episode_number: 1, body: '面白かった')
      expect(review).to be_valid
    end

    it 'bodyが必須' do
      review = EpisodeReview.new(record: record, episode_number: 1, body: nil)
      expect(review).not_to be_valid
    end

    it 'bodyが空文字は無効' do
      review = EpisodeReview.new(record: record, episode_number: 1, body: '')
      expect(review).not_to be_valid
    end

    it 'bodyが10,000文字を超えると無効' do
      review = EpisodeReview.new(record: record, episode_number: 1, body: 'あ' * 10_001)
      expect(review).not_to be_valid
    end

    it 'episode_numberが必須' do
      review = EpisodeReview.new(record: record, episode_number: nil, body: '面白い')
      expect(review).not_to be_valid
    end

    it 'episode_numberが0以下は無効' do
      review = EpisodeReview.new(record: record, episode_number: 0, body: '面白い')
      expect(review).not_to be_valid
    end

    it 'episode_numberがtotal_episodesを超えると無効' do
      review = EpisodeReview.new(record: record, episode_number: 25, body: '面白い')
      expect(review).not_to be_valid
    end

    it 'total_episodesが未設定の場合はepisode_numberの上限チェックなし' do
      work_no_total = Work.create!(title: '話数未定', media_type: :anime)
      record2 = Record.create!(user: user, work: work_no_total, status: :watching)
      review = EpisodeReview.new(record: record2, episode_number: 999, body: '面白い')
      expect(review).to be_valid
    end

    it '同じrecordの同じepisode_numberで重複作成は無効' do
      EpisodeReview.create!(record: record, episode_number: 1, body: '初回')
      duplicate = EpisodeReview.new(record: record, episode_number: 1, body: '2回目')
      expect(duplicate).not_to be_valid
    end
  end

  describe 'リレーション' do
    it 'recordに属する' do
      expect(EpisodeReview.reflect_on_association(:record).macro).to eq(:belongs_to)
    end
  end

  describe 'デフォルト値' do
    it 'visibilityはデフォルトでprivate' do
      review = EpisodeReview.create!(record: record, episode_number: 1, body: '面白い')
      expect(review.visibility).to eq('private_record')
    end
  end
end
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/models/episode_review_spec.rb
```

Expected: EpisodeReviewクラスが未定義で失敗

- [ ] **Step 3: EpisodeReviewモデル実装**

`backend/app/models/episode_review.rb`:

```ruby
class EpisodeReview < ApplicationRecord
  belongs_to :record

  enum :visibility, { private_record: 0, public_record: 1 }, prefix: :visibility

  validates :episode_number, presence: true,
                             numericality: { only_integer: true, greater_than: 0 }
  validates :body, presence: true, length: { maximum: 10_000 }
  validates :episode_number, uniqueness: { scope: :record_id }
  validate :episode_number_within_total

  private

  def episode_number_within_total
    total = record&.work&.total_episodes
    return if total.nil?
    return if episode_number.nil?

    errors.add(:episode_number, "は#{total}以下にしてください") if episode_number > total
  end
end
```

- [ ] **Step 4: テスト実行（成功確認）**

```bash
docker compose exec backend bundle exec rspec spec/models/episode_review_spec.rb
```

Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/models/episode_review.rb backend/spec/models/episode_review_spec.rb
git commit -m "feat: EpisodeReviewモデルを追加"
```

---

### Task 5: EpisodeReviewsコントローラー + ルーティング

**Files:**
- Create: `backend/app/controllers/api/v1/episode_reviews_controller.rb`
- Create: `backend/spec/requests/api/v1/episode_reviews_spec.rb`
- Modify: `backend/config/routes.rb`

- [ ] **Step 1: ルーティング追加**

`backend/config/routes.rb` の `resources :records` を修正:

```ruby
resources :records, only: %i[index show create update destroy] do
  resources :episode_reviews, only: %i[index create update destroy]
end
```

- [ ] **Step 2: request specを作成（失敗するテスト）**

`backend/spec/requests/api/v1/episode_reviews_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe 'Api::V1::EpisodeReviews', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:other_user) { User.create!(username: 'other', email: 'other@example.com', password: 'password123') }
  let(:work) { Work.create!(title: 'テストアニメ', media_type: :anime, total_episodes: 24) }
  let(:record) { Record.create!(user: user, work: work, status: :watching) }
  let(:other_record) { Record.create!(user: other_user, work: work, status: :watching) }

  describe 'GET /api/v1/records/:record_id/episode_reviews' do
    context '認証済み' do
      before { sign_in user }

      it '話数感想一覧をepisode_number昇順で返す' do
        EpisodeReview.create!(record: record, episode_number: 3, body: '3話感想')
        EpisodeReview.create!(record: record, episode_number: 1, body: '1話感想')
        EpisodeReview.create!(record: record, episode_number: 2, body: '2話感想')

        get "/api/v1/records/#{record.id}/episode_reviews"

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['episode_reviews'].length).to eq(3)
        expect(json['episode_reviews'].map { |r| r['episode_number'] }).to eq([1, 2, 3])
      end

      it '他ユーザーの記録の感想は取得できない' do
        get "/api/v1/records/#{other_record.id}/episode_reviews"
        expect(response).to have_http_status(:forbidden)
      end
    end

    context '未認証' do
      it '401を返す' do
        get "/api/v1/records/#{record.id}/episode_reviews"
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'POST /api/v1/records/:record_id/episode_reviews' do
    before { sign_in user }

    it '話数感想を作成できる' do
      post "/api/v1/records/#{record.id}/episode_reviews",
           params: { episode_review: { episode_number: 1, body: '神回だった' } }

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['episode_review']['episode_number']).to eq(1)
      expect(json['episode_review']['body']).to eq('神回だった')
    end

    it '同じ話数の重複作成は422を返す' do
      EpisodeReview.create!(record: record, episode_number: 1, body: '初回')

      post "/api/v1/records/#{record.id}/episode_reviews",
           params: { episode_review: { episode_number: 1, body: '2回目' } }

      expect(response).to have_http_status(:unprocessable_content)
    end

    it 'bodyが空なら422を返す' do
      post "/api/v1/records/#{record.id}/episode_reviews",
           params: { episode_review: { episode_number: 1, body: '' } }

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe 'PATCH /api/v1/records/:record_id/episode_reviews/:id' do
    before { sign_in user }

    let!(:review) { EpisodeReview.create!(record: record, episode_number: 1, body: '初版') }

    it '感想を更新できる' do
      patch "/api/v1/records/#{record.id}/episode_reviews/#{review.id}",
            params: { episode_review: { body: '更新版' } }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['episode_review']['body']).to eq('更新版')
    end
  end

  describe 'DELETE /api/v1/records/:record_id/episode_reviews/:id' do
    before { sign_in user }

    let!(:review) { EpisodeReview.create!(record: record, episode_number: 1, body: '削除対象') }

    it '感想を削除できる' do
      delete "/api/v1/records/#{record.id}/episode_reviews/#{review.id}"
      expect(response).to have_http_status(:no_content)
      expect(EpisodeReview.find_by(id: review.id)).to be_nil
    end
  end
end
```

- [ ] **Step 3: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/episode_reviews_spec.rb
```

Expected: コントローラー未定義で失敗

- [ ] **Step 4: コントローラー実装**

`backend/app/controllers/api/v1/episode_reviews_controller.rb`:

```ruby
module Api
  module V1
    class EpisodeReviewsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_record
      before_action :authorize_record!
      before_action :set_episode_review, only: %i[update destroy]

      def index
        reviews = @record.episode_reviews.order(episode_number: :asc)
        render json: { episode_reviews: reviews }
      end

      def create
        review = @record.episode_reviews.build(episode_review_params)

        if review.save
          render json: { episode_review: review }, status: :created
        else
          render json: { errors: review.errors.full_messages }, status: :unprocessable_content
        end
      end

      def update
        if @episode_review.update(episode_review_update_params)
          render json: { episode_review: @episode_review }
        else
          render json: { errors: @episode_review.errors.full_messages }, status: :unprocessable_content
        end
      end

      def destroy
        @episode_review.destroy!
        head :no_content
      end

      private

      def set_record
        @record = Record.find(params[:record_id])
      end

      def authorize_record!
        return if @record.user_id == current_user.id

        render json: { error: '権限がありません' }, status: :forbidden
      end

      def set_episode_review
        @episode_review = @record.episode_reviews.find(params[:id])
      end

      def episode_review_params
        params.expect(episode_review: %i[episode_number body])
      end

      def episode_review_update_params
        params.expect(episode_review: %i[body])
      end
    end
  end
end
```

- [ ] **Step 5: テスト実行（成功確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/episode_reviews_spec.rb
```

Expected: 全テストPASS

- [ ] **Step 6: コミット**

```bash
git add backend/app/controllers/api/v1/episode_reviews_controller.rb backend/spec/requests/api/v1/episode_reviews_spec.rb backend/config/routes.rb
git commit -m "feat: 話数感想CRUD APIを追加"
```

---

### Task 6: RecordsController更新 — review_text/rewatch_countをStrong Paramsに追加

**Files:**
- Modify: `backend/app/controllers/api/v1/records_controller.rb`
- Modify: `backend/spec/requests/api/v1/records_spec.rb`

- [ ] **Step 1: テスト追加（失敗するテスト）**

`backend/spec/requests/api/v1/records_spec.rb` に以下を追加:

```ruby
describe 'PATCH /api/v1/records/:id — review_text' do
  before { sign_in user }

  it 'review_textを更新できる' do
    patch "/api/v1/records/#{record.id}",
          params: { record: { review_text: '素晴らしい作品だった' } }

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['record']['review_text']).to eq('素晴らしい作品だった')
  end
end

describe 'PATCH /api/v1/records/:id — rewatch_count' do
  before { sign_in user }

  it 'rewatch_countを更新できる' do
    patch "/api/v1/records/#{record.id}",
          params: { record: { rewatch_count: 2 } }

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['record']['rewatch_count']).to eq(2)
  end
end
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/records_spec.rb
```

Expected: review_text/rewatch_countがStrong Parametersに含まれないため失敗

- [ ] **Step 3: Strong Parameters更新**

`backend/app/controllers/api/v1/records_controller.rb` の `record_update_params` を修正:

```ruby
def record_update_params
  # 注意: visibilityはフェーズ2では受け付けない（スペック参照）。フェーズ3で追加する
  params.expect(record: %i[status rating current_episode started_at completed_at review_text rewatch_count])
end
```

- [ ] **Step 4: テスト実行（成功確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/records_spec.rb
```

Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/controllers/api/v1/records_controller.rb backend/spec/requests/api/v1/records_spec.rb
git commit -m "feat: Records APIにreview_text・rewatch_countパラメータを追加"
```

---

### Task 7: フロントエンド型定義 + recordsApi更新

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/recordsApi.ts`
- Modify: `frontend/src/lib/recordsApi.test.ts`

- [ ] **Step 1: 型定義を追加**

`frontend/src/lib/types.ts` に以下を追加:

```typescript
// EpisodeReview型
export interface EpisodeReview {
  id: number;
  record_id: number;
  episode_number: number;
  body: string;
  visibility: 'private_record' | 'public_record';
  created_at: string;
  updated_at: string;
}

// Tag型
export interface Tag {
  id: number;
  name: string;
  user_id: number;
  created_at: string;
}

// Statistics型
export interface Statistics {
  by_genre: Record<MediaType, number>;
  by_status: Record<RecordStatus, number>;
  monthly_completions: Array<{ month: string; count: number }>;
  totals: {
    episodes_watched: number;
    volumes_read: number;
  };
}
```

`UserRecord`インターフェースに追加:

```typescript
// 既存のフィールドに追加
review_text: string | null;
visibility: 'private_record' | 'public_record';
tags?: Tag[];
```

`RecordUpdateParams`インターフェースに追加:

```typescript
review_text?: string;
rewatch_count?: number;
```

- [ ] **Step 2: recordsApi更新**

`frontend/src/lib/recordsApi.ts` の `update` メソッドのparamsに `review_text` と `rewatch_count` が含まれるよう確認。`RecordUpdateParams` 型の変更で自動的に対応されるが、型が正しく伝播しているかテストで確認。

- [ ] **Step 3: テスト追加**

`frontend/src/lib/recordsApi.test.ts` に以下を追加:

```typescript
describe('update — review_text', () => {
  it('review_textを送信できる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ record: { ...mockRecord, review_text: '面白かった' } }),
    });

    const result = await recordsApi.update(1, { review_text: '面白かった' });
    expect(result.record.review_text).toBe('面白かった');

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.record.review_text).toBe('面白かった');
  });
});

describe('update — rewatch_count', () => {
  it('rewatch_countを送信できる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ record: { ...mockRecord, rewatch_count: 3 } }),
    });

    const result = await recordsApi.update(1, { rewatch_count: 3 });
    expect(result.record.rewatch_count).toBe(3);
  });
});
```

- [ ] **Step 4: テスト実行**

```bash
cd frontend && npx vitest run src/lib/recordsApi.test.ts
```

Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/recordsApi.ts frontend/src/lib/recordsApi.test.ts
git commit -m "feat: フロントエンド型定義にEpisodeReview・Tag・Statistics型を追加"
```

---

### Task 8: フロントエンド — episodeReviewsApi

**Files:**
- Create: `frontend/src/lib/episodeReviewsApi.ts`
- Create: `frontend/src/lib/episodeReviewsApi.test.ts`

- [ ] **Step 1: テスト作成（失敗するテスト）**

`frontend/src/lib/episodeReviewsApi.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { episodeReviewsApi } from './episodeReviewsApi';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockReview = {
  id: 1,
  record_id: 10,
  episode_number: 1,
  body: '面白かった',
  visibility: 'private_record',
  created_at: '2026-03-25T00:00:00Z',
  updated_at: '2026-03-25T00:00:00Z',
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe('episodeReviewsApi', () => {
  describe('getAll', () => {
    it('指定recordの話数感想一覧を取得', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ episode_reviews: [mockReview] }),
      });

      const result = await episodeReviewsApi.getAll(10);
      expect(result.episode_reviews).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/records/10/episode_reviews'),
        expect.any(Object)
      );
    });
  });

  describe('create', () => {
    it('話数感想を作成', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ episode_review: mockReview }),
      });

      const result = await episodeReviewsApi.create(10, { episode_number: 1, body: '面白かった' });
      expect(result.episode_review.body).toBe('面白かった');
    });
  });

  describe('update', () => {
    it('話数感想を更新', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ episode_review: { ...mockReview, body: '更新済み' } }),
      });

      const result = await episodeReviewsApi.update(10, 1, { body: '更新済み' });
      expect(result.episode_review.body).toBe('更新済み');
    });
  });

  describe('remove', () => {
    it('話数感想を削除', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve({}) });

      await episodeReviewsApi.remove(10, 1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/records/10/episode_reviews/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
```

- [ ] **Step 2: API実装**

`frontend/src/lib/episodeReviewsApi.ts`:

```typescript
import { request } from './api';
import type { EpisodeReview } from './types';

interface EpisodeReviewsListResponse {
  episode_reviews: EpisodeReview[];
}

interface EpisodeReviewResponse {
  episode_review: EpisodeReview;
}

interface CreateParams {
  episode_number: number;
  body: string;
}

interface UpdateParams {
  body: string;
}

export const episodeReviewsApi = {
  async getAll(recordId: number): Promise<EpisodeReviewsListResponse> {
    return request<EpisodeReviewsListResponse>(`/records/${recordId}/episode_reviews`);
  },

  async create(recordId: number, params: CreateParams): Promise<EpisodeReviewResponse> {
    return request<EpisodeReviewResponse>(`/records/${recordId}/episode_reviews`, {
      method: 'POST',
      body: JSON.stringify({ episode_review: params }),
    });
  },

  async update(recordId: number, reviewId: number, params: UpdateParams): Promise<EpisodeReviewResponse> {
    return request<EpisodeReviewResponse>(`/records/${recordId}/episode_reviews/${reviewId}`, {
      method: 'PATCH',
      body: JSON.stringify({ episode_review: params }),
    });
  },

  async remove(recordId: number, reviewId: number): Promise<void> {
    // 204 No Contentのためresponse.json()をスキップする必要がある
    // 既存のrecordsApi.remove()のパターンに合わせて実装
    await fetch(`${API_BASE}/records/${recordId}/episode_reviews/${reviewId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  },
};
```

- [ ] **Step 3: テスト実行**

```bash
cd frontend && npx vitest run src/lib/episodeReviewsApi.test.ts
```

Expected: 全テストPASS

- [ ] **Step 4: コミット**

```bash
git add frontend/src/lib/episodeReviewsApi.ts frontend/src/lib/episodeReviewsApi.test.ts
git commit -m "feat: episodeReviewsApi クライアントを追加"
```

---

### Task 9: フロントエンド — ReviewSection + EpisodeReviewSectionコンポーネント

**Files:**
- Create: `frontend/src/hooks/useEpisodeReviews.ts`
- Create: `frontend/src/components/ReviewSection/ReviewSection.tsx`
- Create: `frontend/src/components/ReviewSection/ReviewSection.test.tsx`
- Create: `frontend/src/components/ReviewSection/ReviewSection.module.css`
- Create: `frontend/src/components/EpisodeReviewSection/EpisodeReviewSection.tsx`
- Create: `frontend/src/components/EpisodeReviewSection/EpisodeReviewSection.test.tsx`
- Create: `frontend/src/components/EpisodeReviewSection/EpisodeReviewSection.module.css`

- [ ] **Step 1: useEpisodeReviews hook作成**

`frontend/src/hooks/useEpisodeReviews.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { episodeReviewsApi } from '../lib/episodeReviewsApi';
import type { EpisodeReview } from '../lib/types';

export function useEpisodeReviews(recordId: number) {
  const [reviews, setReviews] = useState<EpisodeReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchReviews = async () => {
      try {
        const res = await episodeReviewsApi.getAll(recordId);
        if (!cancelled) {
          setReviews(res.episode_reviews);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void fetchReviews();
    return () => { cancelled = true; };
  }, [recordId]);

  const createReview = useCallback(async (episodeNumber: number, body: string) => {
    const res = await episodeReviewsApi.create(recordId, { episode_number: episodeNumber, body });
    setReviews(prev => [...prev, res.episode_review].sort((a, b) => a.episode_number - b.episode_number));
  }, [recordId]);

  const updateReview = useCallback(async (reviewId: number, body: string) => {
    const res = await episodeReviewsApi.update(recordId, reviewId, { body });
    setReviews(prev => prev.map(r => r.id === reviewId ? res.episode_review : r));
  }, [recordId]);

  const deleteReview = useCallback(async (reviewId: number) => {
    await episodeReviewsApi.remove(recordId, reviewId);
    setReviews(prev => prev.filter(r => r.id !== reviewId));
  }, [recordId]);

  return { reviews, isLoading, createReview, updateReview, deleteReview };
}
```

- [ ] **Step 2: ReviewSection テスト作成**

`frontend/src/components/ReviewSection.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ReviewSection } from './ReviewSection';

describe('ReviewSection', () => {
  const mockOnSave = vi.fn();

  it('感想テキストを表示する', () => {
    render(<ReviewSection reviewText="素晴らしい作品" onSave={mockOnSave} />);
    expect(screen.getByDisplayValue('素晴らしい作品')).toBeInTheDocument();
  });

  it('未記入時にプレースホルダーを表示する', () => {
    render(<ReviewSection reviewText={null} onSave={mockOnSave} />);
    expect(screen.getByPlaceholderText('作品の感想を書く...')).toBeInTheDocument();
  });

  it('保存ボタンクリックでonSaveが呼ばれる', async () => {
    render(<ReviewSection reviewText="" onSave={mockOnSave} />);
    const textarea = screen.getByPlaceholderText('作品の感想を書く...');
    await userEvent.type(textarea, 'テスト感想');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mockOnSave).toHaveBeenCalledWith('テスト感想'));
  });
});
```

- [ ] **Step 3: ReviewSection 実装**

`frontend/src/components/ReviewSection.tsx`:

```tsx
import { useState } from 'react';
import styles from './ReviewSection.module.css';

interface Props {
  reviewText: string | null;
  onSave: (text: string) => Promise<void> | void;
}

export function ReviewSection({ reviewText, onSave }: Props) {
  const [text, setText] = useState(reviewText ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const isDirty = text !== (reviewText ?? '');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(text);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.label}>感想</div>
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="作品の感想を書く..."
        maxLength={10000}
      />
      {isDirty && (
        <div className={styles.actions}>
          <button
            className={styles.saveButton}
            onClick={() => void handleSave()}
            disabled={isSaving}
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: EpisodeReviewSection テスト作成**

`frontend/src/components/EpisodeReviewSection.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EpisodeReviewSection } from './EpisodeReviewSection';
import type { EpisodeReview } from '../lib/types';

vi.mock('../hooks/useEpisodeReviews', () => ({
  useEpisodeReviews: () => ({
    reviews: [
      { id: 1, episode_number: 1, body: '1話の感想', created_at: '2026-03-25T00:00:00Z' },
      { id: 2, episode_number: 2, body: '2話の感想', created_at: '2026-03-25T00:00:00Z' },
    ] as EpisodeReview[],
    isLoading: false,
    createReview: vi.fn(),
    updateReview: vi.fn(),
    deleteReview: vi.fn(),
  }),
}));

describe('EpisodeReviewSection', () => {
  it('話数感想一覧を表示する', () => {
    render(<EpisodeReviewSection recordId={1} currentEpisode={5} />);
    expect(screen.getByText('第1話')).toBeInTheDocument();
    expect(screen.getByText('第2話')).toBeInTheDocument();
  });

  it('感想入力フォームを表示する', () => {
    render(<EpisodeReviewSection recordId={1} currentEpisode={5} />);
    expect(screen.getByPlaceholderText('この話数の感想を書く...')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: EpisodeReviewSection 実装**

`frontend/src/components/EpisodeReviewSection.tsx`:

UIの詳細実装は既存コンポーネント（ProgressControlなど）のスタイルに合わせる。話数入力 + テキストエリア + 保存ボタン + 過去の感想一覧（話数降順、編集・削除機能付き）を構成。CSS Modulesで `EpisodeReviewSection.module.css` を作成。

- [ ] **Step 6: テスト実行**

```bash
cd frontend && npx vitest run src/components/ReviewSection/ReviewSection.test.tsx src/components/EpisodeReviewSection/EpisodeReviewSection.test.tsx
```

Expected: 全テストPASS

- [ ] **Step 7: コミット**

```bash
git add frontend/src/hooks/useEpisodeReviews.ts frontend/src/components/ReviewSection/ frontend/src/components/EpisodeReviewSection/
git commit -m "feat: ReviewSection・EpisodeReviewSectionコンポーネントを追加"
```

---

### Task 10: WorkDetailPage統合 — 全体感想 + 話数感想 + 再視聴回数

**Files:**
- Modify: `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`
- Modify: `frontend/src/pages/WorkDetailPage/useWorkDetail.ts`
- Create: `frontend/src/components/RewatchControl/RewatchControl.tsx`
- Create: `frontend/src/components/RewatchControl/RewatchControl.test.tsx`
- Create: `frontend/src/components/RewatchControl/RewatchControl.module.css`

- [ ] **Step 1: RewatchControlテスト作成**

`frontend/src/components/RewatchControl.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { RewatchControl } from './RewatchControl';

describe('RewatchControl', () => {
  it('再視聴回数を表示する', () => {
    render(<RewatchControl count={2} onChange={vi.fn()} />);
    expect(screen.getByText('2回')).toBeInTheDocument();
  });

  it('+ボタンでonChangeが呼ばれる', async () => {
    const onChange = vi.fn();
    render(<RewatchControl count={1} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '+' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('-ボタンで0未満にはならない', async () => {
    const onChange = vi.fn();
    render(<RewatchControl count={0} onChange={onChange} />);
    const minusBtn = screen.getByRole('button', { name: '-' });
    expect(minusBtn).toBeDisabled();
  });
});
```

- [ ] **Step 2: RewatchControl実装**

`frontend/src/components/RewatchControl.tsx`:

```tsx
import styles from './RewatchControl.module.css';

interface Props {
  count: number;
  onChange: (count: number) => void;
}

export function RewatchControl({ count, onChange }: Props) {
  return (
    <div className={styles.container}>
      <button
        className={styles.button}
        onClick={() => onChange(count - 1)}
        disabled={count <= 0}
        aria-label="-"
      >
        -
      </button>
      <span className={styles.count}>{count}回</span>
      <button
        className={styles.button}
        onClick={() => onChange(count + 1)}
        aria-label="+"
      >
        +
      </button>
    </div>
  );
}
```

- [ ] **Step 3: useWorkDetail hook更新**

`frontend/src/pages/WorkDetailPage/useWorkDetail.ts` に以下を追加:

```typescript
const handleReviewTextSave = useCallback(async (text: string) => {
  await updateRecord({ review_text: text });
}, [updateRecord]);

const handleRewatchCountChange = useCallback(async (count: number) => {
  await updateRecord({ rewatch_count: count });
}, [updateRecord]);
```

returnオブジェクトにこれらのハンドラーを追加。

- [ ] **Step 4: WorkDetailPage更新**

`frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx` に以下のセクションを追加（既存セクション間に挿入）:

- 進捗セクションの下に `RewatchControl`
- 日付セクションの下に `TagSection`（Task 14で実装）
- あらすじセクションの下に `ReviewSection`
- ReviewSectionの下に `EpisodeReviewSection`（話数があるジャンルのみ条件付き表示）

話数があるジャンルの判定:

```typescript
const HAS_EPISODES: MediaType[] = ['anime', 'drama', 'manga'];
const showEpisodeReviews = HAS_EPISODES.includes(record.work.media_type as MediaType);
```

- [ ] **Step 5: テスト実行**

```bash
cd frontend && npx vitest run src/components/RewatchControl/RewatchControl.test.tsx src/pages/WorkDetailPage/WorkDetailPage.test.tsx
```

Expected: 全テストPASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/RewatchControl/ frontend/src/pages/WorkDetailPage/useWorkDetail.ts frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx
git commit -m "feat: WorkDetailPageに全体感想・話数感想・再視聴回数UIを統合"
```

---

## 機能2: タグ機能

### Task 11: DBマイグレーション — Tag + RecordTagテーブル

**Files:**
- Create: `backend/db/migrate/XXXXXX_create_tags.rb`
- Create: `backend/db/migrate/XXXXXX_create_record_tags.rb`

- [ ] **Step 1: Tagマイグレーション作成・編集**

```bash
cd backend && docker compose exec backend bin/rails generate migration CreateTags
```

```ruby
class CreateTags < ActiveRecord::Migration[8.1]
  def change
    create_table :tags do |t|
      t.string :name, null: false, limit: 30
      t.references :user, null: false, foreign_key: true
      t.timestamps null: false
    end

    add_index :tags, [:user_id, :name], unique: true
  end
end
```

- [ ] **Step 2: RecordTagマイグレーション作成・編集**

```bash
cd backend && docker compose exec backend bin/rails generate migration CreateRecordTags
```

```ruby
class CreateRecordTags < ActiveRecord::Migration[8.1]
  def change
    create_table :record_tags do |t|
      t.references :record, null: false, foreign_key: true
      t.references :tag, null: false, foreign_key: true
    end

    add_index :record_tags, [:record_id, :tag_id], unique: true
  end
end
```

注意: `t.timestamps` は使用しない（中間テーブルのためスペックで定義済み）。IDカラムはRailsの`destroy`操作に必要なためデフォルト（`id: true`）を使用。

- [ ] **Step 3: マイグレーション実行**

```bash
docker compose exec backend bin/rails db:migrate
```

- [ ] **Step 4: コミット**

```bash
git add backend/db/migrate/*_create_tags.rb backend/db/migrate/*_create_record_tags.rb backend/db/schema.rb
git commit -m "feat: tags・record_tagsテーブルを作成"
```

---

### Task 12: Tag + RecordTagモデル

**Files:**
- Create: `backend/app/models/tag.rb`
- Create: `backend/app/models/record_tag.rb`
- Create: `backend/spec/models/tag_spec.rb`
- Create: `backend/spec/models/record_tag_spec.rb`
- Modify: `backend/app/models/record.rb`
- Modify: `backend/app/models/user.rb`

- [ ] **Step 1: モデルテスト作成（失敗するテスト）**

`backend/spec/models/tag_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe Tag, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe 'バリデーション' do
    it '有効なタグを作成できる' do
      tag = Tag.new(name: '泣ける', user: user)
      expect(tag).to be_valid
    end

    it 'nameが必須' do
      tag = Tag.new(name: nil, user: user)
      expect(tag).not_to be_valid
    end

    it 'nameが空文字は無効' do
      tag = Tag.new(name: '', user: user)
      expect(tag).not_to be_valid
    end

    it 'nameが30文字を超えると無効' do
      tag = Tag.new(name: 'あ' * 31, user: user)
      expect(tag).not_to be_valid
    end

    it '同一ユーザーで同名タグは重複不可' do
      Tag.create!(name: '泣ける', user: user)
      duplicate = Tag.new(name: '泣ける', user: user)
      expect(duplicate).not_to be_valid
    end

    it '異なるユーザーなら同名タグは作成可能' do
      other = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
      Tag.create!(name: '泣ける', user: user)
      tag = Tag.new(name: '泣ける', user: other)
      expect(tag).to be_valid
    end
  end

  describe 'リレーション' do
    it 'userに属する' do
      expect(Tag.reflect_on_association(:user).macro).to eq(:belongs_to)
    end

    it 'record_tagsをhas_many' do
      expect(Tag.reflect_on_association(:record_tags).macro).to eq(:has_many)
    end
  end
end
```

`backend/spec/models/record_tag_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe RecordTag, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work) { Work.create!(title: 'テスト', media_type: :anime) }
  let(:record) { Record.create!(user: user, work: work, status: :watching) }
  let(:tag) { Tag.create!(name: '泣ける', user: user) }

  describe 'バリデーション' do
    it '同じrecordとtagの組み合わせは重複不可' do
      RecordTag.create!(record: record, tag: tag)
      duplicate = RecordTag.new(record: record, tag: tag)
      expect(duplicate).not_to be_valid
    end
  end
end
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/models/tag_spec.rb spec/models/record_tag_spec.rb
```

- [ ] **Step 3: モデル実装**

`backend/app/models/tag.rb`:

```ruby
class Tag < ApplicationRecord
  belongs_to :user
  has_many :record_tags, dependent: :destroy

  validates :name, presence: true, length: { maximum: 30 }
  validates :name, uniqueness: { scope: :user_id }
end
```

`backend/app/models/record_tag.rb`:

```ruby
class RecordTag < ApplicationRecord
  belongs_to :record
  belongs_to :tag

  validates :tag_id, uniqueness: { scope: :record_id }
end
```

`backend/app/models/record.rb` にリレーション追加:

```ruby
has_many :record_tags, dependent: :destroy
has_many :tags, through: :record_tags
```

`backend/app/models/user.rb` にリレーション追加:

```ruby
has_many :tags, dependent: :destroy
```

- [ ] **Step 4: テスト実行（成功確認）**

```bash
docker compose exec backend bundle exec rspec spec/models/tag_spec.rb spec/models/record_tag_spec.rb
```

- [ ] **Step 5: コミット**

```bash
git add backend/app/models/tag.rb backend/app/models/record_tag.rb backend/app/models/record.rb backend/app/models/user.rb backend/spec/models/tag_spec.rb backend/spec/models/record_tag_spec.rb
git commit -m "feat: Tag・RecordTagモデルを追加"
```

---

### Task 13: Tags + RecordTagsコントローラー + ルーティング

**Files:**
- Create: `backend/app/controllers/api/v1/tags_controller.rb`
- Create: `backend/app/controllers/api/v1/record_tags_controller.rb`
- Create: `backend/spec/requests/api/v1/tags_spec.rb`
- Create: `backend/spec/requests/api/v1/record_tags_spec.rb`
- Modify: `backend/config/routes.rb`

- [ ] **Step 1: ルーティング追加**

`backend/config/routes.rb` に追加:

```ruby
resources :tags, only: %i[index destroy]

# recordsのネストリソースにtagsを追加
resources :records, only: %i[index show create update destroy] do
  resources :episode_reviews, only: %i[index create update destroy]
  resources :tags, only: %i[create destroy], controller: 'record_tags'
end
```

- [ ] **Step 2: request spec作成（失敗するテスト）**

`backend/spec/requests/api/v1/tags_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe 'Api::V1::Tags', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe 'GET /api/v1/tags' do
    before { sign_in user }

    it '自分のタグ一覧を返す' do
      Tag.create!(name: '泣ける', user: user)
      Tag.create!(name: '熱い', user: user)

      get '/api/v1/tags'

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['tags'].length).to eq(2)
    end

    it '他ユーザーのタグは含まれない' do
      other = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
      Tag.create!(name: '他人のタグ', user: other)

      get '/api/v1/tags'

      json = JSON.parse(response.body)
      expect(json['tags']).to be_empty
    end
  end

  describe 'DELETE /api/v1/tags/:id' do
    before { sign_in user }

    it 'タグを削除する（関連record_tagsも削除）' do
      tag = Tag.create!(name: '泣ける', user: user)
      work = Work.create!(title: 'テスト', media_type: :anime)
      record = Record.create!(user: user, work: work, status: :watching)
      RecordTag.create!(record: record, tag: tag)

      delete "/api/v1/tags/#{tag.id}"

      expect(response).to have_http_status(:no_content)
      expect(Tag.find_by(id: tag.id)).to be_nil
      expect(RecordTag.where(tag_id: tag.id)).to be_empty
    end

    it '他ユーザーのタグは削除できない' do
      other = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
      tag = Tag.create!(name: '他人のタグ', user: other)

      delete "/api/v1/tags/#{tag.id}"

      expect(response).to have_http_status(:forbidden)
    end
  end
end
```

`backend/spec/requests/api/v1/record_tags_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe 'Api::V1::RecordTags', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work) { Work.create!(title: 'テスト', media_type: :anime) }
  let(:record) { Record.create!(user: user, work: work, status: :watching) }

  describe 'POST /api/v1/records/:record_id/tags' do
    before { sign_in user }

    it '新規タグを作成して記録に紐付ける' do
      post "/api/v1/records/#{record.id}/tags",
           params: { tag: { name: '泣ける' } }

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['tag']['name']).to eq('泣ける')
      expect(record.tags.pluck(:name)).to include('泣ける')
    end

    it '既存タグを再利用して紐付ける' do
      Tag.create!(name: '泣ける', user: user)

      post "/api/v1/records/#{record.id}/tags",
           params: { tag: { name: '泣ける' } }

      expect(response).to have_http_status(:created)
      expect(Tag.where(name: '泣ける', user: user).count).to eq(1)
    end

    it '既に紐付け済みのタグは422を返す' do
      tag = Tag.create!(name: '泣ける', user: user)
      RecordTag.create!(record: record, tag: tag)

      post "/api/v1/records/#{record.id}/tags",
           params: { tag: { name: '泣ける' } }

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe 'DELETE /api/v1/records/:record_id/tags/:id' do
    before { sign_in user }

    it '記録からタグを除去する（タグ自体は残る）' do
      tag = Tag.create!(name: '泣ける', user: user)
      RecordTag.create!(record: record, tag: tag)

      delete "/api/v1/records/#{record.id}/tags/#{tag.id}"

      expect(response).to have_http_status(:no_content)
      expect(record.tags).not_to include(tag)
      expect(Tag.find_by(id: tag.id)).to be_present
    end
  end
end
```

- [ ] **Step 3: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/tags_spec.rb spec/requests/api/v1/record_tags_spec.rb
```

- [ ] **Step 4: コントローラー実装**

`backend/app/controllers/api/v1/tags_controller.rb`:

```ruby
module Api
  module V1
    class TagsController < ApplicationController
      before_action :authenticate_user!

      def index
        tags = current_user.tags.order(:name)
        render json: { tags: tags }
      end

      def destroy
        tag = current_user.tags.find_by(id: params[:id])

        if tag.nil?
          render json: { error: '権限がありません' }, status: :forbidden
          return
        end

        tag.destroy!
        head :no_content
      end
    end
  end
end
```

`backend/app/controllers/api/v1/record_tags_controller.rb`:

```ruby
module Api
  module V1
    class RecordTagsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_record
      before_action :authorize_record!

      def create
        tag = current_user.tags.find_or_initialize_by(name: tag_params[:name])

        unless tag.persisted?
          unless tag.save
            render json: { errors: tag.errors.full_messages }, status: :unprocessable_content
            return
          end
        end

        record_tag = @record.record_tags.build(tag: tag)

        if record_tag.save
          render json: { tag: tag }, status: :created
        else
          render json: { errors: record_tag.errors.full_messages }, status: :unprocessable_content
        end
      end

      def destroy
        record_tag = @record.record_tags.find_by!(tag_id: params[:id])
        record_tag.destroy!
        head :no_content
      end

      private

      def set_record
        @record = Record.find(params[:record_id])
      end

      def authorize_record!
        return if @record.user_id == current_user.id

        render json: { error: '権限がありません' }, status: :forbidden
      end

      def tag_params
        params.expect(tag: %i[name])
      end
    end
  end
end
```

- [ ] **Step 5: テスト実行（成功確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/tags_spec.rb spec/requests/api/v1/record_tags_spec.rb
```

- [ ] **Step 6: コミット**

```bash
git add backend/app/controllers/api/v1/tags_controller.rb backend/app/controllers/api/v1/record_tags_controller.rb backend/spec/requests/api/v1/tags_spec.rb backend/spec/requests/api/v1/record_tags_spec.rb backend/config/routes.rb
git commit -m "feat: タグCRUD APIを追加"
```

---

### Task 14: RecordsController — タグフィルタ拡張

**Files:**
- Modify: `backend/app/controllers/api/v1/records_controller.rb`
- Modify: `backend/spec/requests/api/v1/records_spec.rb`

- [ ] **Step 1: テスト追加（失敗するテスト）**

`backend/spec/requests/api/v1/records_spec.rb` に追加:

```ruby
describe 'GET /api/v1/records — タグフィルタ' do
  before { sign_in user }

  let(:work1) { Work.create!(title: '作品1', media_type: :anime) }
  let(:work2) { Work.create!(title: '作品2', media_type: :anime) }
  let(:record1) { Record.create!(user: user, work: work1, status: :watching) }
  let(:record2) { Record.create!(user: user, work: work2, status: :watching) }

  it '単一タグでフィルタできる' do
    tag = Tag.create!(name: '泣ける', user: user)
    RecordTag.create!(record: record1, tag: tag)

    get '/api/v1/records', params: { 'tag' => ['泣ける'] }

    json = JSON.parse(response.body)
    expect(json['records'].length).to eq(1)
    expect(json['records'][0]['id']).to eq(record1.id)
  end

  it '複数タグでANDフィルタできる' do
    tag1 = Tag.create!(name: '泣ける', user: user)
    tag2 = Tag.create!(name: '熱い', user: user)
    RecordTag.create!(record: record1, tag: tag1)
    RecordTag.create!(record: record1, tag: tag2)
    RecordTag.create!(record: record2, tag: tag1)

    get '/api/v1/records', params: { 'tag' => ['泣ける', '熱い'] }

    json = JSON.parse(response.body)
    expect(json['records'].length).to eq(1)
    expect(json['records'][0]['id']).to eq(record1.id)
  end
end
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/records_spec.rb
```

- [ ] **Step 3: RecordsController更新**

既存の `apply_filters` メソッドのパターン（`filter_by_status`, `filter_by_media_type` 等の個別メソッド）に合わせて `filter_by_tags` メソッドを新設:

```ruby
# apply_filters メソッド内に追加
records = filter_by_tags(records)
```

```ruby
def filter_by_tags(records)
  return records unless params[:tag].present?

  tag_names = Array(params[:tag])
  tag_names.each do |tag_name|
    records = records.where(
      id: RecordTag.joins(:tag)
                   .where(tags: { name: tag_name, user_id: current_user.id })
                   .select(:record_id)
    )
  end
  records
end
```

また、records一覧のレスポンスにtagsを含めるため以下を変更:

1. `index` メソッドの `includes` に `:tags` を追加: `current_user.records.includes(:work, :tags)`
2. レコードのJSON出力に `tags` を含める: `as_json(include: [:work, :tags])` に変更（既存の `as_json(include: :work)` を全箇所で更新）

- [ ] **Step 4: テスト実行（成功確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/records_spec.rb
```

- [ ] **Step 5: コミット**

```bash
git add backend/app/controllers/api/v1/records_controller.rb backend/spec/requests/api/v1/records_spec.rb
git commit -m "feat: Records APIにタグフィルタを追加"
```

---

### Task 15: フロントエンド — tagsApi + TagSectionコンポーネント

**Files:**
- Create: `frontend/src/lib/tagsApi.ts`
- Create: `frontend/src/lib/tagsApi.test.ts`
- Create: `frontend/src/hooks/useTags.ts`
- Create: `frontend/src/components/TagSection/TagSection.tsx`
- Create: `frontend/src/components/TagSection/TagSection.test.tsx`
- Create: `frontend/src/components/TagSection/TagSection.module.css`

- [ ] **Step 1: tagsApiテスト作成**

`frontend/src/lib/tagsApi.test.ts` — episodeReviewsApiと同様のパターンで、getAll / addToRecord / removeFromRecord / deleteTag の4メソッドをテスト。

- [ ] **Step 2: tagsApi実装**

`frontend/src/lib/tagsApi.ts`:

```typescript
import { request } from './api';
import type { Tag } from './types';

interface TagsListResponse {
  tags: Tag[];
}

interface TagResponse {
  tag: Tag;
}

export const tagsApi = {
  async getAll(): Promise<TagsListResponse> {
    return request<TagsListResponse>('/tags');
  },

  async addToRecord(recordId: number, name: string): Promise<TagResponse> {
    return request<TagResponse>(`/records/${recordId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag: { name } }),
    });
  },

  async removeFromRecord(recordId: number, tagId: number): Promise<void> {
    // 204 No Contentのためfetchを直接使用
    await fetch(`${API_BASE}/records/${recordId}/tags/${tagId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  },

  async deleteTag(tagId: number): Promise<void> {
    // 204 No Contentのためfetchを直接使用
    await fetch(`${API_BASE}/tags/${tagId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  },
};
```

- [ ] **Step 3: useTags hook作成**

`frontend/src/hooks/useTags.ts` — 全タグ一覧取得 + 記録へのタグ付与/除去ロジック。オートコンプリート用に全タグをフェッチ。

- [ ] **Step 4: TagSectionテスト作成**

`frontend/src/components/TagSection.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TagSection } from './TagSection';

describe('TagSection', () => {
  it('付与済みタグをバッジで表示する', () => {
    render(
      <TagSection
        tags={[{ id: 1, name: '泣ける', user_id: 1, created_at: '' }]}
        allTags={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('泣ける')).toBeInTheDocument();
  });

  it('タグ追加入力欄がある', () => {
    render(<TagSection tags={[]} allTags={[]} onAdd={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByPlaceholderText('タグを追加...')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: TagSection実装**

`frontend/src/components/TagSection.tsx` — タグチップ表示 + 入力フィールド + オートコンプリートドロップダウン + 追加ボタン。CSS Modulesで `TagSection.module.css` 作成。

- [ ] **Step 6: テスト実行**

```bash
cd frontend && npx vitest run src/lib/tagsApi.test.ts src/components/TagSection/TagSection.test.tsx
```

- [ ] **Step 7: WorkDetailPageにTagSection統合**

`frontend/src/pages/WorkDetailPage.tsx` の日付セクション下にTagSectionを追加。

- [ ] **Step 8: コミット**

```bash
git add frontend/src/lib/tagsApi.ts frontend/src/lib/tagsApi.test.ts frontend/src/hooks/useTags.ts frontend/src/components/TagSection/ frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx
git commit -m "feat: タグ機能のフロントエンドを追加"
```

---

### Task 16: LibraryPage — タグフィルタ + タグバッジ

**Files:**
- Modify: `frontend/src/pages/LibraryPage/LibraryPage.tsx`
- Modify: `frontend/src/pages/LibraryPage/useLibrary.ts`
- Modify: `frontend/src/lib/recordsApi.ts`

- [ ] **Step 1: recordsApi更新 — tagフィルタパラメータ追加**

`frontend/src/lib/recordsApi.ts` の `getAll` メソッドで `tag[]` パラメータをURLSearchParamsに追加:

```typescript
if (filters?.tags) {
  filters.tags.forEach(tag => params.append('tag[]', tag));
}
```

`RecordFilterParams` に `tags?: string[]` を追加。

- [ ] **Step 2: useLibrary hook更新**

`frontend/src/pages/LibraryPage/useLibrary.ts` にタグフィルタのstate追加。URLクエリパラメータ `tag[]` の同期。

- [ ] **Step 3: LibraryPage更新**

`frontend/src/pages/LibraryPage/LibraryPage.tsx`:
- ジャンルフィルタの下にタグフィルタチップ行を追加
- 記録カードのタイトル下にタグバッジを小さく表示
- 全タグ取得用にuseTagsを使用

- [ ] **Step 4: テスト実行**

```bash
cd frontend && npx vitest run src/pages/LibraryPage/LibraryPage.test.tsx src/lib/recordsApi.test.ts
```

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/LibraryPage/LibraryPage.tsx frontend/src/pages/LibraryPage/useLibrary.ts frontend/src/lib/recordsApi.ts frontend/src/lib/recordsApi.test.ts
git commit -m "feat: ライブラリページにタグフィルタとタグバッジを追加"
```

---

## 機能3: ダッシュボード統計サマリー

### Task 17: Statistics API

**Files:**
- Create: `backend/app/controllers/api/v1/statistics_controller.rb`
- Create: `backend/spec/requests/api/v1/statistics_spec.rb`
- Modify: `backend/config/routes.rb`

- [ ] **Step 1: ルーティング追加**

`backend/config/routes.rb` に追加:

```ruby
resource :statistics, only: [:show], controller: 'statistics'
```

`resource`（単数リソース）を使用（`/api/v1/statistics` で直接アクセス）。

- [ ] **Step 2: request spec作成（失敗するテスト）**

`backend/spec/requests/api/v1/statistics_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe 'Api::V1::Statistics', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe 'GET /api/v1/statistics' do
    before { sign_in user }

    it '統計情報を返す' do
      anime_work = Work.create!(title: 'アニメ', media_type: :anime, total_episodes: 12)
      movie_work = Work.create!(title: '映画', media_type: :movie)
      Record.create!(user: user, work: anime_work, status: :completed, current_episode: 12, completed_at: Date.current)
      Record.create!(user: user, work: movie_work, status: :watching)

      get '/api/v1/statistics'

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)

      expect(json['by_genre']['anime']).to eq(1)
      expect(json['by_genre']['movie']).to eq(1)
      expect(json['by_status']['completed']).to eq(1)
      expect(json['by_status']['watching']).to eq(1)
      expect(json['totals']['episodes_watched']).to eq(12)
      expect(json['monthly_completions']).to be_an(Array)
    end

    it '他ユーザーのデータは含まれない' do
      other = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
      work = Work.create!(title: 'テスト', media_type: :anime)
      Record.create!(user: other, work: work, status: :completed)

      get '/api/v1/statistics'

      json = JSON.parse(response.body)
      expect(json['by_genre'].values.sum).to eq(0)
    end

    context '未認証' do
      it '401を返す' do
        get '/api/v1/statistics'
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
```

- [ ] **Step 3: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/statistics_spec.rb
```

- [ ] **Step 4: コントローラー実装**

`backend/app/controllers/api/v1/statistics_controller.rb`:

```ruby
module Api
  module V1
    class StatisticsController < ApplicationController
      before_action :authenticate_user!

      def show
        records = current_user.records.includes(:work)

        render json: {
          by_genre: count_by_genre(records),
          by_status: count_by_status(records),
          monthly_completions: monthly_completions(records),
          totals: totals(records)
        }
      end

      private

      def count_by_genre(records)
        # group(:media_type)の結果はenum文字列キー（Rails enumのデフォルト動作）
        counts = records.joins(:work).group('works.media_type').count
        Work.media_types.keys.index_with { |genre| counts[Work.media_types[genre]] || 0 }
      end

      def count_by_status(records)
        # group(:status)の結果は整数キーで返る（DB直接クエリのため）
        counts = records.group(:status).count
        Record.statuses.keys.index_with { |status| counts[Record.statuses[status]] || 0 }
      end

      def monthly_completions(records)
        start_date = 11.months.ago.beginning_of_month.to_date
        completed = records.where(status: :completed)
                           .where('completed_at >= ?', start_date)
                           .group("to_char(completed_at, 'YYYY-MM')")
                           .count

        (0..11).map do |i|
          month = i.months.ago.strftime('%Y-%m')
          { month: month, count: completed[month] || 0 }
        end.reverse
      end

      def totals(records)
        episode_types = Work.media_types.values_at('anime', 'drama')
        volume_types = Work.media_types.values_at('manga', 'book')

        episodes = records.joins(:work).where(works: { media_type: episode_types }).sum(:current_episode)
        volumes = records.joins(:work).where(works: { media_type: volume_types }).sum(:current_episode)

        { episodes_watched: episodes, volumes_read: volumes }
      end
    end
  end
end
```

- [ ] **Step 5: テスト実行（成功確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/statistics_spec.rb
```

- [ ] **Step 6: コミット**

```bash
git add backend/app/controllers/api/v1/statistics_controller.rb backend/spec/requests/api/v1/statistics_spec.rb backend/config/routes.rb
git commit -m "feat: 統計API（GET /api/v1/statistics）を追加"
```

---

### Task 18: フロントエンド — StatsSummaryコンポーネント + DashboardPage統合

**Files:**
- Create: `frontend/src/lib/statisticsApi.ts`
- Create: `frontend/src/lib/statisticsApi.test.ts`
- Create: `frontend/src/hooks/useStatistics.ts`
- Create: `frontend/src/components/StatsSummary/StatsSummary.tsx`
- Create: `frontend/src/components/StatsSummary/StatsSummary.test.tsx`
- Create: `frontend/src/components/StatsSummary/StatsSummary.module.css`
- Modify: `frontend/src/pages/DashboardPage/DashboardPage.tsx`

- [ ] **Step 1: statisticsApiテスト作成**

`frontend/src/lib/statisticsApi.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { statisticsApi } from './statisticsApi';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => mockFetch.mockReset());

describe('statisticsApi', () => {
  it('統計データを取得する', async () => {
    const mockData = {
      by_genre: { anime: 10, movie: 5, drama: 0, book: 3, manga: 7, game: 2 },
      by_status: { watching: 5, completed: 15, on_hold: 1, dropped: 2, plan_to_watch: 4 },
      monthly_completions: [{ month: '2026-03', count: 3 }],
      totals: { episodes_watched: 120, volumes_read: 45 },
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });

    const result = await statisticsApi.get();
    expect(result.by_genre.anime).toBe(10);
    expect(result.totals.episodes_watched).toBe(120);
  });
});
```

- [ ] **Step 2: statisticsApi実装**

`frontend/src/lib/statisticsApi.ts`:

```typescript
import { request } from './api';
import type { Statistics } from './types';

export const statisticsApi = {
  async get(): Promise<Statistics> {
    return request<Statistics>('/statistics');
  },
};
```

- [ ] **Step 3: useStatistics hook作成**

`frontend/src/hooks/useStatistics.ts`:

```typescript
import { useState, useEffect } from 'react';
import { statisticsApi } from '../lib/statisticsApi';
import type { Statistics } from '../lib/types';

export function useStatistics() {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const data = await statisticsApi.get();
        if (!cancelled) setStatistics(data);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void fetchStats();
    return () => { cancelled = true; };
  }, []);

  return { statistics, isLoading };
}
```

- [ ] **Step 4: StatsSummaryテスト作成**

`frontend/src/components/StatsSummary.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatsSummary } from './StatsSummary';
import type { Statistics } from '../lib/types';

const mockStats: Statistics = {
  by_genre: { anime: 10, movie: 5, drama: 0, book: 3, manga: 7, game: 2 },
  by_status: { watching: 5, completed: 15, on_hold: 1, dropped: 2, plan_to_watch: 4 },
  monthly_completions: [{ month: '2026-03', count: 3 }],
  totals: { episodes_watched: 120, volumes_read: 45 },
};

describe('StatsSummary', () => {
  it('総記録数を表示する', () => {
    render(<StatsSummary statistics={mockStats} />);
    expect(screen.getByText('27')).toBeInTheDocument(); // 10+5+0+3+7+2
  });

  it('総視聴話数を表示する', () => {
    render(<StatsSummary statistics={mockStats} />);
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('ジャンル別の数値を表示する', () => {
    render(<StatsSummary statistics={mockStats} />);
    expect(screen.getByText('アニメ')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: StatsSummary実装**

`frontend/src/components/StatsSummary.tsx` — 数値カード4枚 + ジャンル別・ステータス別の横棒グラフ + 月別完了数の縦棒チャート。CSS Modulesで `StatsSummary.module.css` 作成。モバイルレスポンシブ対応含む。

- [ ] **Step 6: DashboardPage統合**

`frontend/src/pages/DashboardPage/DashboardPage.tsx` の進行中リストの上にStatsSummaryを追加:

```tsx
const { statistics, isLoading: statsLoading } = useStatistics();

return (
  <div>
    {!statsLoading && statistics && <StatsSummary statistics={statistics} />}
    {/* 既存の進行中リスト */}
  </div>
);
```

- [ ] **Step 7: テスト実行**

```bash
cd frontend && npx vitest run src/lib/statisticsApi.test.ts src/components/StatsSummary/StatsSummary.test.tsx
```

- [ ] **Step 8: コミット**

```bash
git add frontend/src/lib/statisticsApi.ts frontend/src/lib/statisticsApi.test.ts frontend/src/hooks/useStatistics.ts frontend/src/components/StatsSummary/ frontend/src/pages/DashboardPage/DashboardPage.tsx
git commit -m "feat: ダッシュボードに統計サマリーを追加"
```

---

## 最終確認

### Task 19: 全テスト実行 + RuboCop + ESLint

- [ ] **Step 1: バックエンド全テスト**

```bash
docker compose exec backend bundle exec rspec
```

Expected: 全テストPASS

- [ ] **Step 2: RuboCop**

```bash
docker compose exec backend bundle exec rubocop
```

Expected: 違反なし

- [ ] **Step 3: フロントエンド全テスト**

```bash
cd frontend && npx vitest run
```

Expected: 全テストPASS

- [ ] **Step 4: ESLint + Prettier**

```bash
cd frontend && npx eslint src/ && npx prettier --check src/
```

Expected: 違反なし

- [ ] **Step 5: 動作確認**

ユーザーに手動またはPlaywright MCPでの動作確認を提案:
1. 作品詳細ページで全体感想を保存・表示
2. 話数感想の作成・編集・削除
3. タグの付与・除去・オートコンプリート
4. ライブラリページでタグフィルタ
5. 再視聴回数の増減
6. ダッシュボードの統計サマリー表示

- [ ] **Step 6: 最終コミット（必要に応じて）**

lint修正等があればここでコミット。
