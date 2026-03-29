# 漫画の進捗管理を話数→巻数に変更 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 漫画の進捗データをAniListの chapters（話数）から volumes（巻数）に変更し、連載中作品の自動完了を防止し、新刊通知UIを追加する。

**Architecture:** AniListアダプタのGraphQLクエリとnormalizeロジックを変更。Workモデルに `last_synced_at` カラムを追加し、metadata経由でAniListの作品ステータス（FINISHED/RELEASING）を保存。Recordの自動完了ロジックにステータスチェックを追加。フロントエンドではProgressControlに連載中バッジ、WatchingListItemに未読バッジ、WorkDetailPageに新刊アラートを追加。

**Tech Stack:** Ruby on Rails 8 / RSpec / React 19 / TypeScript / Vitest

**Issue:** #84

---

## ファイル構成

### バックエンド（変更）
| ファイル | 変更内容 |
|---------|---------|
| `backend/app/services/external_apis/anilist_adapter.rb` | GraphQLに `volumes` 追加、normalize変更 |
| `backend/app/models/record.rb` | 自動完了にFINISHEDチェック追加 |
| `backend/app/controllers/api/v1/records_controller.rb` | metadata受け渡し追加 |
| `backend/app/controllers/api/v1/works_controller.rb` | syncアクション追加 |
| `backend/config/routes.rb` | sync ルート追加 |

### バックエンド（新規）
| ファイル | 内容 |
|---------|------|
| `backend/db/migrate/XXXXXX_add_last_synced_at_to_works.rb` | last_synced_atカラム追加 |
| `backend/app/services/anilist_sync_service.rb` | AniList同期ロジック |
| `backend/lib/tasks/anilist_sync.rake` | 週次バッチタスク |

### フロントエンド（変更）
| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/lib/types.ts` | WorkMetadata型追加 |
| `frontend/src/lib/worksApi.ts` | syncメソッド追加 |
| `frontend/src/lib/recordsApi.ts` | createFromSearchResult にmetadata追加 |
| `frontend/src/lib/mediaTypeUtils.ts` | getUnreadCount関数追加 |
| `frontend/src/components/ui/ProgressControl/ProgressControl.tsx` | 連載中バッジ追加 |
| `frontend/src/components/ui/ProgressControl/ProgressControl.module.css` | バッジスタイル追加 |
| `frontend/src/components/WatchingListItem/WatchingListItem.tsx` | 未読バッジ追加 |
| `frontend/src/components/WatchingListItem/WatchingListItem.module.css` | バッジスタイル追加 |
| `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx` | 新刊アラート、sync呼び出し |
| `frontend/src/pages/WorkDetailPage/useWorkDetail.ts` | sync処理追加 |

---

### Task 1: AniListアダプタ — GraphQLクエリに volumes を追加し、漫画のマッピングを変更

**Files:**
- Modify: `backend/app/services/external_apis/anilist_adapter.rb`
- Test: `backend/spec/services/external_apis/anilist_adapter_spec.rb`

- [ ] **Step 1: テストデータに volumes フィールドを追加し、漫画の total_episodes が volumes を返すテストを書く**

`backend/spec/services/external_apis/anilist_adapter_spec.rb` の漫画テストデータに `'volumes' => 34` を追加し、テストを追加する。

```ruby
# anilist_adapter_spec.rb の anilist_response 内の漫画データに追加
{
  'id' => 53_390,
  'title' => { 'romaji' => 'Shingeki no Kyojin', 'native' => '進撃の巨人' },
  'description' => '巨人が支配する世界（漫画版）',
  'coverImage' => {
    'large' =>
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx53390.jpg'
  },
  'chapters' => 139,
  'volumes' => 34,
  'type' => 'MANGA',
  'format' => 'MANGA',
  'genres' => %w[Action Drama],
  'status' => 'FINISHED',
  'popularity' => 300_000
}
```

テスト追加:

```ruby
it '漫画の total_episodes に volumes（巻数）を使用する' do
  results = adapter.search('進撃の巨人')
  manga = results.find { |r| r.media_type == 'manga' }
  expect(manga.total_episodes).to eq(34)
end

it 'アニメの total_episodes は episodes のまま' do
  results = adapter.search('進撃の巨人')
  anime = results.find { |r| r.media_type == 'anime' }
  expect(anime.total_episodes).to eq(25)
end
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
docker compose exec backend bundle exec rspec spec/services/external_apis/anilist_adapter_spec.rb -e "volumes" --format documentation
```

期待: FAIL（漫画の total_episodes が 139 で 34 ではない）

- [ ] **Step 3: AniListアダプタを修正して漫画は volumes を使うようにする**

`backend/app/services/external_apis/anilist_adapter.rb` を修正:

GraphQLクエリに `volumes` を追加:

```graphql
episodes
chapters
volumes
type
```

normalize メソッドを修正:

```ruby
def normalize(item)
  media_type = determine_media_type(item)
  title = item.dig('title', 'native') ||
          item.dig('title', 'english') ||
          item.dig('title', 'romaji')

  SearchResult.new(
    title, media_type, item['description'],
    item.dig('coverImage', 'large'),
    total_episodes_for(item, media_type),
    item['id'].to_s, 'anilist', build_metadata(item)
  )
end

# 漫画は volumes（巻数）、それ以外は episodes を使用
def total_episodes_for(item, media_type)
  if media_type == 'manga'
    item['volumes']
  else
    item['episodes']
  end
end
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
docker compose exec backend bundle exec rspec spec/services/external_apis/anilist_adapter_spec.rb --format documentation
```

期待: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/external_apis/anilist_adapter.rb backend/spec/services/external_apis/anilist_adapter_spec.rb
git commit -m "feat: 漫画の total_episodes に volumes（巻数）を使用するよう変更 #84"
```

