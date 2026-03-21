# 記録の詳細機能 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 記録のCRUD API完成（GET/PATCH/DELETE追加）、ステータス自動処理、10点満点評価、作品詳細ページ、検索ページの記録モーダルを実装する。

**Architecture:** RESTful CRUD API（Records）をRailsの規約に沿って拡張。自動処理ロジックはRecordモデルのコールバックに集約し、コントローラーはthinに保つ。フロントエンドは共通UIコンポーネント（RatingInput, StatusSelector, ProgressControl等）を先に作り、WorkDetailPageとRecordModalで組み合わせる。

**Tech Stack:** Ruby on Rails 8（APIモード）/ RSpec / React 19 / TypeScript / Vitest + React Testing Library / CSS Modules

**Spec:** `docs/superpowers/specs/2026-03-21-record-details-design.md`

---

## ファイル構成

### バックエンド（変更）

| ファイル | 責務 |
|---------|------|
| `backend/app/models/record.rb` | バリデーション（rating 1〜10）、自動処理コールバック |
| `backend/app/controllers/api/v1/records_controller.rb` | index/show/update/destroy アクション追加、create のパラメータ拡張 |
| `backend/config/routes.rb` | records ルーティング拡張 |
| `backend/spec/models/record_spec.rb` | 自動処理・バリデーションテスト |
| `backend/spec/requests/api/v1/records_spec.rb` | 新規エンドポイントのテスト |

### フロントエンド（新規）

| ファイル | 責務 |
|---------|------|
| `frontend/src/components/ui/RatingInput/RatingInput.tsx` | 10点満点の評価入力 |
| `frontend/src/components/ui/RatingInput/RatingInput.test.tsx` | テスト |
| `frontend/src/components/ui/RatingInput/RatingInput.module.css` | スタイル |
| `frontend/src/components/ui/StatusSelector/StatusSelector.tsx` | ステータス選択（ピル型ボタン群） |
| `frontend/src/components/ui/StatusSelector/StatusSelector.test.tsx` | テスト |
| `frontend/src/components/ui/StatusSelector/StatusSelector.module.css` | スタイル |
| `frontend/src/components/ui/ProgressControl/ProgressControl.tsx` | 進捗操作（+1/-1/直接入力/プログレスバー） |
| `frontend/src/components/ui/ProgressControl/ProgressControl.test.tsx` | テスト |
| `frontend/src/components/ui/ProgressControl/ProgressControl.module.css` | スタイル |
| `frontend/src/components/RecordModal/RecordModal.tsx` | 検索ページの記録モーダル |
| `frontend/src/components/RecordModal/RecordModal.test.tsx` | テスト |
| `frontend/src/components/RecordModal/RecordModal.module.css` | スタイル |
| `frontend/src/components/RecordDeleteDialog/RecordDeleteDialog.tsx` | 削除確認ダイアログ |
| `frontend/src/components/RecordDeleteDialog/RecordDeleteDialog.test.tsx` | テスト |
| `frontend/src/components/RecordDeleteDialog/RecordDeleteDialog.module.css` | スタイル |
| `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx` | 作品詳細ページ（サイドバー型レイアウト） |
| `frontend/src/pages/WorkDetailPage/WorkDetailPage.test.tsx` | テスト |
| `frontend/src/pages/WorkDetailPage/WorkDetailPage.module.css` | スタイル |

### フロントエンド（変更）

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/lib/types.ts` | RecordsListResponse 型追加、rating コメント修正 |
| `frontend/src/lib/recordsApi.ts` | getAll/getOne/update/delete メソッド追加、create のパラメータ拡張 |
| `frontend/src/lib/recordsApi.test.ts` | 新規メソッドのテスト |
| `frontend/src/pages/SearchPage/SearchPage.tsx` | RecordModal 統合 |
| `frontend/src/components/WorkCard/WorkCard.tsx` | onRecord のシグネチャ変更 |
| `frontend/src/App.tsx` | `/works/:id` ルート追加 |

---

## Task 1: Recordモデルの自動処理コールバックとバリデーション拡張

**Files:**
- Modify: `backend/app/models/record.rb`
- Modify: `backend/spec/models/record_spec.rb`

### テスト

- [ ] **Step 1: rating バリデーションの範囲変更テストを書く**

`backend/spec/models/record_spec.rb` の既存テスト `rating は 1〜5 の範囲` を 1〜10 に変更し、境界値テストを追加する。

```ruby
# 既存テストを変更
it 'rating は 1〜10 の範囲' do
  record = described_class.new(user: user, work: work, rating: 11)
  expect(record).not_to be_valid
end

it 'rating が 10 で有効' do
  record = described_class.new(user: user, work: work, rating: 10)
  expect(record).to be_valid
end

it 'rating が 0 で無効' do
  record = described_class.new(user: user, work: work, rating: 0)
  expect(record).not_to be_valid
