# フェーズ3: コミュニティ機能 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 作品ごとのディスカッション掲示板（スレッド + コメント）とユーザープロフィール公開ページを実装する

**Architecture:** Rails API に Discussions/Comments/Users エンドポイントを追加し、React フロントエンドに3つの新規ページ（コミュニティ、ディスカッション詳細、ユーザープロフィール）と作品詳細ページへのセクション追加を行う。既存の RecordFilterable パターン、MediaTypeFilter/SortSelector/Pagination コンポーネントを最大限再利用する。

**Tech Stack:** Ruby on Rails 8 (API) / RSpec / React 19 / TypeScript / Vitest + React Testing Library / CSS Modules

**Spec:** `docs/superpowers/specs/2026-03-29-phase3-community-design.md`

---

## ファイル構成

### バックエンド — 新規作成

| ファイル | 責務 |
|---------|------|
| `backend/db/migrate/XXXXXX_create_discussions.rb` | discussions テーブル作成 |
| `backend/db/migrate/XXXXXX_create_comments.rb` | comments テーブル作成 |
| `backend/app/models/discussion.rb` | Discussion モデル（バリデーション・リレーション） |
| `backend/app/models/comment.rb` | Comment モデル（バリデーション・counter_cache） |
| `backend/app/controllers/api/v1/discussions_controller.rb` | ディスカッション CRUD |
| `backend/app/controllers/api/v1/comments_controller.rb` | コメント CRUD |
| `backend/app/controllers/api/v1/profiles_controller.rb` | ユーザープロフィール取得 |
| `backend/app/controllers/api/v1/user_records_controller.rb` | ユーザー公開記録取得 |
| `backend/app/controllers/concerns/discussion_filterable.rb` | ディスカッション用フィルタ Concern |
| `backend/spec/models/discussion_spec.rb` | Discussion モデルテスト |
| `backend/spec/models/comment_spec.rb` | Comment モデルテスト |
| `backend/spec/requests/api/v1/discussions_spec.rb` | Discussions API テスト |
| `backend/spec/requests/api/v1/comments_spec.rb` | Comments API テスト |
| `backend/spec/requests/api/v1/profiles_spec.rb` | Profiles API テスト |
| `backend/spec/requests/api/v1/user_records_spec.rb` | UserRecords API テスト |

### バックエンド — 変更

| ファイル | 変更内容 |
|---------|---------|
| `backend/config/routes.rb` | discussions, comments, users ルート追加 |
| `backend/app/models/user.rb` | `has_many :discussions`, `has_many :comments` 追加 |
| `backend/app/models/work.rb` | `has_many :discussions` 追加 |

### フロントエンド — 新規作成

| ファイル | 責務 |
|---------|------|
| `frontend/src/lib/discussionsApi.ts` | Discussions API 通信 |
| `frontend/src/lib/commentsApi.ts` | Comments API 通信 |
| `frontend/src/lib/usersApi.ts` | Users API 通信 |
| `frontend/src/lib/timeUtils.ts` | 相対時間表示ユーティリティ |
| `frontend/src/hooks/useDiscussions.ts` | ディスカッション一覧フック |
| `frontend/src/hooks/useDiscussion.ts` | ディスカッション詳細フック |
| `frontend/src/hooks/useComments.ts` | コメント一覧フック |
| `frontend/src/hooks/useUserProfile.ts` | ユーザープロフィールフック |
| `frontend/src/hooks/useUserRecords.ts` | ユーザー公開記録フック |
| `frontend/src/pages/CommunityPage/CommunityPage.tsx` | コミュニティページ |
| `frontend/src/pages/CommunityPage/CommunityPage.module.css` | コミュニティページスタイル |
| `frontend/src/pages/DiscussionDetailPage/DiscussionDetailPage.tsx` | ディスカッション詳細ページ |
| `frontend/src/pages/DiscussionDetailPage/DiscussionDetailPage.module.css` | 詳細ページスタイル |
| `frontend/src/pages/UserProfilePage/UserProfilePage.tsx` | ユーザープロフィールページ |
| `frontend/src/pages/UserProfilePage/UserProfilePage.module.css` | プロフィールページスタイル |
| `frontend/src/components/DiscussionCard/DiscussionCard.tsx` | スレッドカード |
| `frontend/src/components/DiscussionCard/DiscussionCard.module.css` | スレッドカードスタイル |
| `frontend/src/components/DiscussionSection/DiscussionSection.tsx` | 作品詳細用セクション |
| `frontend/src/components/DiscussionSection/DiscussionSection.module.css` | セクションスタイル |
| `frontend/src/components/DiscussionCreateModal/DiscussionCreateModal.tsx` | スレッド作成モーダル |
| `frontend/src/components/DiscussionCreateModal/DiscussionCreateModal.module.css` | モーダルスタイル |
| `frontend/src/components/CommentItem/CommentItem.tsx` | コメント表示 |
| `frontend/src/components/CommentItem/CommentItem.module.css` | コメントスタイル |
| `frontend/src/components/CommentForm/CommentForm.tsx` | コメント投稿フォーム |
| `frontend/src/components/CommentForm/CommentForm.module.css` | フォームスタイル |
| `frontend/src/components/UserProfileHeader/UserProfileHeader.tsx` | プロフィールヘッダー |
| `frontend/src/components/UserProfileHeader/UserProfileHeader.module.css` | ヘッダースタイル |
| `frontend/src/components/UserStats/UserStats.tsx` | 統計カード |
| `frontend/src/components/UserStats/UserStats.module.css` | 統計スタイル |
| `frontend/src/components/PublicLibrary/PublicLibrary.tsx` | 公開ライブラリ一覧 |
| `frontend/src/components/PublicLibrary/PublicLibrary.module.css` | ライブラリスタイル |
| `frontend/src/components/ui/Breadcrumb/Breadcrumb.tsx` | パンくずリスト |
| `frontend/src/components/ui/Breadcrumb/Breadcrumb.module.css` | パンくずスタイル |
| `frontend/src/components/ui/SpoilerBadge/SpoilerBadge.tsx` | ネタバレバッジ |
| `frontend/src/components/ui/SpoilerBadge/SpoilerBadge.module.css` | バッジスタイル |
| `frontend/src/components/ui/EpisodeBadge/EpisodeBadge.tsx` | 話数バッジ |
| `frontend/src/components/ui/EpisodeBadge/EpisodeBadge.module.css` | バッジスタイル |
| `frontend/src/components/ui/DropdownMenu/DropdownMenu.tsx` | ⋯メニュー（編集・削除） |
| `frontend/src/components/ui/DropdownMenu/DropdownMenu.module.css` | メニュースタイル |

### フロントエンド — 変更

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/lib/types.ts` | Discussion, Comment, UserProfile 型追加 |
| `frontend/src/App.tsx` | 3つの新規ルート追加 + PublicLayout |
| `frontend/src/components/ui/NavBar/NavBar.tsx` | コミュニティリンク有効化 |
| `frontend/src/components/ui/BottomTabBar/BottomTabBar.tsx` | コミュニティタブ追加（5タブ化） |
| `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx` | DiscussionSection 追加 |

---

## Task 1: Discussion モデル + マイグレーション

**Files:**
- Create: `backend/db/migrate/XXXXXX_create_discussions.rb`
- Create: `backend/app/models/discussion.rb`
- Modify: `backend/app/models/user.rb`
- Modify: `backend/app/models/work.rb`
- Test: `backend/spec/models/discussion_spec.rb`

- [ ] **Step 1: テストファイルを作成する**

```ruby
# backend/spec/models/discussion_spec.rb
require 'rails_helper'

RSpec.describe Discussion, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work) { Work.create!(title: 'テスト作品', media_type: :anime, total_episodes: 12) }

  before do
    # ユーザーがこの作品を記録済みであること（Discussion作成の前提条件）
    Record.create!(user: user, work: work, status: :watching)
  end

  describe 'バリデーション' do
    it 'title, body, user, workがあれば有効' do
      discussion = Discussion.new(title: 'テスト', body: 'テスト本文', user: user, work: work)
      expect(discussion).to be_valid
    end

    it 'titleが空なら無効' do
      discussion = Discussion.new(title: '', body: 'テスト本文', user: user, work: work)
      expect(discussion).not_to be_valid
    end

    it 'titleが100文字を超えると無効' do
      discussion = Discussion.new(title: 'a' * 101, body: 'テスト本文', user: user, work: work)
      expect(discussion).not_to be_valid
    end

    it 'bodyが空なら無効' do
      discussion = Discussion.new(title: 'テスト', body: '', user: user, work: work)
      expect(discussion).not_to be_valid
    end

    it 'bodyが5000文字を超えると無効' do
      discussion = Discussion.new(title: 'テスト', body: 'a' * 5001, user: user, work: work)
      expect(discussion).not_to be_valid
    end

    it 'episode_numberがtotal_episodesを超えると無効' do
      discussion = Discussion.new(title: 'テスト', body: 'テスト本文', user: user, work: work, episode_number: 13)
      expect(discussion).not_to be_valid
    end

    it 'episode_numberがtotal_episodes以下なら有効' do
      discussion = Discussion.new(title: 'テスト', body: 'テスト本文', user: user, work: work, episode_number: 12)
      expect(discussion).to be_valid
    end

    it 'episode_numberがnilなら有効（作品全体のスレッド）' do
      discussion = Discussion.new(title: 'テスト', body: 'テスト本文', user: user, work: work, episode_number: nil)
      expect(discussion).to be_valid
    end

    it 'episode_numberが0以下なら無効' do
      discussion = Discussion.new(title: 'テスト', body: 'テスト本文', user: user, work: work, episode_number: 0)
      expect(discussion).not_to be_valid
    end

    it 'total_episodesがnilの作品ではepisode_numberが正の整数ならOK' do
      work_no_total = Work.create!(title: '話数不明作品', media_type: :anime, total_episodes: nil)
      Record.create!(user: user, work: work_no_total, status: :watching)
      discussion = Discussion.new(title: 'テスト', body: 'テスト本文', user: user, work: work_no_total, episode_number: 100)
      expect(discussion).to be_valid
    end

    it 'has_spoilerのデフォルトはfalse' do
      discussion = Discussion.create!(title: 'テスト', body: 'テスト本文', user: user, work: work)
      expect(discussion.has_spoiler).to be false
    end
  end

  describe 'リレーション' do
    it 'userに属する' do
      discussion = Discussion.new(user: user, work: work)
      expect(discussion.user).to eq(user)
    end

    it 'workに属する' do
      discussion = Discussion.new(user: user, work: work)
      expect(discussion.work).to eq(work)
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `docker compose exec backend bundle exec rspec spec/models/discussion_spec.rb`
Expected: FAIL（Discussion クラスが未定義）

- [ ] **Step 3: マイグレーションを作成する**

Run: `docker compose exec backend bin/rails generate migration CreateDiscussions`

マイグレーションファイルを以下の内容にする:

```ruby
class CreateDiscussions < ActiveRecord::Migration[8.0]
  def change
    create_table :discussions do |t|
      t.references :work, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.integer :episode_number
      t.string :title, null: false
      t.text :body, null: false
      t.boolean :has_spoiler, null: false, default: false
      t.integer :comments_count, null: false, default: 0

      t.timestamps
    end

    add_index :discussions, [:work_id, :created_at]
  end
end
```

- [ ] **Step 4: マイグレーションを実行する**

Run: `docker compose exec backend bin/rails db:migrate`
Expected: マイグレーション成功

- [ ] **Step 5: Discussion モデルを作成する**

```ruby
# backend/app/models/discussion.rb
class Discussion < ApplicationRecord
  belongs_to :work
  belongs_to :user
  has_many :comments, dependent: :destroy

  validates :title, presence: true, length: { maximum: 100 }
  validates :body, presence: true, length: { maximum: 5000 }
  validates :episode_number, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validate :episode_number_within_total

  private

  def episode_number_within_total
    return if episode_number.nil?
    return if work.nil?
    return if work.total_episodes.nil?

    if episode_number > work.total_episodes
      errors.add(:episode_number, "は#{work.total_episodes}以下にしてください")
    end
  end
end
```

- [ ] **Step 6: User, Work モデルにリレーションを追加する**

`backend/app/models/user.rb` に追加:
```ruby
has_many :discussions, dependent: :destroy
has_many :comments, dependent: :destroy
```

`backend/app/models/work.rb` に追加:
```ruby
has_many :discussions, dependent: :destroy
```

- [ ] **Step 7: テストを実行してパスを確認する**

Run: `docker compose exec backend bundle exec rspec spec/models/discussion_spec.rb`
Expected: ALL PASS

- [ ] **Step 8: コミットする**

```bash
git add backend/db/migrate/*_create_discussions.rb backend/app/models/discussion.rb backend/app/models/user.rb backend/app/models/work.rb backend/spec/models/discussion_spec.rb backend/db/schema.rb
git commit -m "feat: Discussion モデルとマイグレーションを追加"
```