---

### Task 2: Works テーブルに last_synced_at カラムを追加

**Files:**
- Create: `backend/db/migrate/XXXXXX_add_last_synced_at_to_works.rb`
- Modify: `backend/db/schema.rb`（自動生成）

- [ ] **Step 1: マイグレーションを作成**

```bash
docker compose exec backend bin/rails generate migration AddLastSyncedAtToWorks last_synced_at:datetime
```

- [ ] **Step 2: マイグレーションを実行**

```bash
docker compose exec backend bin/rails db:migrate
```

- [ ] **Step 3: schema.rb に last_synced_at が追加されたことを確認**

```bash
docker compose exec backend grep -n "last_synced_at" db/schema.rb
```

期待: `t.datetime "last_synced_at"` が works テーブルに存在

- [ ] **Step 4: コミット**

```bash
git add backend/db/migrate/*_add_last_synced_at_to_works.rb backend/db/schema.rb
git commit -m "chore: works テーブルに last_synced_at カラムを追加 #84"
```

---

### Task 3: Record モデル — 自動完了を完結作品（FINISHED）のみに制限

**Files:**
- Modify: `backend/app/models/record.rb`
- Test: `backend/spec/models/record_spec.rb`

- [ ] **Step 1: 連載中作品で自動完了しないテストを追加**

`backend/spec/models/record_spec.rb` の「current_episode が total_episodes に到達」describe ブロックに追加:

```ruby
describe 'current_episode が total_episodes に到達' do
  it 'status を completed に自動変更' do
    record = described_class.create!(user: user, work: work_with_episodes,
                                     status: :watching, current_episode: 74)
    record.update!(current_episode: 75)
    expect(record.status).to eq('completed')
    expect(record.completed_at).to eq(Date.current)
  end

  it '連載中（RELEASING）の作品では自動完了しない' do
    ongoing_manga = Work.create!(
      title: 'ONE PIECE', media_type: 'manga',
      total_episodes: 110,
      metadata: { 'status' => 'RELEASING' }
    )
    record = described_class.create!(user: user, work: ongoing_manga,
                                     status: :watching, current_episode: 109)
    record.update!(current_episode: 110)
    expect(record.status).to eq('watching')
    expect(record.completed_at).to be_nil
  end

  it '完結済み（FINISHED）の作品では自動完了する' do
    finished_manga = Work.create!(
      title: 'ナルト', media_type: 'manga',
      total_episodes: 72,
      metadata: { 'status' => 'FINISHED' }
    )
    record = described_class.create!(user: user, work: finished_manga,
                                     status: :watching, current_episode: 71)
    record.update!(current_episode: 72)
    expect(record.status).to eq('completed')
  end

  it 'metadata に status がない作品では自動完了する（後方互換性）' do
    old_work = Work.create!(
      title: '古い作品', media_type: 'anime',
      total_episodes: 12, metadata: {}
    )
    record = described_class.create!(user: user, work: old_work,
                                     status: :watching, current_episode: 11)
    record.update!(current_episode: 12)
    expect(record.status).to eq('completed')
  end
end
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
docker compose exec backend bundle exec rspec spec/models/record_spec.rb -e "RELEASING" --format documentation
```

期待: FAIL（連載中でも自動完了してしまう）

- [ ] **Step 3: auto_complete_on_episode_reach を修正**

`backend/app/models/record.rb`:

```ruby
def auto_complete_on_episode_reach
  return unless current_episode_changed?
  return if status == 'completed'
  return if work.total_episodes.blank?
  return unless current_episode >= work.total_episodes
  # 連載中（RELEASING）の作品では自動完了しない
  return if work.metadata&.dig('status') == 'RELEASING'

  self.status = 'completed'
  self.completed_at ||= Date.current
  self.started_at ||= Date.current
end
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
docker compose exec backend bundle exec rspec spec/models/record_spec.rb --format documentation
```

期待: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add backend/app/models/record.rb backend/spec/models/record_spec.rb
git commit -m "feat: 連載中作品の自動完了を防止（FINISHEDのみ自動完了） #84"
```

---

### Task 4: AniList同期サービスの作成

**Files:**
- Create: `backend/app/services/anilist_sync_service.rb`
- Create: `backend/spec/services/anilist_sync_service_spec.rb`

- [ ] **Step 1: テストを書く**

`backend/spec/services/anilist_sync_service_spec.rb`:

```ruby
# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe AnilistSyncService, type: :service do
  let(:service) { described_class.new }

  # AniList の「IDで1件取得」用レスポンス
  let(:anilist_response) do
    {
      'data' => {
        'Media' => {
          'id' => 53_390,
          'volumes' => 34,
          'episodes' => nil,
          'chapters' => 139,
          'status' => 'FINISHED'
        }
      }
    }
  end

  before do
    stub_request(:post, 'https://graphql.anilist.co')
      .to_return(status: 200, body: anilist_response.to_json,
                 headers: { 'Content-Type' => 'application/json' })
  end

  describe '#sync_work' do
    let(:work) do
      Work.create!(
        title: '進撃の巨人', media_type: 'manga',
        total_episodes: 139, external_api_id: '53390',
        external_api_source: 'anilist',
        metadata: { 'status' => 'RELEASING' }
      )
    end

    it 'AniListから最新データを取得して更新する' do
      service.sync_work(work)
      work.reload
      expect(work.total_episodes).to eq(34)
      expect(work.metadata['status']).to eq('FINISHED')
    end

    it 'last_synced_at を更新する' do
      service.sync_work(work)
      work.reload
      expect(work.last_synced_at).to be_within(1.second).of(Time.current)
    end

    it 'AniListソースでない作品はスキップする' do
      non_anilist = Work.create!(
        title: '手動作品', media_type: 'manga',
        external_api_source: nil
      )
      expect { service.sync_work(non_anilist) }.not_to change { non_anilist.reload.last_synced_at }
    end
  end

  describe '#needs_sync?' do
    it 'last_synced_at が nil なら true' do
      work = Work.create!(title: 'テスト', media_type: 'manga', last_synced_at: nil)
      expect(service.needs_sync?(work)).to be true
    end

    it 'last_synced_at が24時間以上前なら true' do
      work = Work.create!(title: 'テスト', media_type: 'manga', last_synced_at: 25.hours.ago)
      expect(service.needs_sync?(work)).to be true
    end

    it 'last_synced_at が24時間以内なら false' do
      work = Work.create!(title: 'テスト', media_type: 'manga', last_synced_at: 23.hours.ago)
      expect(service.needs_sync?(work)).to be false
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
docker compose exec backend bundle exec rspec spec/services/anilist_sync_service_spec.rb --format documentation
```

期待: FAIL（AnilistSyncService が存在しない）

- [ ] **Step 3: AnilistSyncService を実装**

`backend/app/services/anilist_sync_service.rb`:

```ruby
# frozen_string_literal: true