end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/record_spec.rb`
Expected: rating 10 のテストが FAIL（現在のバリデーションは 1〜5）

- [ ] **Step 3: rating バリデーションを 1〜10 に変更**

`backend/app/models/record.rb`:

```ruby
validates :rating, inclusion: { in: 1..10 }, allow_nil: true
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/record_spec.rb`
Expected: ALL PASS

- [ ] **Step 5: 自動処理コールバックのテストを書く**

`backend/spec/models/record_spec.rb` に以下を追加:

```ruby
describe '自動処理コールバック' do
  let(:work_with_episodes) { Work.create!(title: '進撃の巨人', media_type: 'anime', total_episodes: 75) }

  describe 'status → watching' do
    it 'started_at が未設定なら今日をセット' do
      record = described_class.create!(user: user, work: work_with_episodes, status: :watching)
      expect(record.started_at).to eq(Date.current)
    end

    it 'started_at が設定済みなら変更しない' do
      past_date = Date.new(2026, 1, 1)
      record = described_class.create!(user: user, work: work_with_episodes, status: :watching, started_at: past_date)
      expect(record.started_at).to eq(past_date)
    end
  end

  describe 'status → completed' do
    it 'completed_at を今日にセット' do
      record = described_class.create!(user: user, work: work_with_episodes, status: :completed)
      expect(record.completed_at).to eq(Date.current)
    end

    it 'current_episode を total_episodes に揃える' do
      record = described_class.create!(user: user, work: work_with_episodes, status: :completed)
      expect(record.current_episode).to eq(75)
    end

    it 'total_episodes が nil の作品では current_episode を変更しない' do
      work_no_episodes = Work.create!(title: '映画A', media_type: 'movie')
      record = described_class.create!(user: user, work: work_no_episodes, status: :completed, current_episode: 0)
      expect(record.current_episode).to eq(0)
    end

    it '新規記録を completed で作成すると started_at も今日にセット' do
      record = described_class.create!(user: user, work: work_with_episodes, status: :completed)
      expect(record.started_at).to eq(Date.current)
      expect(record.completed_at).to eq(Date.current)
    end
  end

  describe 'status → plan_to_watch' do
    it 'started_at, completed_at をクリアし current_episode を 0 に、rating を nil にリセット' do
      record = described_class.create!(user: user, work: work_with_episodes,
                                       status: :watching, rating: 8, current_episode: 30)
      record.update!(status: :plan_to_watch)
      expect(record.started_at).to be_nil
      expect(record.completed_at).to be_nil
      expect(record.current_episode).to eq(0)
      expect(record.rating).to be_nil
    end
  end

  describe 'current_episode が total_episodes に到達' do
    it 'status を completed に自動変更' do
      record = described_class.create!(user: user, work: work_with_episodes,
                                       status: :watching, current_episode: 74)
      record.update!(current_episode: 75)
      expect(record.status).to eq('completed')
      expect(record.completed_at).to eq(Date.current)
    end
  end

  describe 'started_at と completed_at の整合性' do
    it 'started_at が completed_at より後なら無効' do
      record = described_class.new(user: user, work: work,
                                   started_at: Date.new(2026, 3, 20),
                                   completed_at: Date.new(2026, 3, 10))
      expect(record).not_to be_valid
    end
  end
end
```

- [ ] **Step 6: テストが失敗することを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/record_spec.rb`
Expected: 自動処理テストが FAIL（コールバック未実装）

- [ ] **Step 7: 自動処理コールバックを実装**

`backend/app/models/record.rb`:

```ruby
# frozen_string_literal: true

class Record < ApplicationRecord
  belongs_to :user
  belongs_to :work

  enum :status, {
    watching: 0,
    completed: 1,
    on_hold: 2,
    dropped: 3,
    plan_to_watch: 4
  }

  validates :work_id, uniqueness: { scope: :user_id }
  validates :rating, inclusion: { in: 1..10 }, allow_nil: true
  validates :current_episode, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validate :started_at_before_completed_at
  validate :current_episode_within_total

  before_save :apply_status_automations
  before_save :auto_complete_on_episode_reach

  private

  def apply_status_automations
    return unless status_changed?

    case status
    when 'watching'
      self.started_at ||= Date.current
    when 'completed'
      self.completed_at ||= Date.current
      self.started_at ||= Date.current
      if work.total_episodes.present?
        self.current_episode = work.total_episodes
      end
    when 'plan_to_watch'
      self.started_at = nil
      self.completed_at = nil
      self.current_episode = 0
      self.rating = nil
    end
  end

  def auto_complete_on_episode_reach
    return unless current_episode_changed?
    return if status == 'completed'
    return unless work.total_episodes.present?
    return unless current_episode >= work.total_episodes

    self.status = 'completed'
    self.completed_at ||= Date.current
    self.started_at ||= Date.current
  end

  def started_at_before_completed_at
    return unless started_at.present? && completed_at.present?
    return unless started_at > completed_at

    errors.add(:started_at, 'は完了日より前である必要があります')
  end

  def current_episode_within_total
    return unless current_episode.present? && work&.total_episodes.present?
    return unless current_episode > work.total_episodes

    errors.add(:current_episode, "は総話数（#{work.total_episodes}）以下である必要があります")
  end
end
```

- [ ] **Step 8: 全テストがパスすることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/record_spec.rb`
Expected: ALL PASS

- [ ] **Step 9: RuboCopチェック**

Run: `docker compose run --rm backend bundle exec rubocop app/models/record.rb`
Expected: no offenses

- [ ] **Step 10: コミット**

```bash
git add backend/app/models/record.rb backend/spec/models/record_spec.rb
git commit -m "feat: Recordモデルに自動処理コールバックとバリデーション拡張を追加"
```

---

## Task 2: Records API の CRUD 拡張（index/show/update/destroy）

**Files:**
- Modify: `backend/app/controllers/api/v1/records_controller.rb`
- Modify: `backend/config/routes.rb`
- Modify: `backend/spec/requests/api/v1/records_spec.rb`

### ルーティング

- [ ] **Step 1: ルーティングを拡張**

`backend/config/routes.rb` の `resources :records, only: [:create]` を変更:

```ruby
resources :records, only: %i[index show create update destroy]
```

- [ ] **Step 2: create アクションのパラメータ拡張テストを書く**

`backend/spec/requests/api/v1/records_spec.rb` に追加:

```ruby
it 'ステータスと評価を指定して記録を作成' do
  post '/api/v1/records', params: {
    record: { work_id: existing_work.id, status: 'watching', rating: 7 }
  }, as: :json
  expect(response).to have_http_status(:created)
  json = response.parsed_body
  expect(json['record']['status']).to eq('watching')
  expect(json['record']['rating']).to eq(7)