---

## Task 2: Comment モデル + マイグレーション

**Files:**
- Create: `backend/db/migrate/XXXXXX_create_comments.rb`
- Create: `backend/app/models/comment.rb`
- Test: `backend/spec/models/comment_spec.rb`

- [ ] **Step 1: テストファイルを作成する**

```ruby
# backend/spec/models/comment_spec.rb
require 'rails_helper'

RSpec.describe Comment, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work) { Work.create!(title: 'テスト作品', media_type: :anime) }
  let(:discussion) { Discussion.create!(title: 'テストスレッド', body: 'テスト本文', user: user, work: work) }

  before do
    Record.create!(user: user, work: work, status: :watching)
  end

  describe 'バリデーション' do
    it 'bodyがあれば有効' do
      comment = Comment.new(body: 'テストコメント', user: user, discussion: discussion)
      expect(comment).to be_valid
    end

    it 'bodyが空なら無効' do
      comment = Comment.new(body: '', user: user, discussion: discussion)
      expect(comment).not_to be_valid
    end

    it 'bodyが3000文字を超えると無効' do
      comment = Comment.new(body: 'a' * 3001, user: user, discussion: discussion)
      expect(comment).not_to be_valid
    end
  end

  describe 'カウンターキャッシュ' do
    it 'コメント作成時にdiscussionのcomments_countが増加する' do
      expect {
        Comment.create!(body: 'テスト', user: user, discussion: discussion)
      }.to change { discussion.reload.comments_count }.by(1)
    end

    it 'コメント削除時にdiscussionのcomments_countが減少する' do
      comment = Comment.create!(body: 'テスト', user: user, discussion: discussion)
      expect {
        comment.destroy!
      }.to change { discussion.reload.comments_count }.by(-1)
    end
  end

  describe 'リレーション' do
    it 'discussionに属する' do
      comment = Comment.new(discussion: discussion)
      expect(comment.discussion).to eq(discussion)
    end

    it 'userに属する' do
      comment = Comment.new(user: user)
      expect(comment.user).to eq(user)
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `docker compose exec backend bundle exec rspec spec/models/comment_spec.rb`
Expected: FAIL（Comment クラスが未定義）

- [ ] **Step 3: マイグレーションを作成する**

Run: `docker compose exec backend bin/rails generate migration CreateComments`

```ruby
class CreateComments < ActiveRecord::Migration[8.0]
  def change
    create_table :comments do |t|
      t.references :discussion, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.text :body, null: false

      t.timestamps
    end

    add_index :comments, [:discussion_id, :created_at]
  end
end
```

- [ ] **Step 4: マイグレーションを実行する**

Run: `docker compose exec backend bin/rails db:migrate`
Expected: マイグレーション成功

- [ ] **Step 5: Comment モデルを作成する**

```ruby
# backend/app/models/comment.rb
class Comment < ApplicationRecord
  belongs_to :discussion, counter_cache: true
  belongs_to :user

  validates :body, presence: true, length: { maximum: 3000 }