# AniListからの作品データ同期サービス
# オンデマンド（作品詳細ページ表示時）と週次バッチで使用
class AnilistSyncService
  ENDPOINT = 'https://graphql.anilist.co'
  SYNC_INTERVAL = 24.hours

  QUERY = <<~GRAPHQL
    query ($id: Int) {
      Media(id: $id) {
        id
        volumes
        episodes
        chapters
        status
      }
    }
  GRAPHQL

  def sync_work(work)
    return unless work.external_api_source == 'anilist'
    return unless work.external_api_id.present?

    data = fetch_from_anilist(work.external_api_id.to_i)
    return unless data

    new_total = work.manga? ? data['volumes'] : data['episodes']
    work.update!(
      total_episodes: new_total || work.total_episodes,
      metadata: work.metadata.merge('status' => data['status']),
      last_synced_at: Time.current
    )
  end

  def needs_sync?(work)
    work.last_synced_at.nil? || work.last_synced_at < SYNC_INTERVAL.ago
  end

  private

  def fetch_from_anilist(anilist_id)
    response = connection.post('/', { query: QUERY, variables: { id: anilist_id } })
    response.body.dig('data', 'Media')
  rescue Faraday::Error => e
    Rails.logger.error("[AnilistSyncService] API通信エラー: #{e.message}")
    nil
  end

  def connection
    @connection ||= Faraday.new(url: ENDPOINT, request: { open_timeout: 5, timeout: 10 }) do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
    end
  end
end
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
docker compose exec backend bundle exec rspec spec/services/anilist_sync_service_spec.rb --format documentation
```

期待: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/anilist_sync_service.rb backend/spec/services/anilist_sync_service_spec.rb
git commit -m "feat: AniList同期サービスを追加 #84"
```

---

### Task 5: Works コントローラーに sync アクションを追加

**Files:**
- Modify: `backend/app/controllers/api/v1/works_controller.rb`
- Modify: `backend/config/routes.rb`
- Test: `backend/spec/requests/api/v1/works_spec.rb`

- [ ] **Step 1: sync エンドポイントのテストを書く**

`backend/spec/requests/api/v1/works_spec.rb` に追加:

```ruby
describe 'POST /api/v1/works/:id/sync' do
  let(:user) { User.create!(username: 'syncuser', email: 'sync@example.com', password: 'password123') }
  let(:work) do
    Work.create!(
      title: 'ONE PIECE', media_type: 'manga',
      total_episodes: 100, external_api_id: '21',
      external_api_source: 'anilist',
      metadata: { 'status' => 'RELEASING' },
      last_synced_at: 25.hours.ago
    )
  end

  before { sign_in user }

  context 'sync が必要な場合（24時間経過）' do
    before do
      stub_request(:post, 'https://graphql.anilist.co')
        .to_return(
          status: 200,
          body: {
            'data' => {
              'Media' => { 'id' => 21, 'volumes' => 110, 'episodes' => nil, 'chapters' => 1100, 'status' => 'RELEASING' }
            }
          }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )
    end

    it 'AniListからデータを同期して更新後の作品を返す' do
      post "/api/v1/works/#{work.id}/sync"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['work']['total_episodes']).to eq(110)
    end
  end

  context 'sync が不要な場合（24時間以内）' do
    let(:work) do
      Work.create!(
        title: 'ONE PIECE', media_type: 'manga',
        total_episodes: 110, external_api_id: '21',
        external_api_source: 'anilist',
        last_synced_at: 1.hour.ago
      )
    end

    it 'AniListに問い合わせずに現在のデータを返す' do
      post "/api/v1/works/#{work.id}/sync"
      expect(response).to have_http_status(:ok)
      # AniListへのリクエストが送信されていないことを確認
      expect(WebMock).not_to have_requested(:post, 'https://graphql.anilist.co')
    end
  end

  context '未認証の場合' do
    before { sign_out user }

    it '401を返す' do
      post "/api/v1/works/#{work.id}/sync"
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/works_spec.rb -e "sync" --format documentation
```

期待: FAIL（ルートが存在しない）

- [ ] **Step 3: ルートと sync アクションを追加**

`backend/config/routes.rb` — works のルートを変更:

```ruby
# 作品検索・手動登録
resources :works, only: [:create] do
  collection do
    get :search
  end
  member do
    post :sync
  end
end
```

`backend/app/controllers/api/v1/works_controller.rb` — sync アクションを追加:

```ruby
# frozen_string_literal: true

module Api
  module V1
    class WorksController < ApplicationController
      before_action :authenticate_user!

      # GET /api/v1/works/search?q=キーワード&media_type=anime
      def search
        query = params[:q]
        return render json: { error: '検索キーワードを入力してください' }, status: :unprocessable_content if query.blank?

        results = WorkSearchService.new.search(query, media_type: params[:media_type])
        render json: { results: results.map(&:to_h) }
      end

      # POST /api/v1/works（手動登録）
      def create
        work = Work.new(work_params)

        if work.save
          render json: { work: work.as_json }, status: :created
        else
          render json: { errors: work.errors.full_messages }, status: :unprocessable_content
        end
      end

      # POST /api/v1/works/:id/sync
      # AniListからデータを再取得して更新する
      def sync
        work = Work.find(params[:id])
        sync_service = AnilistSyncService.new

        sync_service.sync_work(work) if sync_service.needs_sync?(work)

        render json: { work: work.reload.as_json }
      end

      private

      def work_params
        params.expect(work: %i[title media_type description cover_image_url total_episodes])
      end
    end
  end
end
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/works_spec.rb --format documentation
```

期待: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add backend/app/controllers/api/v1/works_controller.rb backend/config/routes.rb backend/spec/requests/api/v1/works_spec.rb
git commit -m "feat: 作品データ同期エンドポイント POST /api/v1/works/:id/sync を追加 #84"
```

---

### Task 6: Records コントローラー — metadata の受け渡し

**Files:**
- Modify: `backend/app/controllers/api/v1/records_controller.rb`
- Test: `backend/spec/requests/api/v1/records_spec.rb`

- [ ] **Step 1: metadata 付きでレコード作成するテストを書く**

`backend/spec/requests/api/v1/records_spec.rb` の POST セクションに追加:

```ruby
it '外部API作品作成時に metadata を保存する' do
  post '/api/v1/records', params: {
    record: {
      work_data: {
        title: 'ONE PIECE',
        media_type: 'manga',
        description: '海賊王を目指す',
        cover_image_url: 'https://example.com/op.jpg',
        total_episodes: 110,
        external_api_id: '21',
        external_api_source: 'anilist',
        metadata: { status: 'RELEASING', genres: ['Action'] }
      }
    }
  }
  expect(response).to have_http_status(:created)
  work = Work.find_by(external_api_id: '21')
  expect(work.metadata['status']).to eq('RELEASING')
end
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/records_spec.rb -e "metadata" --format documentation
```

期待: FAIL（metadata が保存されない）

- [ ] **Step 3: RecordsController の find_or_create_from_external を修正**

`backend/app/controllers/api/v1/records_controller.rb` の `find_or_create_from_external` メソッドを修正:

```ruby
def find_or_create_from_external
  data = params.expect(record: {
                         work_data: %i[title media_type description
                                       cover_image_url total_episodes
                                       external_api_id external_api_source]
                       })[:work_data]
  metadata = params.dig(:record, :work_data, :metadata)&.permit!&.to_h

  if data[:external_api_id].present? && data[:external_api_source].present?
    Work.find_or_create_by!(
      external_api_id: data[:external_api_id],
      external_api_source: data[:external_api_source]
    ) do |work|
      work.assign_attributes(data.except(:external_api_id, :external_api_source))
      work.metadata = metadata if metadata.present?
    end
  else
    Work.create!(data)
  end
rescue ActiveRecord::RecordNotUnique
  Work.find_by!(external_api_id: data[:external_api_id], external_api_source: data[:external_api_source])
rescue ActiveRecord::RecordInvalid
  nil
end
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/records_spec.rb --format documentation
```

期待: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add backend/app/controllers/api/v1/records_controller.rb backend/spec/requests/api/v1/records_spec.rb
git commit -m "feat: レコード作成時に作品の metadata を保存するよう変更 #84"
```

---

### Task 7: 週次バッチ同期 Rake タスク

**Files:**
- Create: `backend/lib/tasks/anilist_sync.rake`
- Create: `backend/spec/tasks/anilist_sync_spec.rb`（簡易テスト）

- [ ] **Step 1: Rake タスクを作成**

`backend/lib/tasks/anilist_sync.rake`:

```ruby
# frozen_string_literal: true

namespace :anilist do
  desc '全漫画作品のAniListデータを一括同期する（週次バッチ用）'
  task sync_manga: :environment do
    works = Work.where(media_type: :manga, external_api_source: 'anilist')
                .where.not(external_api_id: nil)
    total = works.count
    synced = 0
    errors = 0

    puts "#{total} 件の漫画作品を同期します..."

    service = AnilistSyncService.new
    works.find_each do |work|
      service.sync_work(work)
      synced += 1
      # AniListのレートリミット対策（90リクエスト/分 → 1秒間隔）
      sleep 1
    rescue StandardError => e
      errors += 1
      Rails.logger.error("[anilist:sync_manga] #{work.title}(ID:#{work.id}) 同期エラー: #{e.message}")
    end

    puts "同期完了: 成功 #{synced} 件 / エラー #{errors} 件"
  end
end
```

- [ ] **Step 2: タスクが読み込めることを確認**

```bash
docker compose exec backend bin/rails -T | grep anilist
```

期待: `rake anilist:sync_manga` が表示される

- [ ] **Step 3: コミット**