end
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/records_spec.rb`
Expected: ステータス指定テストが FAIL（create が status/rating パラメータを受け取らない）

- [ ] **Step 4: index/show/update/destroy のテストを書く**

`backend/spec/requests/api/v1/records_spec.rb` に以下を追加:

```ruby
describe 'GET /api/v1/records' do
  context '認証済み' do
    before { sign_in user }

    it '自分の記録一覧を返す' do
      Record.create!(user: user, work: existing_work, status: :watching)
      other_user = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
      other_work = Work.create!(title: '他の作品', media_type: 'movie')
      Record.create!(user: other_user, work: other_work)

      get '/api/v1/records', as: :json
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['records'].length).to eq(1)
      expect(json['records'][0]['work']['title']).to eq('既存作品')
    end

    it 'status でフィルタできる' do
      Record.create!(user: user, work: existing_work, status: :watching)
      another_work = Work.create!(title: '別作品', media_type: 'movie')
      Record.create!(user: user, work: another_work, status: :completed)

      get '/api/v1/records', params: { status: 'watching' }, as: :json
      json = response.parsed_body
      expect(json['records'].length).to eq(1)
      expect(json['records'][0]['status']).to eq('watching')
    end

    it 'media_type でフィルタできる' do
      Record.create!(user: user, work: existing_work, status: :watching)
      movie_work = Work.create!(title: '映画作品', media_type: 'movie')
      Record.create!(user: user, work: movie_work, status: :watching)

      get '/api/v1/records', params: { media_type: 'anime' }, as: :json
      json = response.parsed_body
      expect(json['records'].length).to eq(1)
    end

    it 'work_id でフィルタできる' do
      Record.create!(user: user, work: existing_work, status: :watching)
      another_work = Work.create!(title: '別作品', media_type: 'movie')
      Record.create!(user: user, work: another_work)

      get '/api/v1/records', params: { work_id: existing_work.id }, as: :json
      json = response.parsed_body
      expect(json['records'].length).to eq(1)
    end
  end

  context '未認証' do
    it '401を返す' do
      get '/api/v1/records', as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end
end

describe 'GET /api/v1/records/:id' do
  context '認証済み' do
    before { sign_in user }

    it '自分の記録を返す' do
      record = Record.create!(user: user, work: existing_work, status: :watching, rating: 7)
      get "/api/v1/records/#{record.id}", as: :json
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['record']['rating']).to eq(7)
      expect(json['record']['work']['title']).to eq('既存作品')
    end

    it '他ユーザーの記録には403を返す' do
      other_user = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
      record = Record.create!(user: other_user, work: existing_work)
      get "/api/v1/records/#{record.id}", as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end
end

describe 'PATCH /api/v1/records/:id' do
  context '認証済み' do
    before { sign_in user }

    it 'ステータスを更新できる' do
      record = Record.create!(user: user, work: existing_work)
      patch "/api/v1/records/#{record.id}", params: { record: { status: 'watching' } }, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['record']['status']).to eq('watching')
    end

    it '評価を更新できる' do
      record = Record.create!(user: user, work: existing_work, status: :watching)
      patch "/api/v1/records/#{record.id}", params: { record: { rating: 8 } }, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['record']['rating']).to eq(8)
    end

    it '進捗を更新できる' do
      work_with_ep = Work.create!(title: 'アニメA', media_type: 'anime', total_episodes: 24)
      record = Record.create!(user: user, work: work_with_ep, status: :watching, current_episode: 5)
      patch "/api/v1/records/#{record.id}", params: { record: { current_episode: 6 } }, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['record']['current_episode']).to eq(6)
    end

    it '他ユーザーの記録は更新できない' do
      other_user = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
      record = Record.create!(user: other_user, work: existing_work)
      patch "/api/v1/records/#{record.id}", params: { record: { status: 'watching' } }, as: :json
      expect(response).to have_http_status(:forbidden)
    end

    it '無効なrating で422を返す' do
      record = Record.create!(user: user, work: existing_work)
      patch "/api/v1/records/#{record.id}", params: { record: { rating: 15 } }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end
  end
end

describe 'DELETE /api/v1/records/:id' do
  context '認証済み' do
    before { sign_in user }

    it '記録を削除して204を返す' do
      record = Record.create!(user: user, work: existing_work)
      expect do
        delete "/api/v1/records/#{record.id}", as: :json
      end.to change(Record, :count).by(-1)
      expect(response).to have_http_status(:no_content)
    end

    it '他ユーザーの記録は削除できない' do
      other_user = User.create!(username: 'other', email: 'other@example.com', password: 'password123')
      record = Record.create!(user: other_user, work: existing_work)
      delete "/api/v1/records/#{record.id}", as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end
end
```

- [ ] **Step 5: テストが失敗することを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/records_spec.rb`
Expected: 新規テストが FAIL（アクション未実装）

- [ ] **Step 6: コントローラーを実装**

`backend/app/controllers/api/v1/records_controller.rb`:

```ruby
# frozen_string_literal: true

module Api
  module V1
    class RecordsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_record, only: %i[show update destroy]
      before_action :authorize_record!, only: %i[show update destroy]

      # GET /api/v1/records
      def index
        records = current_user.records.includes(:work)
        records = records.where(status: params[:status]) if params[:status].present?
        records = records.joins(:work).where(works: { media_type: params[:media_type] }) if params[:media_type].present?
        records = records.where(work_id: params[:work_id]) if params[:work_id].present?
        records = apply_sort(records)

        render json: { records: records.as_json(include: :work) }
      end

      # GET /api/v1/records/:id
      def show
        render json: { record: @record.as_json(include: :work) }
      end

      # POST /api/v1/records
      def create
        work = find_or_create_work
        return render json: { error: 'work_id または work_data が必要です' }, status: :unprocessable_content unless work

        record = current_user.records.new(work: work, **record_create_params)

        if record.save
          render json: { record: record.as_json(include: :work) }, status: :created
        else
          render json: { errors: record.errors.full_messages }, status: :unprocessable_content
        end
      end

      # PATCH /api/v1/records/:id
      def update
        if @record.update(record_update_params)
          render json: { record: @record.as_json(include: :work) }
        else
          render json: { errors: @record.errors.full_messages }, status: :unprocessable_content
        end
      end

      # DELETE /api/v1/records/:id
      def destroy
        @record.destroy!
        head :no_content
      end

      private

      def set_record
        @record = Record.find(params[:id])
      end

      def authorize_record!
        return if @record.user_id == current_user.id

        render json: { error: '権限がありません' }, status: :forbidden
      end

      def record_create_params
        params.fetch(:record, {}).permit(:status, :rating)
      end

      def record_update_params
        params.require(:record).permit(:status, :rating, :current_episode, :started_at, :completed_at)
      end

      def apply_sort(records)
        case params[:sort]
        when 'rating'
          records.order(rating: :desc)
        when 'rating_asc'
          records.order(rating: :asc)
        when 'title'
          records.joins(:work).order('works.title DESC')
        when 'title_asc'
          records.joins(:work).order('works.title ASC')
        when 'updated_at_asc'
          records.order(updated_at: :asc)
        else
          records.order(updated_at: :desc)
        end
      end

      def find_or_create_work
        if params.dig(:record, :work_id).present?
          Work.find_by(id: params[:record][:work_id])
        elsif params.dig(:record, :work_data).present?
          find_or_create_from_external
        end
      end

      def find_or_create_from_external
        data = params.expect(record: {
                               work_data: %i[title media_type description
                                             cover_image_url total_episodes
                                             external_api_id external_api_source]
                             })[:work_data]

        if data[:external_api_id].present? && data[:external_api_source].present?
          Work.find_or_create_by!(
            external_api_id: data[:external_api_id],
            external_api_source: data[:external_api_source]
          ) do |work|
            work.assign_attributes(data.except(:external_api_id, :external_api_source))
          end
        else
          Work.create!(data)
        end
      rescue ActiveRecord::RecordNotUnique
        Work.find_by!(external_api_id: data[:external_api_id], external_api_source: data[:external_api_source])
      rescue ActiveRecord::RecordInvalid
        nil
      end
    end
  end
end
```