end
```

- [ ] **Step 6: テストを実行してパスを確認する**

Run: `docker compose exec backend bundle exec rspec spec/models/comment_spec.rb`
Expected: ALL PASS

- [ ] **Step 7: コミットする**

```bash
git add backend/db/migrate/*_create_comments.rb backend/app/models/comment.rb backend/spec/models/comment_spec.rb backend/db/schema.rb
git commit -m "feat: Comment モデルとマイグレーションを追加（counter_cache付き）"
```

---

## Task 3: DiscussionsController — 一覧・詳細 (GET)

**Files:**
- Create: `backend/app/controllers/api/v1/discussions_controller.rb`
- Create: `backend/app/controllers/concerns/discussion_filterable.rb`
- Modify: `backend/config/routes.rb`
- Test: `backend/spec/requests/api/v1/discussions_spec.rb`

- [ ] **Step 1: テストファイルを作成する（一覧・詳細のGETテスト）**

```ruby
# backend/spec/requests/api/v1/discussions_spec.rb
require 'rails_helper'

RSpec.describe 'Api::V1::Discussions', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:anime_work) { Work.create!(title: 'テストアニメ', media_type: :anime, total_episodes: 12) }
  let(:movie_work) { Work.create!(title: 'テスト映画', media_type: :movie) }

  before do
    Record.create!(user: user, work: anime_work, status: :watching)
    Record.create!(user: user, work: movie_work, status: :completed)
  end

  describe 'GET /api/v1/works/:work_id/discussions' do
    before do
      # anime_workに3つのスレッドを作成
      @d1 = Discussion.create!(title: 'スレッド1', body: '本文1', user: user, work: anime_work, episode_number: 1)
      @d2 = Discussion.create!(title: 'スレッド2', body: '本文2', user: user, work: anime_work, episode_number: 5)
      @d3 = Discussion.create!(title: 'スレッド3', body: '本文3', user: user, work: anime_work)
      # movie_workに1つのスレッド
      @d4 = Discussion.create!(title: '映画スレッド', body: '本文4', user: user, work: movie_work)
    end

    it '指定作品のスレッド一覧を返す' do
      get "/api/v1/works/#{anime_work.id}/discussions"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['discussions'].length).to eq(3)
    end

    it 'ログインなしでも取得できる' do
      get "/api/v1/works/#{anime_work.id}/discussions"
      expect(response).to have_http_status(:ok)
    end

    it 'episode_numberでフィルタできる' do
      get "/api/v1/works/#{anime_work.id}/discussions", params: { episode_number: 1 }
      json = response.parsed_body
      expect(json['discussions'].length).to eq(1)
      expect(json['discussions'][0]['title']).to eq('スレッド1')
    end

    it 'デフォルトは新着順（created_at DESC）' do
      get "/api/v1/works/#{anime_work.id}/discussions"
      json = response.parsed_body
      titles = json['discussions'].map { |d| d['title'] }
      expect(titles).to eq(%w[スレッド3 スレッド2 スレッド1])
    end

    it 'ユーザー情報を含む' do
      get "/api/v1/works/#{anime_work.id}/discussions"
      json = response.parsed_body
      discussion = json['discussions'][0]
      expect(discussion['user']['username']).to eq('testuser')
      expect(discussion['user']).to have_key('avatar_url')
    end

    it 'ページネーションが動作する' do
      get "/api/v1/works/#{anime_work.id}/discussions", params: { page: 1, per_page: 2 }
      json = response.parsed_body
      expect(json['discussions'].length).to eq(2)
      expect(json['meta']['current_page']).to eq(1)
      expect(json['meta']['total_pages']).to eq(2)
      expect(json['meta']['total_count']).to eq(3)
    end
  end

  describe 'GET /api/v1/discussions' do
    before do
      @d1 = Discussion.create!(title: 'アニメスレッド', body: '本文', user: user, work: anime_work)
      @d2 = Discussion.create!(title: '映画スレッド', body: '本文', user: user, work: movie_work)
    end

    it '全作品横断のスレッド一覧を返す' do
      get '/api/v1/discussions'
      json = response.parsed_body
      expect(json['discussions'].length).to eq(2)
    end

    it 'media_typeでフィルタできる' do
      get '/api/v1/discussions', params: { media_type: 'anime' }
      json = response.parsed_body
      expect(json['discussions'].length).to eq(1)
      expect(json['discussions'][0]['title']).to eq('アニメスレッド')
    end

    it 'work_idでフィルタできる' do
      get '/api/v1/discussions', params: { work_id: anime_work.id }
      json = response.parsed_body
      expect(json['discussions'].length).to eq(1)
    end

    it 'sort=most_commentsでコメント多い順にソートできる' do
      3.times { Comment.create!(body: 'コメント', user: user, discussion: @d2) }
      get '/api/v1/discussions', params: { sort: 'most_comments' }
      json = response.parsed_body
      expect(json['discussions'][0]['title']).to eq('映画スレッド')
    end

    it '作品情報を含む' do
      get '/api/v1/discussions'
      json = response.parsed_body
      discussion = json['discussions'][0]
      expect(discussion['work']).to have_key('title')
      expect(discussion['work']).to have_key('media_type')
      expect(discussion['work']).to have_key('cover_image_url')
    end
  end

  describe 'GET /api/v1/discussions/:id' do
    let!(:discussion) { Discussion.create!(title: 'テスト', body: 'テスト本文', user: user, work: anime_work, episode_number: 5, has_spoiler: true) }

    it 'スレッド詳細を返す' do
      get "/api/v1/discussions/#{discussion.id}"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['discussion']['title']).to eq('テスト')
      expect(json['discussion']['body']).to eq('テスト本文')
      expect(json['discussion']['episode_number']).to eq(5)
      expect(json['discussion']['has_spoiler']).to be true
      expect(json['discussion']['user']['username']).to eq('testuser')
      expect(json['discussion']['work']['title']).to eq('テストアニメ')
    end

    it '存在しないIDで404を返す' do
      get '/api/v1/discussions/99999'
      expect(response).to have_http_status(:not_found)
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/discussions_spec.rb`
Expected: FAIL（ルーティングエラー）

- [ ] **Step 3: ルーティングを追加する**

`backend/config/routes.rb` に追加（既存の `namespace :api do namespace :v1 do` ブロック内）:

```ruby
resources :works do
  resources :discussions, only: [:index, :create]
end
resources :discussions, only: [:index, :show, :update, :destroy] do
  resources :comments, only: [:index, :create]
end
resources :comments, only: [:update, :destroy]
resources :users, only: [:show] do
  resources :records, only: [:index], controller: 'user_records'
end
```

注意: 既存の `resources :works` がある場合は、そこに `discussions` をネストする形で統合すること。

- [ ] **Step 4: DiscussionFilterable Concern を作成する**

```ruby
# backend/app/controllers/concerns/discussion_filterable.rb
module DiscussionFilterable
  extend ActiveSupport::Concern

  private

  def apply_discussion_filters(discussions)
    discussions = filter_by_episode_number(discussions)
    discussions = filter_by_media_type(discussions)
    filter_by_work_id(discussions)
  end

  def filter_by_episode_number(discussions)
    return discussions if params[:episode_number].blank?

    discussions.where(episode_number: params[:episode_number])
  end

  def filter_by_media_type(discussions)
    return discussions if params[:media_type].blank?

    discussions.joins(:work).where(works: { media_type: params[:media_type] })
  end

  def filter_by_work_id(discussions)
    return discussions if params[:work_id].blank?

    discussions.where(work_id: params[:work_id])
  end

  def apply_discussion_sort(discussions)
    case params[:sort]
    when 'most_comments'
      discussions.order(comments_count: :desc, created_at: :desc)
    else
      discussions.order(created_at: :desc)
    end
  end
end
```

- [ ] **Step 5: DiscussionsController を作成する（一覧・詳細のみ）**

```ruby
# backend/app/controllers/api/v1/discussions_controller.rb
class Api::V1::DiscussionsController < ApplicationController
  include DiscussionFilterable

  before_action :set_discussion, only: [:show]

  # GET /api/v1/works/:work_id/discussions
  # GET /api/v1/discussions
  def index
    discussions = if params[:work_id].present?
                    Discussion.where(work_id: params[:work_id])
                  else
                    Discussion.all
                  end

    discussions = discussions.includes(:user, work: :images)
    discussions = apply_discussion_filters(discussions)
    discussions = apply_discussion_sort(discussions)

    page = [params.fetch(:page, 1).to_i, 1].max
    per_page = params.fetch(:per_page, 20).to_i.clamp(1, 100)
    total_count = discussions.count
    total_pages = (total_count.to_f / per_page).ceil
    paginated = discussions.offset((page - 1) * per_page).limit(per_page)

    render json: {
      discussions: paginated.map { |d| discussion_list_json(d) },
      meta: { current_page: page, total_pages: [total_pages, 1].max, total_count: total_count, per_page: per_page }
    }
  end

  # GET /api/v1/discussions/:id
  def show
    render json: { discussion: discussion_detail_json(@discussion) }
  end

  private

  def set_discussion
    @discussion = Discussion.includes(:user, work: :images).find(params[:id])
  end

  def discussion_list_json(discussion)
    {
      id: discussion.id,
      title: discussion.title,
      body: discussion.body.truncate(200),
      episode_number: discussion.episode_number,
      has_spoiler: discussion.has_spoiler,
      comments_count: discussion.comments_count,
      created_at: discussion.created_at,
      updated_at: discussion.updated_at,
      user: user_summary_json(discussion.user),
      work: work_summary_json(discussion.work)
    }
  end

  def discussion_detail_json(discussion)
    {
      id: discussion.id,
      title: discussion.title,
      body: discussion.body,
      episode_number: discussion.episode_number,
      has_spoiler: discussion.has_spoiler,
      comments_count: discussion.comments_count,
      created_at: discussion.created_at,
      updated_at: discussion.updated_at,
      user: user_summary_json(discussion.user),
      work: work_summary_json(discussion.work)
    }
  end

  def user_summary_json(user)
    { id: user.id, username: user.username, avatar_url: user.avatar_url }
  end

  def work_summary_json(work)
    { id: work.id, title: work.title, media_type: work.media_type, total_episodes: work.total_episodes, cover_image_url: work.resolved_cover_image_url }
  end
end
```

- [ ] **Step 6: テストを実行してパスを確認する**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/discussions_spec.rb`
Expected: ALL PASS

- [ ] **Step 7: コミットする**

```bash
git add backend/config/routes.rb backend/app/controllers/api/v1/discussions_controller.rb backend/app/controllers/concerns/discussion_filterable.rb backend/spec/requests/api/v1/discussions_spec.rb
git commit -m "feat: Discussions API の一覧・詳細エンドポイントを追加"
```

---

## Task 4: DiscussionsController — 作成 (POST)

**Files:**
- Modify: `backend/app/controllers/api/v1/discussions_controller.rb`
- Test: `backend/spec/requests/api/v1/discussions_spec.rb`（追記）

- [ ] **Step 1: 作成テストを追記する**

`backend/spec/requests/api/v1/discussions_spec.rb` に追記:

```ruby
describe 'POST /api/v1/works/:work_id/discussions' do
  context '認証済み + 記録済みユーザー' do
    before { sign_in user }

    it 'スレッドを作成できる' do
      post "/api/v1/works/#{anime_work.id}/discussions",
           params: { discussion: { title: '新スレッド', body: 'テスト本文', episode_number: 3, has_spoiler: true } },
           as: :json
      expect(response).to have_http_status(:created)
      json = response.parsed_body
      expect(json['discussion']['title']).to eq('新スレッド')
      expect(json['discussion']['episode_number']).to eq(3)
      expect(json['discussion']['has_spoiler']).to be true
    end

    it 'episode_numberなし（作品全体のスレッド）で作成できる' do
      post "/api/v1/works/#{anime_work.id}/discussions",
           params: { discussion: { title: '全体スレッド', body: 'テスト本文' } },
           as: :json
      expect(response).to have_http_status(:created)
      json = response.parsed_body
      expect(json['discussion']['episode_number']).to be_nil
    end

    it 'バリデーションエラーで422を返す' do
      post "/api/v1/works/#{anime_work.id}/discussions",
           params: { discussion: { title: '', body: '' } },
           as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  context '認証済みだが未記録ユーザー' do
    let(:other_user) { User.create!(username: 'otheruser', email: 'other@example.com', password: 'password123') }

    before { sign_in other_user }

    it '記録していない作品には403を返す' do
      post "/api/v1/works/#{anime_work.id}/discussions",
           params: { discussion: { title: 'テスト', body: 'テスト' } },
           as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end

  context '未認証' do
    it '401を返す' do
      post "/api/v1/works/#{anime_work.id}/discussions",
           params: { discussion: { title: 'テスト', body: 'テスト' } },
           as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/discussions_spec.rb`
Expected: 新しいテストが FAIL

- [ ] **Step 3: create アクションを実装する**

`backend/app/controllers/api/v1/discussions_controller.rb` に追加:

```ruby
# before_action 行を更新
before_action :authenticate_user!, only: [:create, :update, :destroy]
before_action :set_discussion, only: [:show, :update, :destroy]
before_action :authorize_record_owner!, only: [:create]

# POST /api/v1/works/:work_id/discussions
def create
  discussion = current_user.discussions.build(discussion_params)
  discussion.work_id = params[:work_id]

  if discussion.save
    render json: { discussion: discussion_detail_json(discussion) }, status: :created
  else
    render json: { errors: discussion.errors.full_messages }, status: :unprocessable_entity
  end
end

private

def authorize_record_owner!
  work_id = params[:work_id] || @discussion&.work_id
  unless current_user.records.exists?(work_id: work_id)
    render json: { error: 'この作品を記録していないため投稿できません' }, status: :forbidden
  end
end

def discussion_params
  params.expect(discussion: [:title, :body, :episode_number, :has_spoiler])
end
```

- [ ] **Step 4: テストを実行してパスを確認する**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/discussions_spec.rb`
Expected: ALL PASS

- [ ] **Step 5: コミットする**

```bash
git add backend/app/controllers/api/v1/discussions_controller.rb backend/spec/requests/api/v1/discussions_spec.rb
git commit -m "feat: Discussions API の作成エンドポイントを追加（記録済みユーザー認可付き）"
```

---

## Task 5: DiscussionsController — 編集・削除 (PATCH/DELETE)

**Files:**
- Modify: `backend/app/controllers/api/v1/discussions_controller.rb`
- Test: `backend/spec/requests/api/v1/discussions_spec.rb`（追記）

- [ ] **Step 1: 編集・削除テストを追記する**

```ruby
describe 'PATCH /api/v1/discussions/:id' do
  let!(:discussion) { Discussion.create!(title: 'テスト', body: 'テスト本文', user: user, work: anime_work) }

  context '投稿者本人' do
    before { sign_in user }

    it 'スレッドを編集できる' do
      patch "/api/v1/discussions/#{discussion.id}",
            params: { discussion: { title: '更新タイトル', body: '更新本文' } },
            as: :json
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['discussion']['title']).to eq('更新タイトル')
    end
  end

  context '投稿者以外' do
    let(:other_user) { User.create!(username: 'other', email: 'other@example.com', password: 'password123') }
    before { sign_in other_user }

    it '403を返す' do
      patch "/api/v1/discussions/#{discussion.id}",
            params: { discussion: { title: '不正な更新' } },
            as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end
end

describe 'DELETE /api/v1/discussions/:id' do
  let!(:discussion) { Discussion.create!(title: 'テスト', body: 'テスト本文', user: user, work: anime_work) }

  context '投稿者本人' do
    before { sign_in user }

    it 'スレッドを削除できる' do
      expect {
        delete "/api/v1/discussions/#{discussion.id}"
      }.to change(Discussion, :count).by(-1)
      expect(response).to have_http_status(:no_content)
    end
  end

  context '投稿者以外' do
    let(:other_user) { User.create!(username: 'other', email: 'other@example.com', password: 'password123') }
    before { sign_in other_user }

    it '403を返す' do
      delete "/api/v1/discussions/#{discussion.id}"
      expect(response).to have_http_status(:forbidden)
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/discussions_spec.rb`
Expected: 新しいテストが FAIL

- [ ] **Step 3: update, destroy アクションを実装する**

```ruby
before_action :authorize_discussion_author!, only: [:update, :destroy]

# PATCH /api/v1/discussions/:id
def update
  if @discussion.update(discussion_params)
    render json: { discussion: discussion_detail_json(@discussion) }
  else
    render json: { errors: @discussion.errors.full_messages }, status: :unprocessable_entity
  end
end

# DELETE /api/v1/discussions/:id
def destroy
  @discussion.destroy!
  head :no_content
end

private

def authorize_discussion_author!
  unless @discussion.user_id == current_user.id
    render json: { error: '編集権限がありません' }, status: :forbidden
  end
end
```

- [ ] **Step 4: テストを実行してパスを確認する**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/discussions_spec.rb`
Expected: ALL PASS

- [ ] **Step 5: コミットする**

```bash
git add backend/app/controllers/api/v1/discussions_controller.rb backend/spec/requests/api/v1/discussions_spec.rb
git commit -m "feat: Discussions API の編集・削除エンドポイントを追加（投稿者認可付き）"
```

---

## Task 6: CommentsController — 一覧・作成 (GET/POST)

**Files:**
- Create: `backend/app/controllers/api/v1/comments_controller.rb`
- Test: `backend/spec/requests/api/v1/comments_spec.rb`

- [ ] **Step 1: テストファイルを作成する**

```ruby
# backend/spec/requests/api/v1/comments_spec.rb
require 'rails_helper'

RSpec.describe 'Api::V1::Comments', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work) { Work.create!(title: 'テスト作品', media_type: :anime) }
  let!(:record) { Record.create!(user: user, work: work, status: :watching) }
  let(:discussion) { Discussion.create!(title: 'テストスレッド', body: 'テスト本文', user: user, work: work) }

  describe 'GET /api/v1/discussions/:discussion_id/comments' do
    before do
      @c1 = Comment.create!(body: 'コメント1', user: user, discussion: discussion)
      @c2 = Comment.create!(body: 'コメント2', user: user, discussion: discussion)
    end

    it 'コメント一覧を古い順で返す' do
      get "/api/v1/discussions/#{discussion.id}/comments"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['comments'].length).to eq(2)
      expect(json['comments'][0]['body']).to eq('コメント1')
      expect(json['comments'][1]['body']).to eq('コメント2')
    end

    it 'ログインなしでも取得できる' do
      get "/api/v1/discussions/#{discussion.id}/comments"
      expect(response).to have_http_status(:ok)
    end

    it 'ユーザー情報を含む' do
      get "/api/v1/discussions/#{discussion.id}/comments"
      json = response.parsed_body
      expect(json['comments'][0]['user']['username']).to eq('testuser')
    end

    it '編集済みフラグが正しく返る' do
      @c1.update!(body: '編集後コメント')
      get "/api/v1/discussions/#{discussion.id}/comments"
      json = response.parsed_body
      expect(json['comments'][0]['edited']).to be true
      expect(json['comments'][1]['edited']).to be false
    end

    it 'ページネーションが動作する' do
      get "/api/v1/discussions/#{discussion.id}/comments", params: { page: 1, per_page: 1 }
      json = response.parsed_body
      expect(json['comments'].length).to eq(1)
      expect(json['meta']['total_count']).to eq(2)
    end
  end

  describe 'POST /api/v1/discussions/:discussion_id/comments' do
    context '認証済み + 記録済みユーザー' do
      before { sign_in user }

      it 'コメントを投稿できる' do
        post "/api/v1/discussions/#{discussion.id}/comments",
             params: { comment: { body: '新しいコメント' } },
             as: :json
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['comment']['body']).to eq('新しいコメント')
      end

      it 'discussion の comments_count が増加する' do
        expect {
          post "/api/v1/discussions/#{discussion.id}/comments",
               params: { comment: { body: 'テスト' } },
               as: :json
        }.to change { discussion.reload.comments_count }.by(1)
      end
    end

    context '認証済みだが未記録ユーザー' do
      let(:other_user) { User.create!(username: 'other', email: 'other@example.com', password: 'password123') }
      before { sign_in other_user }

      it '403を返す' do
        post "/api/v1/discussions/#{discussion.id}/comments",
             params: { comment: { body: 'テスト' } },
             as: :json
        expect(response).to have_http_status(:forbidden)
      end
    end

    context '未認証' do
      it '401を返す' do
        post "/api/v1/discussions/#{discussion.id}/comments",
             params: { comment: { body: 'テスト' } },
             as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/comments_spec.rb`
Expected: FAIL

- [ ] **Step 3: CommentsController を作成する**

```ruby
# backend/app/controllers/api/v1/comments_controller.rb
class Api::V1::CommentsController < ApplicationController
  before_action :authenticate_user!, only: [:create, :update, :destroy]
  before_action :set_discussion, only: [:index, :create]
  before_action :set_comment, only: [:update, :destroy]
  before_action :authorize_record_owner_for_comment!, only: [:create]
  before_action :authorize_comment_author!, only: [:update, :destroy]

  # GET /api/v1/discussions/:discussion_id/comments
  def index
    comments = @discussion.comments.includes(:user).order(created_at: :asc)

    page = [params.fetch(:page, 1).to_i, 1].max
    per_page = params.fetch(:per_page, 20).to_i.clamp(1, 100)
    total_count = comments.count
    total_pages = (total_count.to_f / per_page).ceil
    paginated = comments.offset((page - 1) * per_page).limit(per_page)

    render json: {
      comments: paginated.map { |c| comment_json(c) },
      meta: { current_page: page, total_pages: [total_pages, 1].max, total_count: total_count, per_page: per_page }
    }
  end

  # POST /api/v1/discussions/:discussion_id/comments
  def create
    comment = @discussion.comments.build(comment_params)
    comment.user = current_user

    if comment.save
      render json: { comment: comment_json(comment) }, status: :created
    else
      render json: { errors: comment.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/comments/:id
  def update
    if @comment.update(comment_params)
      render json: { comment: comment_json(@comment) }
    else
      render json: { errors: @comment.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/comments/:id
  def destroy
    @comment.destroy!
    head :no_content
  end

  private

  def set_discussion
    @discussion = Discussion.find(params[:discussion_id])
  end

  def set_comment
    @comment = Comment.find(params[:id])
  end

  def authorize_record_owner_for_comment!
    work_id = @discussion.work_id
    unless current_user.records.exists?(work_id: work_id)
      render json: { error: 'この作品を記録していないためコメントできません' }, status: :forbidden
    end
  end

  def authorize_comment_author!
    unless @comment.user_id == current_user.id
      render json: { error: '編集権限がありません' }, status: :forbidden
    end
  end

  def comment_params
    params.expect(comment: [:body])
  end

  def comment_json(comment)
    {
      id: comment.id,
      body: comment.body,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      edited: comment.created_at != comment.updated_at,
      user: { id: comment.user.id, username: comment.user.username, avatar_url: comment.user.avatar_url }
    }
  end
end
```

- [ ] **Step 4: テストを実行してパスを確認する**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/comments_spec.rb`
Expected: ALL PASS

- [ ] **Step 5: コミットする**

```bash
git add backend/app/controllers/api/v1/comments_controller.rb backend/spec/requests/api/v1/comments_spec.rb
git commit -m "feat: Comments API の一覧・作成エンドポイントを追加"
```

---

## Task 7: CommentsController — 編集・削除 (PATCH/DELETE)

**Files:**
- Test: `backend/spec/requests/api/v1/comments_spec.rb`（追記）

- [ ] **Step 1: 編集・削除テストを追記する**

```ruby
describe 'PATCH /api/v1/comments/:id' do
  let!(:comment) { Comment.create!(body: '元のコメント', user: user, discussion: discussion) }

  context '投稿者本人' do
    before { sign_in user }

    it 'コメントを編集できる' do
      patch "/api/v1/comments/#{comment.id}",
            params: { comment: { body: '編集後のコメント' } },
            as: :json
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['comment']['body']).to eq('編集後のコメント')
      expect(json['comment']['edited']).to be true
    end
  end

  context '投稿者以外' do
    let(:other_user) { User.create!(username: 'other', email: 'other@example.com', password: 'password123') }
    before { sign_in other_user }

    it '403を返す' do
      patch "/api/v1/comments/#{comment.id}",
            params: { comment: { body: '不正な編集' } },
            as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end
end

describe 'DELETE /api/v1/comments/:id' do
  let!(:comment) { Comment.create!(body: 'テスト', user: user, discussion: discussion) }

  context '投稿者本人' do
    before { sign_in user }

    it 'コメントを削除できる' do
      expect {
        delete "/api/v1/comments/#{comment.id}"
      }.to change(Comment, :count).by(-1)
      expect(response).to have_http_status(:no_content)
    end

    it 'discussion の comments_count が減少する' do
      expect {
        delete "/api/v1/comments/#{comment.id}"
      }.to change { discussion.reload.comments_count }.by(-1)
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/comments_spec.rb`
Expected: 新しいテストが FAIL（update/destroy が既に実装されていれば PASS する可能性あり。その場合は Step 3 をスキップ）

- [ ] **Step 3: update/destroy が未実装なら実装する（Task 6 で既に含まれている場合はスキップ）**

Task 6 の CommentsController に update/destroy が含まれているため、テストがパスすることを確認する。

- [ ] **Step 4: テストを実行してパスを確認する**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/comments_spec.rb`
Expected: ALL PASS

- [ ] **Step 5: コミットする**

```bash
git add backend/spec/requests/api/v1/comments_spec.rb
git commit -m "test: Comments API の編集・削除テストを追加"
```

---

## Task 8: ProfilesController + UserRecordsController

**Files:**
- Create: `backend/app/controllers/api/v1/profiles_controller.rb`
- Create: `backend/app/controllers/api/v1/user_records_controller.rb`
- Test: `backend/spec/requests/api/v1/profiles_spec.rb`
- Test: `backend/spec/requests/api/v1/user_records_spec.rb`

- [ ] **Step 1: Profiles テストを作成する**

```ruby
# backend/spec/requests/api/v1/profiles_spec.rb
require 'rails_helper'

RSpec.describe 'Api::V1::Profiles', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123', bio: 'テスト自己紹介') }
  let(:anime_work) { Work.create!(title: 'テストアニメ', media_type: :anime) }
  let(:movie_work) { Work.create!(title: 'テスト映画', media_type: :movie) }

  before do
    Record.create!(user: user, work: anime_work, status: :completed, rating: 8)
    Record.create!(user: user, work: movie_work, status: :watching, rating: 7)
  end

  describe 'GET /api/v1/users/:id' do
    it 'ユーザープロフィールと統計を返す' do
      get "/api/v1/users/#{user.id}"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['user']['username']).to eq('testuser')
      expect(json['user']['bio']).to eq('テスト自己紹介')
      expect(json['statistics']['total_records']).to eq(2)
      expect(json['statistics']['completed_count']).to eq(1)
      expect(json['statistics']['watching_count']).to eq(1)
      expect(json['statistics']['average_rating']).to eq(7.5)
      expect(json['statistics']['by_genre']).to have_key('anime')
    end

    it 'ログインなしでも取得できる' do
      get "/api/v1/users/#{user.id}"
      expect(response).to have_http_status(:ok)
    end

    it '存在しないユーザーで404を返す' do
      get '/api/v1/users/99999'
      expect(response).to have_http_status(:not_found)
    end
  end
end
```

- [ ] **Step 2: UserRecords テストを作成する**

```ruby
# backend/spec/requests/api/v1/user_records_spec.rb
require 'rails_helper'

RSpec.describe 'Api::V1::UserRecords', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work1) { Work.create!(title: '公開作品', media_type: :anime) }
  let(:work2) { Work.create!(title: '非公開作品', media_type: :movie) }

  before do
    Record.create!(user: user, work: work1, status: :completed, rating: 9, visibility: :public_record)
    Record.create!(user: user, work: work2, status: :watching, rating: 7, visibility: :private_record)
  end

  describe 'GET /api/v1/users/:user_id/records' do
    it '公開記録のみ返す' do
      get "/api/v1/users/#{user.id}/records"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['records'].length).to eq(1)
      expect(json['records'][0]['work']['title']).to eq('公開作品')
    end

    it '非公開記録は含まない' do
      get "/api/v1/users/#{user.id}/records"
      json = response.parsed_body
      titles = json['records'].map { |r| r['work']['title'] }
      expect(titles).not_to include('非公開作品')
    end

    it 'ログインなしでも取得できる' do
      get "/api/v1/users/#{user.id}/records"
      expect(response).to have_http_status(:ok)
    end

    it 'media_typeでフィルタできる' do
      get "/api/v1/users/#{user.id}/records", params: { media_type: 'anime' }
      json = response.parsed_body
      expect(json['records'].length).to eq(1)
    end

    it 'ページネーションが動作する' do
      get "/api/v1/users/#{user.id}/records", params: { page: 1, per_page: 1 }
      json = response.parsed_body
      expect(json['meta']['total_count']).to eq(1)
    end
  end
end
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/profiles_spec.rb spec/requests/api/v1/user_records_spec.rb`
Expected: FAIL

- [ ] **Step 4: ProfilesController を作成する**

```ruby
# backend/app/controllers/api/v1/profiles_controller.rb
class Api::V1::ProfilesController < ApplicationController
  # GET /api/v1/users/:id
  def show
    user = User.find(params[:id])
    records = user.records.includes(:work)

    render json: {
      user: {
        id: user.id,
        username: user.username,
        bio: user.bio,
        avatar_url: user.avatar_url,
        created_at: user.created_at
      },
      statistics: build_statistics(records)
    }
  end

  private

  def build_statistics(records)
    {
      total_records: records.count,
      completed_count: records.where(status: :completed).count,
      watching_count: records.where(status: :watching).count,
      average_rating: records.where.not(rating: nil).average(:rating)&.round(1)&.to_f,
      by_genre: count_by_genre(records),
      by_status: count_by_status(records)
    }
  end

  def count_by_genre(records)
    records.joins(:work).group('works.media_type').count.transform_keys { |k| Work.media_types.key(k) }
  end

  def count_by_status(records)
    records.group(:status).count.transform_keys { |k| Record.statuses.key(k) }
  end
end
```

- [ ] **Step 5: UserRecordsController を作成する**

```ruby
# backend/app/controllers/api/v1/user_records_controller.rb
class Api::V1::UserRecordsController < ApplicationController
  # GET /api/v1/users/:user_id/records
  def index
    user = User.find(params[:user_id])
    records = user.records.where(visibility: :public_record).includes(work: :images)
    records = filter_by_media_type(records)
    records = apply_sort(records)

    page = [params.fetch(:page, 1).to_i, 1].max
    per_page = params.fetch(:per_page, 20).to_i.clamp(1, 100)
    total_count = records.count
    total_pages = (total_count.to_f / per_page).ceil
    paginated = records.offset((page - 1) * per_page).limit(per_page)

    render json: {
      records: paginated.map { |r| record_json(r) },
      meta: { current_page: page, total_pages: [total_pages, 1].max, total_count: total_count, per_page: per_page }
    }
  end

  private

  def filter_by_media_type(records)
    return records if params[:media_type].blank?

    records.joins(:work).where(works: { media_type: params[:media_type] })
  end

  def apply_sort(records)
    case params[:sort]
    when 'rating'
      records.order(rating: :desc)
    when 'title'
      records.joins(:work).order('works.title ASC')
    else
      records.order(updated_at: :desc)
    end
  end

  def record_json(record)
    {
      id: record.id,
      status: record.status,
      rating: record.rating,
      current_episode: record.current_episode,
      updated_at: record.updated_at,
      work: {
        id: record.work.id,
        title: record.work.title,
        media_type: record.work.media_type,
        total_episodes: record.work.total_episodes,
        cover_image_url: record.work.resolved_cover_image_url
      }
    }
  end
end
```

- [ ] **Step 6: ルーティングを確認する**

`backend/config/routes.rb` に Task 3 で追加済みの `resources :users` ルートを確認。`controller: 'profiles'` を指定する:

```ruby
resources :users, only: [:show], controller: 'profiles' do
  resources :records, only: [:index], controller: 'user_records'
end
```

- [ ] **Step 7: テストを実行してパスを確認する**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/profiles_spec.rb spec/requests/api/v1/user_records_spec.rb`
Expected: ALL PASS

- [ ] **Step 8: 全バックエンドテストを実行する**

Run: `docker compose exec backend bundle exec rspec`
Expected: ALL PASS（既存テストが壊れていないことを確認）

- [ ] **Step 9: RuboCop を実行する**

Run: `docker compose exec backend bundle exec rubocop`
Expected: No offenses（違反があれば修正）

- [ ] **Step 10: コミットする**

```bash
git add backend/app/controllers/api/v1/profiles_controller.rb backend/app/controllers/api/v1/user_records_controller.rb backend/spec/requests/api/v1/profiles_spec.rb backend/spec/requests/api/v1/user_records_spec.rb backend/config/routes.rb
git commit -m "feat: ユーザープロフィール・公開記録APIを追加"
```

---

## Task 9: フロントエンド — 型定義 + API レイヤー

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/discussionsApi.ts`
- Create: `frontend/src/lib/commentsApi.ts`
- Create: `frontend/src/lib/usersApi.ts`
- Create: `frontend/src/lib/timeUtils.ts`

- [ ] **Step 1: 型定義を追加する**

`frontend/src/lib/types.ts` に追加:

```typescript
// --- フェーズ3: コミュニティ機能 ---

export interface UserSummary {
  id: number
  username: string
  avatar_url: string | null
}

export interface WorkSummary {
  id: number
  title: string
  media_type: MediaType
  total_episodes: number | null
  cover_image_url: string | null
}

export interface Discussion {
  id: number
  title: string
  body: string
  episode_number: number | null
  has_spoiler: boolean
  comments_count: number
  created_at: string
  updated_at: string
  user: UserSummary
  work: WorkSummary
}

export interface DiscussionsResponse {
  discussions: Discussion[]
  meta: PaginationMeta
}

export interface DiscussionResponse {
  discussion: Discussion
}

export interface Comment {
  id: number
  body: string
  created_at: string
  updated_at: string
  edited: boolean
  user: UserSummary
}

export interface CommentsResponse {
  comments: Comment[]
  meta: PaginationMeta
}

export interface CommentResponse {
  comment: Comment
}

export interface UserProfile {
  id: number
  username: string
  bio: string | null
  avatar_url: string | null
  created_at: string
}

export interface UserStatistics {
  total_records: number
  completed_count: number
  watching_count: number
  average_rating: number | null
  by_genre: Record<string, number>
  by_status: Record<string, number>
}

export interface UserProfileResponse {
  user: UserProfile
  statistics: UserStatistics
}

export interface PublicRecord {
  id: number
  status: RecordStatus
  rating: number | null
  current_episode: number
  updated_at: string
  work: WorkSummary
}

export interface PublicRecordsResponse {
  records: PublicRecord[]
  meta: PaginationMeta
}
```

- [ ] **Step 2: discussionsApi.ts を作成する**

```typescript
// frontend/src/lib/discussionsApi.ts
import type { DiscussionResponse, DiscussionsResponse } from './types'
import { request } from './api'

type DiscussionFilterParams = {
  workId?: number
  episodeNumber?: number
  mediaType?: string
  sort?: string
  page?: number
  perPage?: number
}

type CreateDiscussionParams = {
  title: string
  body: string
  episode_number?: number | null
  has_spoiler?: boolean
}

type UpdateDiscussionParams = {
  title?: string
  body?: string
  episode_number?: number | null
  has_spoiler?: boolean
}

export const discussionsApi = {
  getByWork(workId: number, filters?: DiscussionFilterParams): Promise<DiscussionsResponse> {
    const params = new URLSearchParams()
    if (filters?.episodeNumber) params.set('episode_number', String(filters.episodeNumber))
    if (filters?.sort) params.set('sort', filters.sort)
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.perPage) params.set('per_page', String(filters.perPage))
    const query = params.toString()
    return request<DiscussionsResponse>(`/works/${workId}/discussions${query ? `?${query}` : ''}`)
  },

  getAll(filters?: DiscussionFilterParams): Promise<DiscussionsResponse> {
    const params = new URLSearchParams()
    if (filters?.workId) params.set('work_id', String(filters.workId))
    if (filters?.mediaType) params.set('media_type', filters.mediaType)
    if (filters?.sort) params.set('sort', filters.sort)
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.perPage) params.set('per_page', String(filters.perPage))
    const query = params.toString()
    return request<DiscussionsResponse>(`/discussions${query ? `?${query}` : ''}`)
  },

  getById(id: number): Promise<DiscussionResponse> {
    return request<DiscussionResponse>(`/discussions/${id}`)
  },

  create(workId: number, params: CreateDiscussionParams): Promise<DiscussionResponse> {
    return request<DiscussionResponse>(`/works/${workId}/discussions`, {
      method: 'POST',
      body: JSON.stringify({ discussion: params }),
    })
  },

  update(id: number, params: UpdateDiscussionParams): Promise<DiscussionResponse> {
    return request<DiscussionResponse>(`/discussions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ discussion: params }),
    })
  },

  delete(id: number): Promise<void> {
    return request<void>(`/discussions/${id}`, { method: 'DELETE' })
  },
}
```

- [ ] **Step 3: commentsApi.ts を作成する**

```typescript
// frontend/src/lib/commentsApi.ts
import type { CommentResponse, CommentsResponse } from './types'
import { request } from './api'

export const commentsApi = {
  getAll(discussionId: number, page?: number): Promise<CommentsResponse> {
    const params = new URLSearchParams()
    if (page) params.set('page', String(page))
    const query = params.toString()
    return request<CommentsResponse>(`/discussions/${discussionId}/comments${query ? `?${query}` : ''}`)
  },

  create(discussionId: number, body: string): Promise<CommentResponse> {
    return request<CommentResponse>(`/discussions/${discussionId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment: { body } }),
    })
  },

  update(id: number, body: string): Promise<CommentResponse> {
    return request<CommentResponse>(`/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ comment: { body } }),
    })
  },

  delete(id: number): Promise<void> {
    return request<void>(`/comments/${id}`, { method: 'DELETE' })
  },
}
```

- [ ] **Step 4: usersApi.ts を作成する**

```typescript
// frontend/src/lib/usersApi.ts
import type { PublicRecordsResponse, UserProfileResponse } from './types'
import { request } from './api'

type UserRecordFilterParams = {
  mediaType?: string
  sort?: string
  page?: number
  perPage?: number
}

export const usersApi = {
  getProfile(userId: number): Promise<UserProfileResponse> {
    return request<UserProfileResponse>(`/users/${userId}`)
  },

  getRecords(userId: number, filters?: UserRecordFilterParams): Promise<PublicRecordsResponse> {
    const params = new URLSearchParams()
    if (filters?.mediaType) params.set('media_type', filters.mediaType)
    if (filters?.sort) params.set('sort', filters.sort)
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.perPage) params.set('per_page', String(filters.perPage))
    const query = params.toString()
    return request<PublicRecordsResponse>(`/users/${userId}/records${query ? `?${query}` : ''}`)
  },
}
```

- [ ] **Step 5: mediaTypeUtils.ts に getMediaTypeLabel を追加する**

`frontend/src/lib/mediaTypeUtils.ts` に以下を追加（既存ファイル内に追記）:

```typescript
const MEDIA_TYPE_LABELS: Record<string, string> = {
  anime: 'アニメ',
  movie: '映画',
  drama: 'ドラマ',
  book: '本',
  manga: '漫画',
  game: 'ゲーム',
}

export function getMediaTypeLabel(mediaType: string): string {
  return MEDIA_TYPE_LABELS[mediaType] ?? mediaType
}
```

- [ ] **Step 6: timeUtils.ts を作成する**

```typescript
// frontend/src/lib/timeUtils.ts

/**
 * ISO日時文字列を「2時間前」「3日前」等の相対表記に変換する
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'たった今'
  if (diffMinutes < 60) return `${diffMinutes}分前`
  if (diffHours < 24) return `${diffHours}時間前`
  if (diffDays < 30) return `${diffDays}日前`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}ヶ月前`
  return `${Math.floor(diffDays / 365)}年前`
}
```

- [ ] **Step 7: ESLint + Prettier を実行する**

Run: `docker compose exec frontend npx eslint src/lib/discussionsApi.ts src/lib/commentsApi.ts src/lib/usersApi.ts src/lib/timeUtils.ts src/lib/types.ts src/lib/mediaTypeUtils.ts`
Expected: No errors

- [ ] **Step 8: コミットする**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/discussionsApi.ts frontend/src/lib/commentsApi.ts frontend/src/lib/usersApi.ts frontend/src/lib/timeUtils.ts frontend/src/lib/mediaTypeUtils.ts
git commit -m "feat: フェーズ3用の型定義・APIクライアント・ユーティリティを追加"
```

---

## Task 10: フロントエンド — コミュニティページ

**Files:**
- Create: `frontend/src/hooks/useDiscussions.ts`
- Create: `frontend/src/components/DiscussionCard/DiscussionCard.tsx`
- Create: `frontend/src/components/DiscussionCard/DiscussionCard.module.css`
- Create: `frontend/src/components/ui/SpoilerBadge/SpoilerBadge.tsx`
- Create: `frontend/src/components/ui/SpoilerBadge/SpoilerBadge.module.css`
- Create: `frontend/src/components/ui/EpisodeBadge/EpisodeBadge.tsx`
- Create: `frontend/src/components/ui/EpisodeBadge/EpisodeBadge.module.css`
- Create: `frontend/src/pages/CommunityPage/CommunityPage.tsx`
- Create: `frontend/src/pages/CommunityPage/CommunityPage.module.css`

- [ ] **Step 1: SpoilerBadge を作成する**

```typescript
// frontend/src/components/ui/SpoilerBadge/SpoilerBadge.tsx
import styles from './SpoilerBadge.module.css'

export function SpoilerBadge() {
  return <span className={styles.badge}>⚠ ネタバレ</span>
}
```

```css
/* frontend/src/components/ui/SpoilerBadge/SpoilerBadge.module.css */
.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-error-bg, #fef2f2);
  color: var(--color-error, #dc2626);
  white-space: nowrap;
}
```

- [ ] **Step 2: EpisodeBadge を作成する**

```typescript
// frontend/src/components/ui/EpisodeBadge/EpisodeBadge.tsx
import styles from './EpisodeBadge.module.css'