```bash
git add backend/lib/tasks/anilist_sync.rake
git commit -m "feat: 漫画作品の週次バッチ同期 Rake タスクを追加 #84"
```

---

### Task 8: フロントエンド — 型定義と API メソッドの追加

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/worksApi.ts`
- Modify: `frontend/src/lib/recordsApi.ts`
- Modify: `frontend/src/lib/mediaTypeUtils.ts`
- Test: `frontend/src/lib/mediaTypeUtils.test.ts`

- [ ] **Step 1: テストを書く**

`frontend/src/lib/mediaTypeUtils.test.ts` に追加:

```typescript
import { getUnreadCount, isOngoing } from './mediaTypeUtils'

describe('isOngoing', () => {
  it('metadata.status が RELEASING なら true', () => {
    expect(isOngoing({ status: 'RELEASING' })).toBe(true)
  })

  it('metadata.status が FINISHED なら false', () => {
    expect(isOngoing({ status: 'FINISHED' })).toBe(false)
  })

  it('metadata が空なら false', () => {
    expect(isOngoing({})).toBe(false)
  })
})

describe('getUnreadCount', () => {
  it('未読巻数を返す', () => {
    expect(getUnreadCount(108, 110)).toBe(2)
  })

  it('追いついている場合は 0', () => {
    expect(getUnreadCount(110, 110)).toBe(0)
  })

  it('total が null の場合は 0', () => {
    expect(getUnreadCount(5, null)).toBe(0)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
docker compose exec frontend npx vitest run src/lib/mediaTypeUtils.test.ts
```

期待: FAIL（isOngoing, getUnreadCount が存在しない）

- [ ] **Step 3: 型定義を追加**

`frontend/src/lib/types.ts` の Work インターフェースの `metadata` 型をより具体的にする:

```typescript
// 作品（DBに保存済み）
export interface Work {
  id: number
  title: string
  media_type: MediaType
  description: string | null
  cover_image_url: string | null
  total_episodes: number | null
  external_api_id: string | null
  external_api_source: string | null
  metadata: WorkMetadata
  last_synced_at: string | null
  created_at: string
}

// AniList等の外部APIから取得したメタデータ
export interface WorkMetadata {
  status?: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS'
  genres?: string[]
  season_year?: number
  popularity?: number
  title_english?: string
  title_romaji?: string
  [key: string]: unknown
}
```

SearchResult の metadata も同様に `WorkMetadata` にする:

```typescript
export interface SearchResult {
  title: string
  media_type: MediaType
  description: string | null
  cover_image_url: string | null
  total_episodes: number | null
  external_api_id: string | null
  external_api_source: string | null
  metadata: WorkMetadata
}
```

- [ ] **Step 4: mediaTypeUtils にヘルパー関数を追加**

`frontend/src/lib/mediaTypeUtils.ts` に追加:

```typescript
import type { MediaType, RecordStatus, WorkMetadata } from './types'

/** 作品が連載中（RELEASING）かどうかを返す */
export function isOngoing(metadata: WorkMetadata): boolean {
  return metadata?.status === 'RELEASING'
}

/** 未読巻数を返す（total が null の場合は 0） */
export function getUnreadCount(currentEpisode: number, totalEpisodes: number | null): number {
  if (totalEpisodes === null) return 0
  return Math.max(0, totalEpisodes - currentEpisode)
}
```

- [ ] **Step 5: worksApi に sync メソッドを追加**

`frontend/src/lib/worksApi.ts`:

```typescript
import type { SearchResponse, WorkResponse, MediaType } from './types'
import { request } from './api'

export const worksApi = {
  search(query: string, mediaType?: MediaType): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query })
    if (mediaType) params.append('media_type', mediaType)
    return request<SearchResponse>(`/works/search?${params.toString()}`)
  },

  create(title: string, mediaType: MediaType, description?: string): Promise<WorkResponse> {
    return request<WorkResponse>('/works', {
      method: 'POST',
      body: JSON.stringify({
        work: { title, media_type: mediaType, description },
      }),
    })
  },

  sync(workId: number): Promise<WorkResponse> {
    return request<WorkResponse>(`/works/${workId}/sync`, {
      method: 'POST',
    })
  },
}
```

- [ ] **Step 6: recordsApi の createFromSearchResult に metadata を含める**

`frontend/src/lib/recordsApi.ts` の `createFromSearchResult` を修正:

```typescript
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
    | 'metadata'
  >,
  options?: RecordCreateOptions,
): Promise<RecordResponse> {
  return request<RecordResponse>('/records', {
    method: 'POST',
    body: JSON.stringify({ record: { work_data: workData, ...options } }),
  })
},
```

- [ ] **Step 7: テストがパスすることを確認**

```bash
docker compose exec frontend npx vitest run src/lib/mediaTypeUtils.test.ts
```

期待: 全テストパス

- [ ] **Step 8: コミット**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/worksApi.ts frontend/src/lib/recordsApi.ts frontend/src/lib/mediaTypeUtils.ts frontend/src/lib/mediaTypeUtils.test.ts
git commit -m "feat: フロントエンドの型定義・API・ヘルパー関数を追加 #84"
```

---

### Task 9: フロントエンド — ProgressControl に連載中バッジを追加

**Files:**
- Modify: `frontend/src/components/ui/ProgressControl/ProgressControl.tsx`
- Modify: `frontend/src/components/ui/ProgressControl/ProgressControl.module.css`
- Test: `frontend/src/components/ui/ProgressControl/ProgressControl.test.tsx`

- [ ] **Step 1: テストを書く**

`frontend/src/components/ui/ProgressControl/ProgressControl.test.tsx` に追加:

```typescript
import { render, screen } from '@testing-library/react'
import { ProgressControl } from './ProgressControl'

describe('連載中バッジ', () => {
  it('isOngoing が true のとき「連載中」バッジを表示する', () => {
    render(
      <ProgressControl current={110} total={110} onChange={() => {}} mediaType="manga" isOngoing />
    )
    expect(screen.getByText('連載中')).toBeInTheDocument()
  })

  it('isOngoing が false のとき「連載中」バッジを表示しない', () => {
    render(
      <ProgressControl current={72} total={72} onChange={() => {}} mediaType="manga" />
    )
    expect(screen.queryByText('連載中')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
docker compose exec frontend npx vitest run src/components/ui/ProgressControl/ProgressControl.test.tsx
```

期待: FAIL（isOngoing prop が存在しない）

- [ ] **Step 3: ProgressControl を修正**

`frontend/src/components/ui/ProgressControl/ProgressControl.tsx`:

```typescript
import type { ChangeEvent } from 'react'
import type { MediaType } from '../../../lib/types'
import { UNIT_LABELS } from '../../../lib/mediaTypeUtils'
import styles from './ProgressControl.module.css'

type ProgressControlProps = {
  current: number
  total: number | null
  onChange: (episode: number) => void
  showFullControls?: boolean
  mediaType?: MediaType
  isOngoing?: boolean
}

export function ProgressControl({
  current,
  total,
  onChange,
  showFullControls = false,
  mediaType,
  isOngoing = false,
}: ProgressControlProps) {
  const unit = (mediaType && UNIT_LABELS[mediaType]) ?? '話'
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
          {total !== null ? `${current} / ${total}${unit}` : `${current}${unit}`}
        </span>
        {isOngoing && <span className={styles.ongoingBadge}>連載中</span>}
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

- [ ] **Step 4: CSS にバッジスタイルを追加**

`frontend/src/components/ui/ProgressControl/ProgressControl.module.css` に追加:

```css
.ongoingBadge {
  display: inline-block;
  font-size: var(--font-size-meta);
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: var(--font-weight-bold);
  background: #fff3e0;
  color: #e65100;
}
```

- [ ] **Step 5: テストがパスすることを確認**

```bash
docker compose exec frontend npx vitest run src/components/ui/ProgressControl/ProgressControl.test.tsx
```

期待: 全テストパス

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ui/ProgressControl/ProgressControl.tsx frontend/src/components/ui/ProgressControl/ProgressControl.module.css frontend/src/components/ui/ProgressControl/ProgressControl.test.tsx
git commit -m "feat: ProgressControl に連載中バッジを追加 #84"
```

---

### Task 10: フロントエンド — WatchingListItem に未読バッジを追加

**Files:**
- Modify: `frontend/src/components/WatchingListItem/WatchingListItem.tsx`
- Modify: `frontend/src/components/WatchingListItem/WatchingListItem.module.css`
- Test: `frontend/src/components/WatchingListItem/WatchingListItem.test.tsx`

- [ ] **Step 1: テストを書く**

`frontend/src/components/WatchingListItem/WatchingListItem.test.tsx` に追加:

```typescript
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WatchingListItem } from './WatchingListItem'
import type { UserRecord } from '../../lib/types'

const baseRecord: UserRecord = {
  id: 1,
  work_id: 1,
  status: 'watching',
  rating: null,
  current_episode: 108,
  rewatch_count: 0,
  review_text: null,
  visibility: 'private_record',
  started_at: null,
  completed_at: null,
  created_at: '2026-01-01',
  work: {
    id: 1,
    title: 'ONE PIECE',
    media_type: 'manga',
    description: null,
    cover_image_url: null,
    total_episodes: 110,
    external_api_id: '21',
    external_api_source: 'anilist',
    metadata: { status: 'RELEASING' },
    last_synced_at: null,
    created_at: '2026-01-01',
  },
}

const renderItem = (record: UserRecord) =>
  render(
    <MemoryRouter>
      <WatchingListItem record={record} onAction={() => {}} />
    </MemoryRouter>
  )

describe('未読バッジ', () => {
  it('連載中の漫画で未読がある場合「未読 2巻」を表示する', () => {
    renderItem(baseRecord)
    expect(screen.getByText('未読 2巻')).toBeInTheDocument()
  })

  it('追いついている場合はバッジを表示しない', () => {
    const caughtUp = {
      ...baseRecord,
      current_episode: 110,
    }
    renderItem(caughtUp)
    expect(screen.queryByText(/未読/)).not.toBeInTheDocument()
  })

  it('完結済み作品ではバッジを表示しない', () => {
    const finished = {
      ...baseRecord,
      work: { ...baseRecord.work, metadata: { status: 'FINISHED' as const } },
    }
    renderItem(finished)
    expect(screen.queryByText(/未読/)).not.toBeInTheDocument()
  })

  it('アニメではバッジを表示しない', () => {
    const anime = {
      ...baseRecord,
      work: { ...baseRecord.work, media_type: 'anime' as const, metadata: { status: 'RELEASING' as const } },
    }
    renderItem(anime)
    expect(screen.queryByText(/未読/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
docker compose exec frontend npx vitest run src/components/WatchingListItem/WatchingListItem.test.tsx
```

期待: FAIL（未読バッジが表示されない）

- [ ] **Step 3: WatchingListItem を修正**

`frontend/src/components/WatchingListItem/WatchingListItem.tsx`:

```typescript
import { Link } from 'react-router-dom'
import type { UserRecord } from '../../lib/types'
import { getActionLabel, getGenreLabel, getProgressText, isOngoing, getUnreadCount } from '../../lib/mediaTypeUtils'
import styles from './WatchingListItem.module.css'

const GENRE_COLOR_VAR: Record<string, string> = {
  anime: 'var(--color-anime)',
  movie: 'var(--color-movie)',
  drama: 'var(--color-drama)',
  book: 'var(--color-book)',
  manga: 'var(--color-manga)',
  game: 'var(--color-game)',
}

type WatchingListItemProps = {
  record: UserRecord
  onAction: (record: UserRecord) => void
}

export function WatchingListItem({ record, onAction }: WatchingListItemProps) {
  const { work } = record
  const color = GENRE_COLOR_VAR[work.media_type]
  const progressText = getProgressText(work.media_type, record.current_episode, work.total_episodes)
  const unreadCount = work.media_type === 'manga' && isOngoing(work.metadata)
    ? getUnreadCount(record.current_episode, work.total_episodes)
    : 0

  return (
    <div className={styles.row}>
      <Link to={`/works/${work.id}`} className={styles.link}>
        {work.cover_image_url ? (
          <img src={work.cover_image_url} alt="" className={styles.cover} />
        ) : (
          <div className={styles.coverPlaceholder} style={{ background: color }} />
        )}
        <div className={styles.info}>
          <div className={styles.title}>{work.title}</div>
          <div className={styles.genre} style={{ color }}>
            {getGenreLabel(work.media_type)}
          </div>
          <div className={styles.progress}>
            {progressText}
            {unreadCount > 0 && (
              <span className={styles.unreadBadge}>未読 {unreadCount}巻</span>
            )}
          </div>
        </div>
      </Link>
      <button
        className={styles.actionButton}
        onClick={(e) => {
          e.preventDefault()
          onAction(record)
        }}
      >
        {getActionLabel(work.media_type)}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: CSS にバッジスタイルを追加**

`frontend/src/components/WatchingListItem/WatchingListItem.module.css` に追加:

```css
.unreadBadge {
  display: inline-block;
  font-size: var(--font-size-meta);
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: var(--font-weight-bold);
  margin-left: 6px;
  background: var(--color-manga);
  color: var(--color-bg-white);
}
```

- [ ] **Step 5: テストがパスすることを確認**

```bash
docker compose exec frontend npx vitest run src/components/WatchingListItem/WatchingListItem.test.tsx
```

期待: 全テストパス

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/WatchingListItem/WatchingListItem.tsx frontend/src/components/WatchingListItem/WatchingListItem.module.css frontend/src/components/WatchingListItem/WatchingListItem.test.tsx
git commit -m "feat: WatchingListItem に未読バッジ（未読 X巻）を追加 #84"
```

---

### Task 11: フロントエンド — WorkDetailPage に新刊アラートと sync 処理を追加

**Files:**
- Modify: `frontend/src/pages/WorkDetailPage/useWorkDetail.ts`
- Modify: `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`

- [ ] **Step 1: useWorkDetail に sync 処理を追加**

`frontend/src/pages/WorkDetailPage/useWorkDetail.ts` を修正:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { UserRecord, RecordStatus } from '../../lib/types'
import { recordsApi } from '../../lib/recordsApi'
import { worksApi } from '../../lib/worksApi'

type WorkDetailState = {
  record: UserRecord | null
  isLoading: boolean
  isDeleting: boolean
  showDeleteDialog: boolean
}