- [ ] **Step 7: 全テストがパスすることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/records_spec.rb`
Expected: ALL PASS

- [ ] **Step 8: RuboCopチェック**

Run: `docker compose run --rm backend bundle exec rubocop app/controllers/api/v1/records_controller.rb`
Expected: no offenses（200行超えの場合はファイル分割を検討）

- [ ] **Step 9: バックエンド全テスト実行**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec`
Expected: ALL PASS

- [ ] **Step 10: コミット**

```bash
git add backend/app/controllers/api/v1/records_controller.rb backend/config/routes.rb backend/spec/requests/api/v1/records_spec.rb
git commit -m "feat: Records APIにindex/show/update/destroyを追加"
```

---

## Task 3: フロントエンド API クライアントと型定義の拡張

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/recordsApi.ts`
- Modify: `frontend/src/lib/recordsApi.test.ts`

- [ ] **Step 1: 型定義を更新**

`frontend/src/lib/types.ts` に追加:

```typescript
// 記録一覧レスポンス
export interface RecordsListResponse {
  records: UserRecord[]
}
```

また、`UserRecord` の `rating` フィールドのコメントを「1〜10の評価」に更新（型自体は `number | null` のまま変更不要）。

- [ ] **Step 2: recordsApi のテストを書く**

`frontend/src/lib/recordsApi.test.ts` に追加:

```typescript
describe('getAll', () => {
  it('正常系: 記録一覧を取得', async () => {
    const data = { records: [{ id: 1, status: 'watching', work: { id: 1, title: 'テスト' } }] }
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
    const result = await recordsApi.getAll()
    expect(result.records).toHaveLength(1)
  })

  it('フィルタパラメータ付きで呼び出せる', async () => {
    const data = { records: [] }
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
    await recordsApi.getAll({ status: 'watching', mediaType: 'anime' })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('status=watching'),
      expect.any(Object),
    )
  })
})

describe('getOne', () => {
  it('正常系: 記録詳細を取得', async () => {
    const data = { record: { id: 1, status: 'watching', rating: 7 } }
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
    const result = await recordsApi.getOne(1)
    expect(result.record.rating).toBe(7)
  })
})

describe('update', () => {
  it('正常系: 記録を更新', async () => {
    const data = { record: { id: 1, status: 'completed', rating: 9 } }
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
    const result = await recordsApi.update(1, { status: 'completed', rating: 9 })
    expect(result.record.status).toBe('completed')
  })
})

describe('remove', () => {
  it('正常系: 記録を削除', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
    await recordsApi.remove(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/records/1'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

describe('createFromWorkId（拡張）', () => {
  it('ステータスと評価を指定して記録を作成', async () => {
    const data = { record: { id: 1, status: 'watching', rating: 7 } }
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
    const result = await recordsApi.createFromWorkId(10, { status: 'watching', rating: 7 })
    expect(result.record.status).toBe('watching')
  })
})
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `docker compose run --rm frontend npm test -- --run`
Expected: FAIL（新規メソッド未定義）

- [ ] **Step 4: recordsApi を実装**

`frontend/src/lib/recordsApi.ts`:

```typescript
import type { RecordResponse, RecordsListResponse, SearchResult, RecordStatus } from './types'
import { request } from './api'

type RecordCreateOptions = {
  status?: RecordStatus
  rating?: number
}

type RecordUpdateParams = {
  status?: RecordStatus
  rating?: number | null
  current_episode?: number
  started_at?: string | null
  completed_at?: string | null
}

type RecordFilterParams = {
  status?: RecordStatus
  mediaType?: string
  workId?: number
  sort?: string
}

export const recordsApi = {
  getAll(filters?: RecordFilterParams): Promise<RecordsListResponse> {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.mediaType) params.set('media_type', filters.mediaType)
    if (filters?.workId) params.set('work_id', String(filters.workId))
    if (filters?.sort) params.set('sort', filters.sort)
    const query = params.toString()
    return request<RecordsListResponse>(`/records${query ? `?${query}` : ''}`)
  },

  getOne(id: number): Promise<RecordResponse> {
    return request<RecordResponse>(`/records/${id}`)
  },

  createFromWorkId(workId: number, options?: RecordCreateOptions): Promise<RecordResponse> {
    return request<RecordResponse>('/records', {
      method: 'POST',
      body: JSON.stringify({ record: { work_id: workId, ...options } }),
    })
  },

  createFromSearchResult(
    workData: Pick<
      SearchResult,
      | 'title'
      | 'media_type'
      | 'description'
      | 'cover_image_url'
      | 'total_episodes'
      | 'external_api_id'
      | 'external_api_source'
    >,
    options?: RecordCreateOptions,
  ): Promise<RecordResponse> {
    return request<RecordResponse>('/records', {
      method: 'POST',
      body: JSON.stringify({ record: { work_data: workData, ...options } }),
    })
  },

  update(id: number, params: RecordUpdateParams): Promise<RecordResponse> {
    return request<RecordResponse>(`/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ record: params }),
    })
  },

  remove(id: number): Promise<void> {
    return request<void>(`/records/${id}`, { method: 'DELETE' })
  },
}
```

- [ ] **Step 5: テストがパスすることを確認**

Run: `docker compose run --rm frontend npm test -- --run`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/recordsApi.ts frontend/src/lib/recordsApi.test.ts
git commit -m "feat: recordsApiにgetAll/getOne/update/removeを追加"
```