type EpisodeBadgeProps = {
  episodeNumber: number | null
}

export function EpisodeBadge({ episodeNumber }: EpisodeBadgeProps) {
  if (episodeNumber === null) {
    return <span className={styles.badge}>作品全体</span>
  }
  return <span className={styles.badge}>第{episodeNumber}話</span>
}
```

```css
/* frontend/src/components/ui/EpisodeBadge/EpisodeBadge.module.css */
.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-surface, #f3f4f6);
  color: var(--color-text-muted, #666);
  white-space: nowrap;
}
```

- [ ] **Step 3: useDiscussions フックを作成する**

```typescript
// frontend/src/hooks/useDiscussions.ts
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Discussion, MediaType, PaginationMeta } from '../lib/types'
import { discussionsApi } from '../lib/discussionsApi'

type DiscussionSort = 'newest' | 'most_comments'

export function useDiscussions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mediaType = (searchParams.get('media_type') as MediaType | null) ?? null
  const sort = (searchParams.get('sort') as DiscussionSort) || 'newest'
  const page = Number(searchParams.get('page')) || 1
  const workId = searchParams.get('work_id') ? Number(searchParams.get('work_id')) : undefined

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const fetchDiscussions = async () => {
      try {
        const res = await discussionsApi.getAll({
          workId,
          mediaType: mediaType ?? undefined,
          sort,
          page,
          perPage: 20,
        })
        if (!cancelled) {
          setDiscussions(res.discussions)
          setMeta(res.meta)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'エラーが発生しました'
          setError(message)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void fetchDiscussions()
    return () => { cancelled = true }
  }, [mediaType, sort, page, workId])

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, val] of Object.entries(updates)) {
          if (val === null) {
            next.delete(key)
          } else {
            next.set(key, val)
          }
        }
        if (!('page' in updates)) next.delete('page')
        return next
      })
    },
    [setSearchParams],
  )

  const setMediaType = useCallback(
    (mt: MediaType | null) => updateParams({ media_type: mt }),
    [updateParams],
  )

  const setSort = useCallback(
    (s: DiscussionSort) => updateParams({ sort: s }),
    [updateParams],
  )

  const setPage = useCallback(
    (p: number) => updateParams({ page: String(p) }),
    [updateParams],
  )

  return {
    discussions,
    totalPages: meta?.total_pages ?? 1,
    isLoading,
    error,
    mediaType,
    sort,
    page,
    setMediaType,
    setSort,
    setPage,
  }
}
```

- [ ] **Step 4: DiscussionCard コンポーネントを作成する**

```typescript
// frontend/src/components/DiscussionCard/DiscussionCard.tsx
import { Link } from 'react-router-dom'
import type { Discussion } from '../../lib/types'
import { formatRelativeTime } from '../../lib/timeUtils'
import { getMediaTypeLabel } from '../../lib/mediaTypeUtils'
import { SpoilerBadge } from '../ui/SpoilerBadge/SpoilerBadge'
import { EpisodeBadge } from '../ui/EpisodeBadge/EpisodeBadge'
import styles from './DiscussionCard.module.css'