export function useWorkDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const hasValidId = !isNaN(Number(id))
  const [state, setState] = useState<WorkDetailState>({
    record: null,
    isLoading: hasValidId,
    isDeleting: false,
    showDeleteDialog: false,
  })

  useEffect(() => {
    const workId = Number(id)
    if (isNaN(workId)) return

    let cancelled = false
    const fetchRecord = async () => {
      try {
        const res = await recordsApi.getAll({ workId })
        if (!cancelled) {
          const record = res.records[0] ?? null
          setState((prev) => ({
            ...prev,
            record,
            isLoading: false,
          }))
          // 作品データの同期（24時間以上経過していたら自動更新）
          if (record?.work.external_api_source === 'anilist') {
            try {
              const syncRes = await worksApi.sync(record.work.id)
              if (!cancelled && syncRes.work) {
                setState((prev) => {
                  if (!prev.record) return prev
                  return {
                    ...prev,
                    record: { ...prev.record, work: syncRes.work },
                  }
                })
              }
            } catch {
              // sync失敗は無視（データ表示に影響しない）
            }
          }
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, isLoading: false }))
        }
      }
    }
    void fetchRecord()
    return () => {
      cancelled = true
    }
  }, [id])

  // 以下は既存コードと同一のため省略なし — 全メソッドをそのまま維持

  const updateRecord = useCallback(
    async (params: {
      status?: RecordStatus
      rating?: number | null
      current_episode?: number
      review_text?: string | null
      rewatch_count?: number
    }) => {
      if (!state.record) return
      try {
        const res = await recordsApi.update(state.record.id, params)
        setState((prev) => ({ ...prev, record: res.record }))
      } catch {
        // エラー時は状態を変更しない
      }
    },
    [state.record],
  )

  const handleStatusChange = useCallback(
    (status: RecordStatus) => {
      void updateRecord({ status })
    },
    [updateRecord],
  )

  const handleRatingChange = useCallback(
    (rating: number | null) => {
      void updateRecord({ rating })
    },
    [updateRecord],
  )

  const handleEpisodeChange = useCallback(
    (episode: number) => {
      void updateRecord({ current_episode: episode })
    },
    [updateRecord],
  )

  const handleReviewTextSave = useCallback(
    async (text: string) => {
      await updateRecord({ review_text: text })
    },
    [updateRecord],
  )

  const handleRewatchCountChange = useCallback(
    (count: number) => {
      void updateRecord({ rewatch_count: count })
    },
    [updateRecord],
  )

  const openDeleteDialog = useCallback(() => {
    setState((prev) => ({ ...prev, showDeleteDialog: true }))
  }, [])

  const closeDeleteDialog = useCallback(() => {
    setState((prev) => ({ ...prev, showDeleteDialog: false }))
  }, [])

  const handleDelete = useCallback(async () => {
    if (!state.record) return
    setState((prev) => ({ ...prev, isDeleting: true }))
    try {
      await recordsApi.remove(state.record.id)
      if (window.history.length > 1) {
        navigate(-1)
      } else {
        navigate('/search')
      }
    } catch {
      setState((prev) => ({ ...prev, isDeleting: false }))
    }
  }, [state.record, navigate])

  const confirmDelete = useCallback(() => {
    void handleDelete()
  }, [handleDelete])

  return {
    record: state.record,
    isLoading: state.isLoading,
    isDeleting: state.isDeleting,
    showDeleteDialog: state.showDeleteDialog,
    handleStatusChange,
    handleRatingChange,
    handleEpisodeChange,
    handleReviewTextSave,
    handleRewatchCountChange,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
  }
}
```

- [ ] **Step 2: WorkDetailPage に連載中バッジと新刊アラートを追加**

`frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx` の ProgressControl 部分を修正:

import に追加:

```typescript
import { isOngoing, getUnreadCount, UNIT_LABELS } from '../../lib/mediaTypeUtils'
```

ProgressControl の呼び出し部分を修正:

```tsx
{hasEpisodes(work.media_type) && (
  <div className={styles.section}>
    <div className={styles.label}>進捗</div>
    <ProgressControl
      current={record.current_episode}
      total={work.total_episodes}
      onChange={handleEpisodeChange}
      showFullControls
      mediaType={work.media_type}
      isOngoing={work.media_type === 'manga' && isOngoing(work.metadata)}
    />
    {work.media_type === 'manga' &&
      isOngoing(work.metadata) &&
      getUnreadCount(record.current_episode, work.total_episodes) > 0 && (
        <div className={styles.newVolumeAlert}>
          📖 <strong>新刊</strong>が出ています！ {work.total_episodes}巻
        </div>
      )}
  </div>
)}
```

- [ ] **Step 3: WorkDetailPage の CSS に新刊アラートスタイルを追加**

`frontend/src/pages/WorkDetailPage/WorkDetailPage.module.css` に追加:

```css
.newVolumeAlert {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: #fef3ef;
  border: var(--border-width-thin) var(--border-style) var(--color-manga);
  border-radius: 6px;
  padding: var(--spacing-sm) var(--spacing-md);
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-label);
  color: var(--color-text);
}

.newVolumeAlert strong {
  color: var(--color-manga);
}
```

- [ ] **Step 4: ESLint / TypeScript エラーがないことを確認**

```bash
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npx eslint src/pages/WorkDetailPage/ src/lib/mediaTypeUtils.ts
```

期待: エラーなし

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/WorkDetailPage/useWorkDetail.ts frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx frontend/src/pages/WorkDetailPage/WorkDetailPage.module.css
git commit -m "feat: WorkDetailPage に新刊アラートとAniList自動sync処理を追加 #84"
```

---

### Task 12: 既存データ移行タスク

**Files:**
- Modify: `backend/lib/tasks/anilist_sync.rake`

- [ ] **Step 1: 移行タスクを追加**

`backend/lib/tasks/anilist_sync.rake` に追加:

```ruby
desc '既存の漫画作品をAniListから volumes を再取得して更新する（1回限り）'
task migrate_manga_to_volumes: :environment do
  works = Work.where(media_type: :manga, external_api_source: 'anilist')
              .where.not(external_api_id: nil)
  total = works.count
  updated = 0
  errors = 0

  puts "#{total} 件の漫画作品の total_episodes を volumes に移行します..."

  service = AnilistSyncService.new
  works.find_each do |work|
    old_value = work.total_episodes
    service.sync_work(work)
    work.reload
    if work.total_episodes != old_value
      updated += 1
      puts "  #{work.title}: #{old_value} → #{work.total_episodes}"
    end
    sleep 1
  rescue StandardError => e
    errors += 1
    Rails.logger.error("[migrate_manga_to_volumes] #{work.title}(ID:#{work.id}) エラー: #{e.message}")
  end

  puts "移行完了: 更新 #{updated} 件 / エラー #{errors} 件 / 全 #{total} 件"
end
```

- [ ] **Step 2: タスクが読み込めることを確認**

```bash
docker compose exec backend bin/rails -T | grep anilist
```

期待: `rake anilist:migrate_manga_to_volumes` が表示される

- [ ] **Step 3: コミット**

```bash
git add backend/lib/tasks/anilist_sync.rake
git commit -m "feat: 既存漫画データの volumes 移行タスクを追加 #84"
```

---

### Task 13: 全体テスト + リンターチェック

**Files:** なし（検証のみ）

- [ ] **Step 1: バックエンド全テスト実行**

```bash
docker compose exec backend bundle exec rspec --format documentation
```

期待: 全テストパス

- [ ] **Step 2: フロントエンド全テスト実行**

```bash
docker compose exec frontend npx vitest run
```

期待: 全テストパス

- [ ] **Step 3: リンター実行**

```bash
docker compose exec backend bundle exec rubocop
docker compose exec frontend npx eslint src/ && npx prettier --check src/
```

期待: エラーなし

- [ ] **Step 4: 修正が必要な場合は修正してコミット**