---

## Task 4: UIコンポーネント — RatingInput

**Files:**
- Create: `frontend/src/components/ui/RatingInput/RatingInput.tsx`
- Create: `frontend/src/components/ui/RatingInput/RatingInput.test.tsx`
- Create: `frontend/src/components/ui/RatingInput/RatingInput.module.css`

- [ ] **Step 1: テストを書く**

`frontend/src/components/ui/RatingInput/RatingInput.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RatingInput } from './RatingInput'

describe('RatingInput', () => {
  it('1〜10のボタンが表示される', () => {
    render(<RatingInput value={null} onChange={() => {}} />)
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument()
    }
  })

  it('選択中の値がハイライトされる', () => {
    render(<RatingInput value={7} onChange={() => {}} />)
    const button = screen.getByRole('button', { name: '7' })
    expect(button.className).toContain('active')
  })

  it('ボタンクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<RatingInput value={null} onChange={handleChange} />)
    await user.click(screen.getByRole('button', { name: '8' }))
    expect(handleChange).toHaveBeenCalledWith(8)
  })

  it('同じ値をクリックすると null で onChange が呼ばれる（評価解除）', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<RatingInput value={7} onChange={handleChange} />)
    await user.click(screen.getByRole('button', { name: '7' }))
    expect(handleChange).toHaveBeenCalledWith(null)
  })

  it('値が設定されている場合「N / 10」のテキストが表示される', () => {
    render(<RatingInput value={7} onChange={() => {}} />)
    expect(screen.getByText('7 / 10')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm frontend npm test -- --run src/components/ui/RatingInput`
Expected: FAIL（コンポーネント未作成）

- [ ] **Step 3: コンポーネントを実装**

`frontend/src/components/ui/RatingInput/RatingInput.tsx`:

```typescript
import styles from './RatingInput.module.css'

type RatingInputProps = {
  value: number | null
  onChange: (rating: number | null) => void
}

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export function RatingInput({ value, onChange }: RatingInputProps) {
  const handleClick = (rating: number) => {
    onChange(rating === value ? null : rating)
  }

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        {RATINGS.map((rating) => (
          <button
            key={rating}
            type="button"
            className={`${styles.button} ${value !== null && rating <= value ? styles.active : ''}`}
            onClick={() => handleClick(rating)}
            aria-label={String(rating)}
          >
            {rating}
          </button>
        ))}
      </div>
      {value !== null && (
        <span className={styles.display}>{value} / 10</span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: CSSを作成**

`frontend/src/components/ui/RatingInput/RatingInput.module.css`:

```css
.container {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.buttons {
  display: flex;
  gap: var(--spacing-xs);
}

.button {
  width: 2rem;
  height: 2rem;
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: 4px;
  background: var(--color-bg-white);
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.button:hover {
  border-color: var(--color-border);
  color: var(--color-text);
}

.button.active {
  background: var(--color-text);
  color: var(--color-bg-white);
  border-color: var(--color-text);
}

.display {
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}
```

- [ ] **Step 5: テストがパスすることを確認**

Run: `docker compose run --rm frontend npm test -- --run src/components/ui/RatingInput`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ui/RatingInput/
git commit -m "feat: RatingInputコンポーネントを追加（10点満点評価）"
```

---

## Task 5: UIコンポーネント — StatusSelector

**Files:**
- Create: `frontend/src/components/ui/StatusSelector/StatusSelector.tsx`
- Create: `frontend/src/components/ui/StatusSelector/StatusSelector.test.tsx`
- Create: `frontend/src/components/ui/StatusSelector/StatusSelector.module.css`

- [ ] **Step 1: テストを書く**

`frontend/src/components/ui/StatusSelector/StatusSelector.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusSelector } from './StatusSelector'

describe('StatusSelector', () => {
  it('全ステータスが日本語ラベルで表示される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '視聴中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴完了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '中断' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '一時停止' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴予定' })).toBeInTheDocument()
  })

  it('現在の値がアクティブ表示される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} />)
    const button = screen.getByRole('button', { name: '視聴中' })
    expect(button.className).toContain('active')
  })

  it('ボタンクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<StatusSelector value="watching" onChange={handleChange} />)
    await user.click(screen.getByRole('button', { name: '視聴完了' }))
    expect(handleChange).toHaveBeenCalledWith('completed')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm frontend npm test -- --run src/components/ui/StatusSelector`
Expected: FAIL

- [ ] **Step 3: コンポーネントを実装**

`frontend/src/components/ui/StatusSelector/StatusSelector.tsx`:

```typescript
import type { RecordStatus } from '../../../lib/types'
import styles from './StatusSelector.module.css'

type StatusSelectorProps = {
  value: RecordStatus
  onChange: (status: RecordStatus) => void
}

const STATUS_OPTIONS: { value: RecordStatus; label: string }[] = [
  { value: 'watching', label: '視聴中' },
  { value: 'completed', label: '視聴完了' },
  { value: 'on_hold', label: '一時停止' },
  { value: 'dropped', label: '中断' },
  { value: 'plan_to_watch', label: '視聴予定' },
]

export function StatusSelector({ value, onChange }: StatusSelectorProps) {
  return (
    <div className={styles.container}>
      {STATUS_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${styles.pill} ${value === option.value ? styles.active : ''}`}
          onClick={() => onChange(option.value)}
          aria-label={option.label}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: CSSを作成**

`frontend/src/components/ui/StatusSelector/StatusSelector.module.css`:

```css
.container {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.pill {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  font-weight: var(--font-weight-medium);
  padding: var(--spacing-xs) var(--spacing-md);
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: 999px;
  background: var(--color-bg-white);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pill:hover {
  border-color: var(--color-border);
  color: var(--color-text);
}

.pill.active {
  background: var(--color-text);
  color: var(--color-bg-white);
  border-color: var(--color-text);
}
```

- [ ] **Step 5: テストがパスすることを確認**

Run: `docker compose run --rm frontend npm test -- --run src/components/ui/StatusSelector`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ui/StatusSelector/
git commit -m "feat: StatusSelectorコンポーネントを追加（ピル型ステータス選択）"
```

---

## Task 6: UIコンポーネント — ProgressControl

**Files:**
- Create: `frontend/src/components/ui/ProgressControl/ProgressControl.tsx`
- Create: `frontend/src/components/ui/ProgressControl/ProgressControl.test.tsx`
- Create: `frontend/src/components/ui/ProgressControl/ProgressControl.module.css`

- [ ] **Step 1: テストを書く**

`frontend/src/components/ui/ProgressControl/ProgressControl.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgressControl } from './ProgressControl'