type DiscussionCardProps = {
  discussion: Discussion
  showWorkInfo?: boolean
}

export function DiscussionCard({ discussion, showWorkInfo = true }: DiscussionCardProps) {
  const { work, user } = discussion

  return (
    <Link to={`/discussions/${discussion.id}`} className={styles.card}>
      {showWorkInfo && (
        <div className={styles.coverWrapper}>
          {work.cover_image_url ? (
            <img className={styles.cover} src={work.cover_image_url} alt={work.title} />
          ) : (
            <div className={styles.coverPlaceholder} />
          )}
        </div>
      )}
      <div className={styles.content}>
        <div className={styles.badges}>
          {showWorkInfo && (
            <span className={styles.genreBadge}>{getMediaTypeLabel(work.media_type)}</span>
          )}
          {discussion.episode_number !== null && (
            <EpisodeBadge episodeNumber={discussion.episode_number} />
          )}
          {discussion.has_spoiler && <SpoilerBadge />}
        </div>
        <div className={styles.title}>{discussion.title}</div>
        <div className={styles.meta}>
          {showWorkInfo && (
            <>
              <span className={styles.workTitle}>{work.title}</span>
              <span className={styles.separator}>·</span>
            </>
          )}
          <span>{user.username}</span>
          <span className={styles.separator}>·</span>
          <span>{formatRelativeTime(discussion.created_at)}</span>
          <span className={styles.separator}>·</span>
          <span>💬 {discussion.comments_count}</span>
        </div>
      </div>
    </Link>
  )
}
```

CSS は既存の `RecordListItem.module.css` のパターンに合わせて、カード型レイアウト（border, border-radius, padding）で作成する。詳細は実装時に Recolly のデザインシステム（CSS変数）に合わせる。

- [ ] **Step 5: CommunityPage を作成する**

```typescript
// frontend/src/pages/CommunityPage/CommunityPage.tsx
import { useDiscussions } from '../../hooks/useDiscussions'
import { DiscussionCard } from '../../components/DiscussionCard/DiscussionCard'
import { MediaTypeFilter } from '../../components/MediaTypeFilter/MediaTypeFilter'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import styles from './CommunityPage.module.css'

const SORT_OPTIONS = [
  { value: 'newest', label: '新着順' },
  { value: 'most_comments', label: 'コメント多い順' },
] as const

export function CommunityPage() {
  const {
    discussions,
    totalPages,
    isLoading,
    error,
    mediaType,
    sort,
    page,
    setMediaType,
    setSort,
    setPage,
  } = useDiscussions()

  return (
    <div className={styles.page}>
      <SectionTitle>コミュニティ</SectionTitle>

      <div className={styles.filters}>
        <MediaTypeFilter value={mediaType} onChange={setMediaType} />
        <select
          className={styles.sortSelect}
          value={sort}
          onChange={(e) => setSort(e.target.value as 'newest' | 'most_comments')}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <div className={styles.loading}>読み込み中...</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!isLoading && discussions.length === 0 && (
        <div className={styles.empty}>ディスカッションはまだありません</div>
      )}

      {!isLoading && discussions.length > 0 && (
        <>
          <div className={styles.list}>
            {discussions.map((d) => (
              <DiscussionCard key={d.id} discussion={d} />
            ))}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 6: CSS Module を作成する**

CommunityPage, DiscussionCard の CSS Module を作成する。既存のライブラリページ（`LibraryPage.module.css`）と `RecordListItem.module.css` のパターン（CSS変数使用、レスポンシブブレークポイント）に合わせる。

- [ ] **Step 7: ESLint を実行する**

Run: `docker compose exec frontend npx eslint src/pages/CommunityPage/ src/components/DiscussionCard/ src/components/ui/SpoilerBadge/ src/components/ui/EpisodeBadge/ src/hooks/useDiscussions.ts`
Expected: No errors

- [ ] **Step 8: コミットする**

```bash
git add frontend/src/hooks/useDiscussions.ts frontend/src/components/DiscussionCard/ frontend/src/components/ui/SpoilerBadge/ frontend/src/components/ui/EpisodeBadge/ frontend/src/pages/CommunityPage/
git commit -m "feat: コミュニティページとディスカッションカードを追加"
```

---

## Task 11: フロントエンド — ディスカッション詳細ページ

**Files:**
- Create: `frontend/src/hooks/useDiscussion.ts`
- Create: `frontend/src/hooks/useComments.ts`
- Create: `frontend/src/components/CommentItem/CommentItem.tsx` + CSS
- Create: `frontend/src/components/CommentForm/CommentForm.tsx` + CSS
- Create: `frontend/src/components/ui/Breadcrumb/Breadcrumb.tsx` + CSS
- Create: `frontend/src/components/ui/DropdownMenu/DropdownMenu.tsx` + CSS
- Create: `frontend/src/pages/DiscussionDetailPage/DiscussionDetailPage.tsx` + CSS

- [ ] **Step 1: useDiscussion フックを作成する**

```typescript
// frontend/src/hooks/useDiscussion.ts
import { useCallback, useEffect, useState } from 'react'
import type { Discussion } from '../lib/types'
import { discussionsApi } from '../lib/discussionsApi'

export function useDiscussion(id: number) {
  const [discussion, setDiscussion] = useState<Discussion | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const fetchDiscussion = async () => {
      try {
        const res = await discussionsApi.getById(id)
        if (!cancelled) setDiscussion(res.discussion)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'エラーが発生しました')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void fetchDiscussion()
    return () => { cancelled = true }
  }, [id])

  const updateDiscussion = useCallback(
    async (params: { title?: string; body?: string; has_spoiler?: boolean }) => {
      const res = await discussionsApi.update(id, params)
      setDiscussion(res.discussion)
    },
    [id],
  )

  const deleteDiscussion = useCallback(
    async () => {
      await discussionsApi.delete(id)
    },
    [id],
  )

  return { discussion, isLoading, error, updateDiscussion, deleteDiscussion }
}
```

- [ ] **Step 2: useComments フックを作成する**

```typescript
// frontend/src/hooks/useComments.ts
import { useCallback, useEffect, useState } from 'react'
import type { Comment, PaginationMeta } from '../lib/types'
import { commentsApi } from '../lib/commentsApi'

export function useComments(discussionId: number) {
  const [comments, setComments] = useState<Comment[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const fetchComments = async () => {
      try {
        const res = await commentsApi.getAll(discussionId, page)
        if (!cancelled) {
          setComments(res.comments)
          setMeta(res.meta)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void fetchComments()
    return () => { cancelled = true }
  }, [discussionId, page])

  const addComment = useCallback(
    async (body: string) => {
      const res = await commentsApi.create(discussionId, body)
      setComments((prev) => [...prev, res.comment])
      setMeta((prev) => prev ? { ...prev, total_count: prev.total_count + 1 } : prev)
    },
    [discussionId],
  )

  const updateComment = useCallback(
    async (commentId: number, body: string) => {
      const res = await commentsApi.update(commentId, body)
      setComments((prev) => prev.map((c) => (c.id === commentId ? res.comment : c)))
    },
    [],
  )

  const deleteComment = useCallback(
    async (commentId: number) => {
      await commentsApi.delete(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      setMeta((prev) => prev ? { ...prev, total_count: prev.total_count - 1 } : prev)
    },
    [],
  )

  return {
    comments,
    totalPages: meta?.total_pages ?? 1,
    totalCount: meta?.total_count ?? 0,
    page,
    isLoading,
    setPage,
    addComment,
    updateComment,
    deleteComment,
  }
}
```

- [ ] **Step 3: Breadcrumb, DropdownMenu UI コンポーネントを作成する**

```typescript
// frontend/src/components/ui/Breadcrumb/Breadcrumb.tsx
import { Link } from 'react-router-dom'
import styles from './Breadcrumb.module.css'

type BreadcrumbItem = {
  label: string
  path?: string
}

type BreadcrumbProps = {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className={styles.breadcrumb} aria-label="パンくずリスト">
      {items.map((item, i) => (
        <span key={i} className={styles.item}>
          {i > 0 && <span className={styles.separator}>›</span>}
          {item.path ? (
            <Link to={item.path} className={styles.link}>{item.label}</Link>
          ) : (
            <span className={styles.current}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
```

```typescript
// frontend/src/components/ui/DropdownMenu/DropdownMenu.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './DropdownMenu.module.css'

type MenuItem = {
  label: string
  onClick: () => void
  danger?: boolean
}

type DropdownMenuProps = {
  items: MenuItem[]
}

export function DropdownMenu({ items }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  return (
    <div className={styles.container} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="メニューを開く"
      >
        ⋯
      </button>
      {isOpen && (
        <div className={styles.menu}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={item.danger ? styles.dangerItem : styles.menuItem}
              onClick={() => {
                item.onClick()
                setIsOpen(false)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: CommentItem, CommentForm を作成する**

```typescript
// frontend/src/components/CommentItem/CommentItem.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Comment } from '../../lib/types'
import { formatRelativeTime } from '../../lib/timeUtils'
import { DropdownMenu } from '../ui/DropdownMenu/DropdownMenu'
import styles from './CommentItem.module.css'

type CommentItemProps = {
  comment: Comment
  isAuthor: boolean
  onUpdate: (id: number, body: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

export function CommentItem({ comment, isAuthor, onUpdate, onDelete }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editBody, setEditBody] = useState(comment.body)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSave = async () => {
    if (!editBody.trim()) return
    setIsSubmitting(true)
    try {
      await onUpdate(comment.id, editBody.trim())
      setIsEditing(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.comment}>
      <Link to={`/users/${comment.user.id}`} className={styles.avatar}>
        {comment.user.avatar_url ? (
          <img src={comment.user.avatar_url} alt={comment.user.username} className={styles.avatarImg} />
        ) : (
          <span className={styles.avatarPlaceholder}>{comment.user.username[0].toUpperCase()}</span>
        )}
      </Link>
      <div className={styles.body}>
        <div className={styles.header}>
          <Link to={`/users/${comment.user.id}`} className={styles.username}>{comment.user.username}</Link>
          <span className={styles.time}>{formatRelativeTime(comment.created_at)}</span>
          {comment.edited && <span className={styles.edited}>（編集済み）</span>}
          {isAuthor && (
            <DropdownMenu
              items={[
                { label: '編集', onClick: () => { setIsEditing(true); setEditBody(comment.body) } },
                { label: '削除', onClick: () => void onDelete(comment.id), danger: true },
              ]}
            />
          )}
        </div>
        {isEditing ? (
          <div className={styles.editForm}>
            <textarea
              className={styles.editTextarea}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              maxLength={3000}
            />
            <div className={styles.editActions}>
              <button type="button" className={styles.cancelButton} onClick={() => setIsEditing(false)}>
                キャンセル
              </button>
              <button type="button" className={styles.saveButton} disabled={isSubmitting} onClick={() => void handleSave()}>
                保存
              </button>
            </div>
          </div>
        ) : (
          <p className={styles.text}>{comment.body}</p>
        )}
      </div>
    </div>
  )
}
```

```typescript
// frontend/src/components/CommentForm/CommentForm.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import styles from './CommentForm.module.css'

type CommentFormProps = {
  hasRecord: boolean
  workId: number
  onSubmit: (body: string) => Promise<void>
}

export function CommentForm({ hasRecord, workId, onSubmit }: CommentFormProps) {
  const { isAuthenticated } = useAuth()
  const [body, setBody] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isAuthenticated) {
    return (
      <div className={styles.restricted}>
        <span>コメントするには</span>
        <Link to="/login" className={styles.link}>ログイン</Link>
        <span>してください</span>
      </div>
    )
  }

  if (!hasRecord) {
    return (
      <div className={styles.restricted}>
        <span>コメントするには、この作品をライブラリに記録してください</span>
        <Link to={`/works/${workId}`} className={styles.recordButton}>記録する</Link>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!body.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onSubmit(body.trim())
      setBody('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.form}>
      <div className={styles.label}>コメントを投稿</div>
      <textarea
        className={styles.textarea}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="コメントを入力..."
        maxLength={3000}
      />
      <div className={styles.footer}>
        <span className={styles.hint}>この作品を記録しているユーザーのみ投稿できます</span>
        <button
          type="button"
          className={styles.submitButton}
          disabled={!body.trim() || isSubmitting}
          onClick={() => void handleSubmit()}
        >
          投稿
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: DiscussionDetailPage を作成する**

```typescript
// frontend/src/pages/DiscussionDetailPage/DiscussionDetailPage.tsx
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import { useDiscussion } from '../../hooks/useDiscussion'
import { useComments } from '../../hooks/useComments'
import { Breadcrumb } from '../../components/ui/Breadcrumb/Breadcrumb'
import { SpoilerBadge } from '../../components/ui/SpoilerBadge/SpoilerBadge'
import { EpisodeBadge } from '../../components/ui/EpisodeBadge/EpisodeBadge'
import { DropdownMenu } from '../../components/ui/DropdownMenu/DropdownMenu'
import { CommentItem } from '../../components/CommentItem/CommentItem'
import { CommentForm } from '../../components/CommentForm/CommentForm'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { formatRelativeTime } from '../../lib/timeUtils'
import { getMediaTypeLabel } from '../../lib/mediaTypeUtils'
import { recordsApi } from '../../lib/recordsApi'
import styles from './DiscussionDetailPage.module.css'
import { useCallback, useEffect, useState } from 'react'

export function DiscussionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { discussion, isLoading, error, updateDiscussion, deleteDiscussion } = useDiscussion(Number(id))
  const { comments, totalPages, totalCount, page, isLoading: commentsLoading, setPage, addComment, updateComment, deleteComment } = useComments(Number(id))
  const [hasRecord, setHasRecord] = useState(false)

  // 現在のユーザーがこの作品を記録しているか確認
  useEffect(() => {
    if (!user || !discussion) return
    let cancelled = false
    const checkRecord = async () => {
      try {
        const res = await recordsApi.getAll({ workId: discussion.work.id })
        if (!cancelled) setHasRecord(res.records.length > 0)
      } catch {
        // 未認証の場合はfalseのまま
      }
    }
    void checkRecord()
    return () => { cancelled = true }
  }, [user, discussion])

  const handleDelete = useCallback(async () => {
    if (!window.confirm('このスレッドを削除しますか？')) return
    await deleteDiscussion()
    navigate('/community')
  }, [deleteDiscussion, navigate])

  if (isLoading) return <div className={styles.loading}>読み込み中...</div>
  if (error || !discussion) return <div className={styles.error}>{error ?? 'スレッドが見つかりません'}</div>

  const isAuthor = user?.id === discussion.user.id

  return (
    <div className={styles.page}>
      <Breadcrumb items={[
        { label: 'コミュニティ', path: '/community' },
        { label: discussion.work.title, path: `/works/${discussion.work.id}` },
        { label: discussion.title },
      ]} />

      {/* 作品情報バー */}
      <Link to={`/works/${discussion.work.id}`} className={styles.workBar}>
        {discussion.work.cover_image_url && (
          <img src={discussion.work.cover_image_url} alt={discussion.work.title} className={styles.workCover} />
        )}
        <div className={styles.workInfo}>
          <div className={styles.workTitle}>{discussion.work.title}</div>
          <div className={styles.workMeta}>
            {getMediaTypeLabel(discussion.work.media_type)}
            {discussion.work.total_episodes && ` · 全${discussion.work.total_episodes}話`}
          </div>
        </div>
        <div className={styles.workBadges}>
          {discussion.episode_number !== null && <EpisodeBadge episodeNumber={discussion.episode_number} />}
          {discussion.has_spoiler && <SpoilerBadge />}
        </div>
      </Link>

      {/* スレッド本文 */}
      <div className={styles.thread}>
        <div className={styles.threadHeader}>
          <Link to={`/users/${discussion.user.id}`} className={styles.avatar}>
            {discussion.user.avatar_url ? (
              <img src={discussion.user.avatar_url} alt="" className={styles.avatarImg} />
            ) : (
              <span className={styles.avatarPlaceholder}>{discussion.user.username[0].toUpperCase()}</span>
            )}
          </Link>
          <div>
            <Link to={`/users/${discussion.user.id}`} className={styles.authorName}>{discussion.user.username}</Link>
            <div className={styles.threadTime}>{formatRelativeTime(discussion.created_at)}</div>
          </div>
          {isAuthor && (
            <DropdownMenu items={[
              { label: '編集', onClick: () => { /* 編集モーダルを開く（実装時に追加） */ } },
              { label: '削除', onClick: () => void handleDelete(), danger: true },
            ]} />
          )}
        </div>
        <h1 className={styles.threadTitle}>{discussion.title}</h1>
        <div className={styles.threadBody}>{discussion.body}</div>
      </div>

      {/* コメントセクション */}
      <div className={styles.commentsSection}>
        <h2 className={styles.commentsHeading}>コメント（{totalCount}）</h2>
        {commentsLoading ? (
          <div className={styles.loading}>読み込み中...</div>
        ) : (
          <>
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                isAuthor={user?.id === c.user.id}
                onUpdate={updateComment}
                onDelete={deleteComment}
              />
            ))}
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* コメント投稿フォーム */}
      <CommentForm
        hasRecord={hasRecord}
        workId={discussion.work.id}
        onSubmit={addComment}
      />
    </div>
  )
}
```

- [ ] **Step 6: CSS Module を作成する**

各コンポーネントの CSS Module を作成する。既存のデザインシステム（CSS変数、白背景、モノクロ）に合わせる。

- [ ] **Step 7: ESLint を実行する**

Run: `docker compose exec frontend npx eslint src/pages/DiscussionDetailPage/ src/components/CommentItem/ src/components/CommentForm/ src/components/ui/Breadcrumb/ src/components/ui/DropdownMenu/ src/hooks/useDiscussion.ts src/hooks/useComments.ts`
Expected: No errors

- [ ] **Step 8: コミットする**

```bash
git add frontend/src/hooks/useDiscussion.ts frontend/src/hooks/useComments.ts frontend/src/pages/DiscussionDetailPage/ frontend/src/components/CommentItem/ frontend/src/components/CommentForm/ frontend/src/components/ui/Breadcrumb/ frontend/src/components/ui/DropdownMenu/
git commit -m "feat: ディスカッション詳細ページとコメント機能を追加"
```

---

## Task 12: フロントエンド — 作品詳細ページにディスカッションセクション追加

**Files:**
- Create: `frontend/src/components/DiscussionSection/DiscussionSection.tsx` + CSS
- Create: `frontend/src/components/DiscussionCreateModal/DiscussionCreateModal.tsx` + CSS
- Modify: `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`

- [ ] **Step 1: DiscussionCreateModal を作成する**

```typescript
// frontend/src/components/DiscussionCreateModal/DiscussionCreateModal.tsx
import { useState } from 'react'
import type { WorkSummary } from '../../lib/types'
import { discussionsApi } from '../../lib/discussionsApi'
import styles from './DiscussionCreateModal.module.css'

type DiscussionCreateModalProps = {
  work: WorkSummary
  onClose: () => void
  onCreated: () => void
}

export function DiscussionCreateModal({ work, onClose, onCreated }: DiscussionCreateModalProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [episodeNumber, setEpisodeNumber] = useState<number | null>(null)
  const [hasSpoiler, setHasSpoiler] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const episodeOptions = work.total_episodes
    ? Array.from({ length: work.total_episodes }, (_, i) => i + 1)
    : []

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim() || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      await discussionsApi.create(work.id, {
        title: title.trim(),
        body: body.trim(),
        episode_number: episodeNumber,
        has_spoiler: hasSpoiler,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.heading}>新しいスレッドを作成</h3>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.field}>
          <label className={styles.label}>話数（任意）</label>
          <select
            className={styles.select}
            value={episodeNumber ?? ''}
            onChange={(e) => setEpisodeNumber(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">作品全体</option>
            {episodeOptions.map((n) => (
              <option key={n} value={n}>第{n}話</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>タイトル</label>
          <input
            type="text"
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="スレッドのタイトルを入力"
            maxLength={100}
          />
          <span className={styles.charCount}>最大100文字</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>本文</label>
          <textarea
            className={styles.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="本文を入力"
            maxLength={5000}
          />
          <span className={styles.charCount}>最大5000文字</span>
        </div>

        <label className={styles.checkbox}>
          <input type="checkbox" checked={hasSpoiler} onChange={(e) => setHasSpoiler(e.target.checked)} />
          <span>ネタバレを含む</span>
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>キャンセル</button>
          <button
            type="button"
            className={styles.submitButton}
            disabled={!title.trim() || !body.trim() || isSubmitting}
            onClick={() => void handleSubmit()}
          >
            作成
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: DiscussionSection を作成する**

```typescript
// frontend/src/components/DiscussionSection/DiscussionSection.tsx
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Discussion, WorkSummary } from '../../lib/types'
import { discussionsApi } from '../../lib/discussionsApi'
import { useAuth } from '../../contexts/useAuth'
import { DiscussionCard } from '../DiscussionCard/DiscussionCard'
import { DiscussionCreateModal } from '../DiscussionCreateModal/DiscussionCreateModal'
import { SectionTitle } from '../ui/SectionTitle/SectionTitle'
import styles from './DiscussionSection.module.css'

type DiscussionSectionProps = {
  workId: number
  work: WorkSummary
  hasRecord: boolean
  totalEpisodes: number | null
}

export function DiscussionSection({ workId, work, hasRecord, totalEpisodes }: DiscussionSectionProps) {
  const { isAuthenticated } = useAuth()
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [episodeFilter, setEpisodeFilter] = useState<number | ''>('')

  const fetchDiscussions = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await discussionsApi.getByWork(workId, {
        episodeNumber: episodeFilter || undefined,
        perPage: 3,
      })
      setDiscussions(res.discussions)
    } finally {
      setIsLoading(false)
    }
  }, [workId, episodeFilter])

  useEffect(() => {
    void fetchDiscussions()
  }, [fetchDiscussions])

  const episodeOptions = totalEpisodes
    ? Array.from({ length: totalEpisodes }, (_, i) => i + 1)
    : []

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <SectionTitle>ディスカッション</SectionTitle>
        <div className={styles.controls}>
          {totalEpisodes && (
            <select
              className={styles.episodeFilter}
              value={episodeFilter}
              onChange={(e) => setEpisodeFilter(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">すべての話数</option>
              <option value="0">作品全体</option>
              {episodeOptions.map((n) => (
                <option key={n} value={n}>第{n}話</option>
              ))}
            </select>
          )}
          {isAuthenticated && hasRecord && (
            <button type="button" className={styles.createButton} onClick={() => setShowModal(true)}>
              + スレッドを作成
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading}>読み込み中...</div>
      ) : discussions.length === 0 ? (
        <div className={styles.empty}>ディスカッションはまだありません</div>
      ) : (
        <>
          <div className={styles.list}>
            {discussions.map((d) => (
              <DiscussionCard key={d.id} discussion={d} showWorkInfo={false} />
            ))}
          </div>
          <Link to={`/community?work_id=${workId}`} className={styles.viewAll}>
            すべてのディスカッションを見る →
          </Link>
        </>
      )}

      {showModal && (
        <DiscussionCreateModal
          work={work}
          onClose={() => setShowModal(false)}
          onCreated={() => void fetchDiscussions()}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: WorkDetailPage に DiscussionSection を追加する**

`frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx` で、EpisodeReviewSection の後（削除ボタンの前）に追加:

```typescript
import { DiscussionSection } from '../../components/DiscussionSection/DiscussionSection'

// return 内、EpisodeReviewSection の後に追加:
<DiscussionSection
  workId={work.id}
  work={{ id: work.id, title: work.title, media_type: work.media_type, total_episodes: work.total_episodes, cover_image_url: work.cover_image_url }}
  hasRecord={record !== null}
  totalEpisodes={work.total_episodes}
/>
```

- [ ] **Step 4: CSS Module を作成する**

DiscussionSection, DiscussionCreateModal の CSS を作成。

- [ ] **Step 5: ESLint を実行する**

Run: `docker compose exec frontend npx eslint src/components/DiscussionSection/ src/components/DiscussionCreateModal/ src/pages/WorkDetailPage/`
Expected: No errors

- [ ] **Step 6: コミットする**

```bash
git add frontend/src/components/DiscussionSection/ frontend/src/components/DiscussionCreateModal/ frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx
git commit -m "feat: 作品詳細ページにディスカッションセクションとスレッド作成モーダルを追加"
```

---

## Task 13: フロントエンド — ユーザープロフィールページ

**Files:**
- Create: `frontend/src/hooks/useUserProfile.ts`
- Create: `frontend/src/hooks/useUserRecords.ts`
- Create: `frontend/src/components/UserProfileHeader/UserProfileHeader.tsx` + CSS
- Create: `frontend/src/components/UserStats/UserStats.tsx` + CSS
- Create: `frontend/src/components/PublicLibrary/PublicLibrary.tsx` + CSS
- Create: `frontend/src/pages/UserProfilePage/UserProfilePage.tsx` + CSS

- [ ] **Step 1: useUserProfile フックを作成する**

```typescript
// frontend/src/hooks/useUserProfile.ts
import { useEffect, useState } from 'react'
import type { UserProfile, UserStatistics } from '../lib/types'
import { usersApi } from '../lib/usersApi'

export function useUserProfile(userId: number) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [statistics, setStatistics] = useState<UserStatistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const fetchProfile = async () => {
      try {
        const res = await usersApi.getProfile(userId)
        if (!cancelled) {
          setProfile(res.user)
          setStatistics(res.statistics)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'エラーが発生しました')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void fetchProfile()
    return () => { cancelled = true }
  }, [userId])

  return { profile, statistics, isLoading, error }
}
```

- [ ] **Step 2: useUserRecords フックを作成する**

```typescript
// frontend/src/hooks/useUserRecords.ts
import { useCallback, useEffect, useState } from 'react'
import type { MediaType, PaginationMeta, PublicRecord } from '../lib/types'
import { usersApi } from '../lib/usersApi'

export function useUserRecords(userId: number) {
  const [records, setRecords] = useState<PublicRecord[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [mediaType, setMediaType] = useState<MediaType | null>(null)
  const [sort, setSort] = useState('updated_at')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const fetchRecords = async () => {
      try {
        const res = await usersApi.getRecords(userId, {
          mediaType: mediaType ?? undefined,
          sort,
          page,
          perPage: 20,
        })
        if (!cancelled) {
          setRecords(res.records)
          setMeta(res.meta)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void fetchRecords()
    return () => { cancelled = true }
  }, [userId, mediaType, sort, page])

  const handleSetMediaType = useCallback((mt: MediaType | null) => {
    setMediaType(mt)
    setPage(1)
  }, [])

  const handleSetSort = useCallback((s: string) => {
    setSort(s)
    setPage(1)
  }, [])

  return {
    records,
    totalPages: meta?.total_pages ?? 1,
    isLoading,
    mediaType,
    sort,
    page,
    setMediaType: handleSetMediaType,
    setSort: handleSetSort,
    setPage,
  }
}
```

- [ ] **Step 3: UserProfileHeader, UserStats, PublicLibrary を作成する**

```typescript
// frontend/src/components/UserProfileHeader/UserProfileHeader.tsx
import type { UserProfile } from '../../lib/types'
import styles from './UserProfileHeader.module.css'

type UserProfileHeaderProps = {
  profile: UserProfile
}

export function UserProfileHeader({ profile }: UserProfileHeaderProps) {
  const joinDate = new Date(profile.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })

  return (
    <div className={styles.header}>
      <div className={styles.avatar}>
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.username} className={styles.avatarImg} />
        ) : (
          <span className={styles.avatarPlaceholder}>{profile.username[0].toUpperCase()}</span>
        )}
      </div>
      <div className={styles.info}>
        <h1 className={styles.username}>{profile.username}</h1>
        {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
        <p className={styles.joinDate}>{joinDate}から利用</p>
      </div>
    </div>
  )
}
```

```typescript
// frontend/src/components/UserStats/UserStats.tsx
import type { UserStatistics } from '../../lib/types'
import { getMediaTypeLabel } from '../../lib/mediaTypeUtils'
import styles from './UserStats.module.css'

type UserStatsProps = {
  statistics: UserStatistics
}

export function UserStats({ statistics }: UserStatsProps) {
  return (
    <div>
      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.value}>{statistics.total_records}</div>
          <div className={styles.label}>総記録数</div>
        </div>
        <div className={styles.card}>
          <div className={styles.value}>{statistics.completed_count}</div>
          <div className={styles.label}>完了</div>
        </div>
        <div className={styles.card}>
          <div className={styles.value}>{statistics.watching_count}</div>
          <div className={styles.label}>進行中</div>
        </div>
        <div className={styles.card}>
          <div className={styles.value}>{statistics.average_rating ?? '-'}</div>
          <div className={styles.label}>平均評価</div>
        </div>
      </div>
      {Object.keys(statistics.by_genre).length > 0 && (
        <div className={styles.genres}>
          {Object.entries(statistics.by_genre).map(([genre, count]) => (
            <span key={genre} className={styles.genreChip}>
              {getMediaTypeLabel(genre)} {count}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

```typescript
// frontend/src/components/PublicLibrary/PublicLibrary.tsx
import { Link } from 'react-router-dom'
import type { PublicRecord } from '../../lib/types'
import { useUserRecords } from '../../hooks/useUserRecords'
import { MediaTypeFilter } from '../MediaTypeFilter/MediaTypeFilter'
import { Pagination } from '../ui/Pagination/Pagination'
import { SectionTitle } from '../ui/SectionTitle/SectionTitle'
import { getStatusLabel } from '../../lib/mediaTypeUtils'
import styles from './PublicLibrary.module.css'

const SORT_OPTIONS = [
  { value: 'updated_at', label: '更新日' },
  { value: 'rating', label: '評価' },
  { value: 'title', label: 'タイトル' },
]

type PublicLibraryProps = {
  userId: number
}

export function PublicLibrary({ userId }: PublicLibraryProps) {
  const { records, totalPages, isLoading, mediaType, sort, page, setMediaType, setSort, setPage } = useUserRecords(userId)

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <SectionTitle>公開ライブラリ</SectionTitle>
        <div className={styles.controls}>
          <MediaTypeFilter value={mediaType} onChange={setMediaType} />
          <select className={styles.sortSelect} value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading}>読み込み中...</div>
      ) : records.length === 0 ? (
        <div className={styles.empty}>公開記録はありません</div>
      ) : (
        <>
          <div className={styles.grid}>
            {records.map((record) => (
              <RecordCard key={record.id} record={record} />
            ))}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}

function RecordCard({ record }: { record: PublicRecord }) {
  return (
    <Link to={`/works/${record.work.id}`} className={styles.card}>
      <div className={styles.coverWrapper}>
        {record.work.cover_image_url ? (
          <img className={styles.cover} src={record.work.cover_image_url} alt={record.work.title} />
        ) : (
          <div className={styles.coverPlaceholder} />
        )}
      </div>
      <div className={styles.cardTitle}>{record.work.title}</div>
      <div className={styles.cardMeta}>
        {record.rating !== null && <span className={styles.rating}>★ {record.rating}</span>}
        <span className={styles.status}>{getStatusLabel(record.status, record.work.media_type)}</span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: UserProfilePage を作成する**

```typescript
// frontend/src/pages/UserProfilePage/UserProfilePage.tsx
import { useParams } from 'react-router-dom'
import { useUserProfile } from '../../hooks/useUserProfile'
import { UserProfileHeader } from '../../components/UserProfileHeader/UserProfileHeader'
import { UserStats } from '../../components/UserStats/UserStats'
import { PublicLibrary } from '../../components/PublicLibrary/PublicLibrary'
import styles from './UserProfilePage.module.css'

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>()
  const userId = Number(id)
  const { profile, statistics, isLoading, error } = useUserProfile(userId)

  if (isLoading) return <div className={styles.loading}>読み込み中...</div>
  if (error || !profile || !statistics) return <div className={styles.error}>{error ?? 'ユーザーが見つかりません'}</div>

  return (
    <div className={styles.page}>
      <UserProfileHeader profile={profile} />
      <UserStats statistics={statistics} />
      <PublicLibrary userId={userId} />
    </div>
  )
}
```

- [ ] **Step 5: CSS Module を作成する**

各コンポーネントの CSS を作成。統計カードは `grid-template-columns: repeat(4, 1fr)`、モバイルでは `repeat(2, 1fr)`。公開ライブラリグリッドは PC で5列、モバイルで3列。

- [ ] **Step 6: ESLint を実行する**

Run: `docker compose exec frontend npx eslint src/pages/UserProfilePage/ src/components/UserProfileHeader/ src/components/UserStats/ src/components/PublicLibrary/ src/hooks/useUserProfile.ts src/hooks/useUserRecords.ts`
Expected: No errors

- [ ] **Step 7: コミットする**

```bash
git add frontend/src/hooks/useUserProfile.ts frontend/src/hooks/useUserRecords.ts frontend/src/pages/UserProfilePage/ frontend/src/components/UserProfileHeader/ frontend/src/components/UserStats/ frontend/src/components/PublicLibrary/
git commit -m "feat: ユーザープロフィールページを追加（統計 + 公開ライブラリ）"
```

---

## Task 14: フロントエンド — ナビゲーション更新 + ルーティング

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/ui/NavBar/NavBar.tsx`
- Modify: `frontend/src/components/ui/BottomTabBar/BottomTabBar.tsx`

- [ ] **Step 1: NavBar のコミュニティリンクを有効化する**

`frontend/src/components/ui/NavBar/NavBar.tsx` で `NAV_ITEMS` を変更:

```typescript
const NAV_ITEMS: NavItem[] = [
  { label: 'ホーム', path: '/dashboard' },
  { label: '検索', path: '/search' },
  { label: 'ライブラリ', path: '/library' },
  { label: 'コミュニティ', path: '/community' },
  { label: 'おすすめ', path: null },
]
```

- [ ] **Step 2: BottomTabBar にコミュニティタブを追加する**

`frontend/src/components/ui/BottomTabBar/BottomTabBar.tsx` を変更:

1. `iconKey` の型に `'community'` を追加:
```typescript
type TabItem = {
  label: string
  path: string
  iconKey: 'home' | 'search' | 'library' | 'community' | 'settings'
}
```

2. `TAB_ITEMS` にコミュニティを追加:
```typescript
const TAB_ITEMS: TabItem[] = [
  { label: 'ホーム', path: '/dashboard', iconKey: 'home' },
  { label: '検索', path: '/search', iconKey: 'search' },
  { label: 'ライブラリ', path: '/library', iconKey: 'library' },
  { label: 'コミュニティ', path: '/community', iconKey: 'community' },
  { label: '設定', path: '/settings', iconKey: 'settings' },
]
```

3. `TabIcon` に `community` ケースを追加:
```typescript
case 'community':
  return (
    <svg {...props}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
```

- [ ] **Step 3: App.tsx にルートを追加する**

`frontend/src/App.tsx` に以下のルートを追加:

```typescript
import { CommunityPage } from './pages/CommunityPage/CommunityPage'
import { DiscussionDetailPage } from './pages/DiscussionDetailPage/DiscussionDetailPage'
import { UserProfilePage } from './pages/UserProfilePage/UserProfilePage'

// Routes 内に追加（PublicLayout対応 — 認証不要だがNavBar表示あり）
// コミュニティ関連は認証不要で閲覧可能
<Route path="/community" element={<OptionalAuthLayout><CommunityPage /></OptionalAuthLayout>} />
<Route path="/discussions/:id" element={<OptionalAuthLayout><DiscussionDetailPage /></OptionalAuthLayout>} />
<Route path="/users/:id" element={<OptionalAuthLayout><UserProfilePage /></OptionalAuthLayout>} />
```

`OptionalAuthLayout` を追加（認証状態に関わらずNavBar表示）:

```typescript
function OptionalAuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) return <div className={appStyles.loading}>読み込み中...</div>

  return (
    <>
      {user ? (
        <NavBar user={user} onLogout={() => void logout()} />
      ) : (
        <nav className={appStyles.publicNav}>
          <Link to="/" className={appStyles.logo}>Recolly</Link>
          <Link to="/login" className={appStyles.loginLink}>ログイン</Link>
        </nav>
      )}
      <div className={appStyles.authenticatedContent}>{children}</div>
      {user && <BottomTabBar />}
    </>
  )
}
```

- [ ] **Step 4: ESLint を実行する**

Run: `docker compose exec frontend npx eslint src/App.tsx src/components/ui/NavBar/ src/components/ui/BottomTabBar/`
Expected: No errors

- [ ] **Step 5: コミットする**

```bash
git add frontend/src/App.tsx frontend/src/components/ui/NavBar/NavBar.tsx frontend/src/components/ui/BottomTabBar/BottomTabBar.tsx
git commit -m "feat: ナビゲーションにコミュニティタブ追加 + 新規ルーティング設定"
```

---

## Task 15: モバイル対応

**Files:**
- Modify: `frontend/src/pages/CommunityPage/CommunityPage.module.css`
- Modify: `frontend/src/pages/DiscussionDetailPage/DiscussionDetailPage.module.css`
- Modify: `frontend/src/pages/UserProfilePage/UserProfilePage.module.css`
- Modify: `frontend/src/components/UserStats/UserStats.module.css`
- Modify: `frontend/src/components/PublicLibrary/PublicLibrary.module.css`
- Modify: `frontend/src/components/DiscussionCard/DiscussionCard.module.css`
- Modify: `frontend/src/components/ui/BottomTabBar/BottomTabBar.module.css`

- [ ] **Step 1: 既存のレスポンシブブレークポイントを確認する**

既存の CSS で使われているブレークポイントを確認:
- スマホ: `max-width: 768px`
- タブレット: `769px〜1024px`
- PC: `1025px〜`

- [ ] **Step 2: CommunityPage のモバイル対応**

```css
/* 追加: CommunityPage.module.css */
@media (max-width: 768px) {
  .filters {
    flex-direction: column;
    gap: 8px;
  }
  /* DiscussionCard 内の作品サムネを非表示 */
}
```

- [ ] **Step 3: DiscussionDetailPage のモバイル対応**

```css
/* パンくずリスト横スクロール、作品情報バー折り返し、コメントフォーム幅100% */
@media (max-width: 768px) {
  .breadcrumb { overflow-x: auto; white-space: nowrap; }
  .workBar { flex-wrap: wrap; }
  .workCover { width: 32px; height: 44px; }
}
```

- [ ] **Step 4: UserProfilePage のモバイル対応**

```css
/* 統計カード: 4列→2列、公開ライブラリ: 5列→3列 */
@media (max-width: 768px) {
  .grid { grid-template-columns: repeat(2, 1fr); }
  .libraryGrid { grid-template-columns: repeat(3, 1fr); }
}
```

- [ ] **Step 5: BottomTabBar の5タブ対応**

BottomTabBar を5タブに変更したことで、各タブの幅が狭くなる。フォントサイズやアイコンサイズの調整が必要な場合は CSS を修正する。

- [ ] **Step 6: 全フロントエンドテストを実行する**

Run: `docker compose exec frontend npx vitest run`
Expected: ALL PASS

- [ ] **Step 7: ESLint + Prettier を実行する**

Run: `docker compose exec frontend npx eslint src/ && npx prettier --check src/`
Expected: No errors

- [ ] **Step 8: コミットする**

```bash
git add frontend/src/
git commit -m "feat: フェーズ3全ページのモバイルレスポンシブ対応"
```

---

## Task 16: 全体テスト + 最終確認

- [ ] **Step 1: バックエンド全テスト実行**

Run: `docker compose exec backend bundle exec rspec`
Expected: ALL PASS

- [ ] **Step 2: バックエンドリンター実行**

Run: `docker compose exec backend bundle exec rubocop`
Expected: No offenses

- [ ] **Step 3: フロントエンド全テスト実行**

Run: `docker compose exec frontend npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: フロントエンドリンター実行**

Run: `docker compose exec frontend npx eslint src/ && npx prettier --check src/`
Expected: No errors

- [ ] **Step 5: 動作確認の準備**

ワークフロー Step 5 に従い、ユーザーに動作確認方法を確認する。