describe('ProgressControl', () => {
  it('現在の話数と総話数が表示される', () => {
    render(<ProgressControl current={5} total={24} onChange={() => {}} />)
    expect(screen.getByText('5 / 24話')).toBeInTheDocument()
  })

  it('総話数が null の場合は現在の話数のみ表示', () => {
    render(<ProgressControl current={3} total={null} onChange={() => {}} />)
    expect(screen.getByText('3話')).toBeInTheDocument()
  })

  it('+1 ボタンで onChange が current + 1 で呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<ProgressControl current={5} total={24} onChange={handleChange} />)
    await user.click(screen.getByRole('button', { name: '+1' }))
    expect(handleChange).toHaveBeenCalledWith(6)
  })

  it('-1 ボタンで onChange が current - 1 で呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<ProgressControl current={5} total={24} onChange={handleChange} showFullControls />)
    await user.click(screen.getByRole('button', { name: '-1' }))
    expect(handleChange).toHaveBeenCalledWith(4)
  })

  it('current が 0 のとき -1 ボタンは無効', () => {
    render(<ProgressControl current={0} total={24} onChange={() => {}} showFullControls />)
    expect(screen.getByRole('button', { name: '-1' })).toBeDisabled()
  })

  it('current が total のとき +1 ボタンは無効', () => {
    render(<ProgressControl current={24} total={24} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '+1' })).toBeDisabled()
  })

  it('showFullControls=false のとき -1 ボタンと数字入力は非表示', () => {
    render(<ProgressControl current={5} total={24} onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: '-1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('showFullControls=true のとき数字入力が表示される', () => {
    render(<ProgressControl current={5} total={24} onChange={() => {}} showFullControls />)
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('プログレスバーが正しい割合で表示される', () => {
    const { container } = render(<ProgressControl current={12} total={24} onChange={() => {}} />)
    const bar = container.querySelector('[class*="fill"]')
    expect(bar).toHaveStyle({ width: '50%' })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm frontend npm test -- --run src/components/ui/ProgressControl`
Expected: FAIL

- [ ] **Step 3: コンポーネントを実装**

`frontend/src/components/ui/ProgressControl/ProgressControl.tsx`:

```typescript
import type { ChangeEvent } from 'react'
import styles from './ProgressControl.module.css'

type ProgressControlProps = {
  current: number
  total: number | null
  onChange: (episode: number) => void
  showFullControls?: boolean
}

export function ProgressControl({
  current,
  total,
  onChange,
  showFullControls = false,
}: ProgressControlProps) {
  const canIncrement = total === null || current < total
  const canDecrement = current > 0
  const percentage = total ? Math.round((current / total) * 100) : null

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 0 && (total === null || value <= total)) {
      onChange(value)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        {showFullControls && (
          <button
            type="button"
            className={styles.button}
            onClick={() => onChange(current - 1)}
            disabled={!canDecrement}
            aria-label="-1"
          >
            -
          </button>
        )}
        <span className={styles.display}>
          {total !== null ? `${current} / ${total}話` : `${current}話`}
        </span>
        <button
          type="button"
          className={`${styles.button} ${styles.increment}`}
          onClick={() => onChange(current + 1)}
          disabled={!canIncrement}
          aria-label="+1"
        >
          +
        </button>
        {showFullControls && (
          <input
            type="number"
            className={styles.input}
            value={current}
            onChange={handleInputChange}
            min={0}
            max={total ?? undefined}
            aria-label="話数入力"
          />
        )}
      </div>
      {total !== null && percentage !== null && (
        <div className={styles.bar}>
          <div className={styles.fill} style={{ width: `${percentage}%` }} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: CSSを作成**

`frontend/src/components/ui/ProgressControl/ProgressControl.module.css`:

```css
.container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.button {
  width: 2rem;
  height: 2rem;
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: 4px;
  background: var(--color-bg-white);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.button:hover:not(:disabled) {
  border-color: var(--color-border);
}

.button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.increment {
  background: var(--color-text);
  color: var(--color-bg-white);
  border-color: var(--color-text);
}

.display {
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  min-width: 5rem;
}

.input {
  width: 3.5rem;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: 4px;
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  text-align: center;
  color: var(--color-text);
  background: var(--color-bg-white);
}

.bar {
  height: 4px;
  background: var(--color-border-light);
  border-radius: 2px;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--color-text);
  border-radius: 2px;
  transition: width var(--transition-normal);
}
```

- [ ] **Step 5: テストがパスすることを確認**

Run: `docker compose run --rm frontend npm test -- --run src/components/ui/ProgressControl`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ui/ProgressControl/
git commit -m "feat: ProgressControlコンポーネントを追加（進捗管理）"
```

---

## Task 7: RecordModal（検索ページの記録モーダル）

**Files:**
- Create: `frontend/src/components/RecordModal/RecordModal.tsx`
- Create: `frontend/src/components/RecordModal/RecordModal.test.tsx`
- Create: `frontend/src/components/RecordModal/RecordModal.module.css`
- Modify: `frontend/src/pages/SearchPage/SearchPage.tsx`
- Modify: `frontend/src/components/WorkCard/WorkCard.tsx`

- [ ] **Step 1: RecordModal のテストを書く**

`frontend/src/components/RecordModal/RecordModal.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordModal } from './RecordModal'

describe('RecordModal', () => {
  const defaultProps = {
    isOpen: true,
    title: '進撃の巨人',
    mediaType: 'アニメ',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isLoading: false,
  }

  it('作品タイトルが表示される', () => {
    render(<RecordModal {...defaultProps} />)
    expect(screen.getByText('進撃の巨人を記録')).toBeInTheDocument()
  })

  it('ステータス選択が表示される', () => {
    render(<RecordModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: '視聴中' })).toBeInTheDocument()
  })

  it('評価入力が表示される', () => {
    render(<RecordModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
  })

  it('記録するボタンでonConfirmが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleConfirm = vi.fn()
    render(<RecordModal {...defaultProps} onConfirm={handleConfirm} />)
    await user.click(screen.getByRole('button', { name: '記録する' }))
    expect(handleConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'plan_to_watch', rating: null }),
    )
  })

  it('キャンセルボタンでonCancelが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleCancel = vi.fn()
    render(<RecordModal {...defaultProps} onCancel={handleCancel} />)
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(handleCancel).toHaveBeenCalled()
  })

  it('isOpen=false のとき何も表示しない', () => {
    const { container } = render(<RecordModal {...defaultProps} isOpen={false} />)
    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm frontend npm test -- --run src/components/RecordModal`
Expected: FAIL

- [ ] **Step 3: RecordModal を実装**

`frontend/src/components/RecordModal/RecordModal.tsx`:

```typescript
import { useState } from 'react'
import type { RecordStatus } from '../../lib/types'
import { StatusSelector } from '../ui/StatusSelector/StatusSelector'
import { RatingInput } from '../ui/RatingInput/RatingInput'
import { Button } from '../ui/Button/Button'
import styles from './RecordModal.module.css'

type RecordModalProps = {
  isOpen: boolean
  title: string
  mediaType: string
  onConfirm: (data: { status: RecordStatus; rating: number | null }) => void
  onCancel: () => void
  isLoading: boolean
}

export function RecordModal({
  isOpen,
  title,
  mediaType,
  onConfirm,
  onCancel,
  isLoading,
}: RecordModalProps) {
  const [status, setStatus] = useState<RecordStatus>('plan_to_watch')
  const [rating, setRating] = useState<number | null>(null)

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm({ status, rating })
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{title}を記録</h3>
        <p className={styles.meta}>{mediaType}</p>

        <div className={styles.section}>
          <label className={styles.label}>ステータス</label>
          <StatusSelector value={status} onChange={setStatus} />
        </div>

        <div className={styles.section}>
          <label className={styles.label}>評価（任意）</label>
          <RatingInput value={rating} onChange={setRating} />
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? '記録中...' : '記録する'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: CSSを作成**

`frontend/src/components/RecordModal/RecordModal.module.css`:

```css
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--color-bg-white);
  border-radius: 8px;
  padding: var(--spacing-xl);
  max-width: 400px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.title {
  font-family: var(--font-body);
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-xs) 0;
}

.meta {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-lg) 0;
}

.section {
  margin-bottom: var(--spacing-lg);
}

.label {
  display: block;
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-sm);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
```

- [ ] **Step 5: テストがパスすることを確認**

Run: `docker compose run --rm frontend npm test -- --run src/components/RecordModal`
Expected: ALL PASS

- [ ] **Step 6: SearchPage と WorkCard を RecordModal に統合**

`frontend/src/components/WorkCard/WorkCard.tsx` の `onRecord` prop を変更し、モーダルを開くトリガーにする。具体的には `SearchPage` 側で状態管理:

- SearchPage に `modalWork` state を追加（モーダルに表示する作品）
- WorkCard の「記録する」→ `setModalWork(work)`
- RecordModal の confirm → `recordsApi.createFromSearchResult(work, { status, rating })`

`SearchPage.tsx` の変更箇所:
- `import { RecordModal }` を追加
- `modalWork` state を追加
- `handleRecord` を `handleOpenModal` に変更（モーダルを開く）
- `handleConfirmRecord` を追加（モーダル確定時にAPI呼び出し）
- JSX に `<RecordModal>` を追加

- [ ] **Step 7: SearchPage のテストを更新**

SearchPage の既存テストで「記録する」ボタンの動作テストがあれば、モーダル経由のフローに更新。

- [ ] **Step 8: テストがパスすることを確認**

Run: `docker compose run --rm frontend npm test -- --run`
Expected: ALL PASS

- [ ] **Step 9: コミット**

```bash
git add frontend/src/components/RecordModal/ frontend/src/pages/SearchPage/ frontend/src/components/WorkCard/
git commit -m "feat: RecordModalを追加し、検索ページの記録フローをモーダル化"
```

---

## Task 8: RecordDeleteDialog

**Files:**
- Create: `frontend/src/components/RecordDeleteDialog/RecordDeleteDialog.tsx`
- Create: `frontend/src/components/RecordDeleteDialog/RecordDeleteDialog.test.tsx`
- Create: `frontend/src/components/RecordDeleteDialog/RecordDeleteDialog.module.css`

- [ ] **Step 1: テストを書く**

`frontend/src/components/RecordDeleteDialog/RecordDeleteDialog.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordDeleteDialog } from './RecordDeleteDialog'

describe('RecordDeleteDialog', () => {
  const defaultProps = {
    isOpen: true,
    workTitle: '進撃の巨人',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isLoading: false,
  }

  it('確認メッセージが表示される', () => {
    render(<RecordDeleteDialog {...defaultProps} />)
    expect(screen.getByText(/進撃の巨人/)).toBeInTheDocument()
    expect(screen.getByText(/記録を削除/)).toBeInTheDocument()
  })

  it('削除ボタンでonConfirmが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleConfirm = vi.fn()
    render(<RecordDeleteDialog {...defaultProps} onConfirm={handleConfirm} />)
    await user.click(screen.getByRole('button', { name: '削除する' }))
    expect(handleConfirm).toHaveBeenCalled()
  })

  it('キャンセルボタンでonCancelが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleCancel = vi.fn()
    render(<RecordDeleteDialog {...defaultProps} onCancel={handleCancel} />)
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(handleCancel).toHaveBeenCalled()
  })

  it('isOpen=false のとき何も表示しない', () => {
    const { container } = render(<RecordDeleteDialog {...defaultProps} isOpen={false} />)
    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

- [ ] **Step 3: コンポーネントを実装**

`frontend/src/components/RecordDeleteDialog/RecordDeleteDialog.tsx`:

```typescript
import { Button } from '../ui/Button/Button'
import styles from './RecordDeleteDialog.module.css'

type RecordDeleteDialogProps = {
  isOpen: boolean
  workTitle: string
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

export function RecordDeleteDialog({
  isOpen,
  workTitle,
  onConfirm,
  onCancel,
  isLoading,
}: RecordDeleteDialogProps) {
  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>記録を削除</h3>
        <p className={styles.message}>
          「{workTitle}」の記録を削除しますか？この操作は取り消せません。
        </p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? '削除中...' : '削除する'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: CSSを作成**（RecordModal と同様の overlay/dialog パターン）

- [ ] **Step 5: テストがパスすることを確認**

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/RecordDeleteDialog/
git commit -m "feat: RecordDeleteDialogコンポーネントを追加（削除確認）"
```

---

## Task 9: WorkDetailPage（作品詳細ページ）

**Files:**
- Create: `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`
- Create: `frontend/src/pages/WorkDetailPage/WorkDetailPage.test.tsx`
- Create: `frontend/src/pages/WorkDetailPage/WorkDetailPage.module.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: テストを書く**

`frontend/src/pages/WorkDetailPage/WorkDetailPage.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { WorkDetailPage } from './WorkDetailPage'

// recordsApi をモック
vi.mock('../../lib/recordsApi', () => ({
  recordsApi: {
    getAll: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

import { recordsApi } from '../../lib/recordsApi'

const mockRecord = {
  id: 1,
  status: 'watching',
  rating: 7,
  current_episode: 32,
  rewatch_count: 0,
  started_at: '2026-01-15',
  completed_at: null,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-03-20T15:30:00Z',
  work_id: 1,
  work: {
    id: 1,
    title: '進撃の巨人',
    media_type: 'anime',
    cover_image_url: null,
    total_episodes: 75,
    description: 'テストの説明文',
    external_api_id: null,
    external_api_source: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
}

const renderWithRouter = (workId: string) => {
  return render(
    <MemoryRouter initialEntries={[`/works/${workId}`]}>
      <Routes>
        <Route path="/works/:id" element={<WorkDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('WorkDetailPage', () => {
  beforeEach(() => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: [mockRecord] })
    vi.mocked(recordsApi.update).mockResolvedValue({ record: mockRecord })
  })

  it('作品タイトルが表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })
  })

  it('ステータスセレクターが表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '視聴中' })).toBeInTheDocument()
    })
  })

  it('評価が表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('7 / 10')).toBeInTheDocument()
    })
  })

  it('進捗が表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('32 / 75話')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

- [ ] **Step 3: WorkDetailPage を実装**

`frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`:

サイドバー型レイアウト。`useParams` で `:id`（work_id）を取得し、`recordsApi.getAll({ workId })` で記録を取得。ステータス・評価・進捗の変更時は `recordsApi.update()` を呼び出す。削除時は `RecordDeleteDialog` → `recordsApi.remove()` → `/search` にリダイレクト。

主要セクション:
- 左サイドバー: カバー画像、メタデータ（話数、放送年、ジャンル）
- 右メイン: タイトル、StatusSelector、RatingInput、ProgressControl（showFullControls=true）、日付表示、あらすじ、削除ボタン

- [ ] **Step 4: CSSを作成**（サイドバー型レイアウト、レスポンシブ対応）

- [ ] **Step 5: App.tsx にルート追加**

```typescript
import { WorkDetailPage } from './pages/WorkDetailPage/WorkDetailPage'

// Routes 内に追加:
<Route
  path="/works/:id"
  element={
    <ProtectedRoute>
      <WorkDetailPage />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 6: テストがパスすることを確認**

Run: `docker compose run --rm frontend npm test -- --run`
Expected: ALL PASS

- [ ] **Step 7: コミット**

```bash
git add frontend/src/pages/WorkDetailPage/ frontend/src/App.tsx
git commit -m "feat: WorkDetailPage（作品詳細ページ）を追加"
```

---

## Task 10: 全体統合テストとメインスペック更新

**Files:**
- Modify: `docs/superpowers/specs/2026-03-20-recolly-design.md`（rating を 1〜10 に修正）

- [ ] **Step 1: バックエンド全テスト実行**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec`
Expected: ALL PASS

- [ ] **Step 2: フロントエンド全テスト実行**

Run: `docker compose run --rm frontend npm test -- --run`
Expected: ALL PASS

- [ ] **Step 3: バックエンド lint**

Run: `docker compose run --rm backend bundle exec rubocop`
Expected: no offenses

- [ ] **Step 4: フロントエンド lint**

Run: `docker compose run --rm frontend npm run lint`
Expected: no errors

- [ ] **Step 5: メインスペックの rating を更新**

`docs/superpowers/specs/2026-03-20-recolly-design.md` の Records テーブル定義:
`rating | integer | 1〜5の★評価` → `rating | integer | 1〜10の評価`

- [ ] **Step 6: コミット**

```bash
git add docs/superpowers/specs/2026-03-20-recolly-design.md
git commit -m "docs: メイン仕様書のrating定義を1〜10に更新"
```
