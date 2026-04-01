# プロフィール編集機能 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プロフィールページ上でアバター画像・自己紹介・お気に入りベスト5を編集できるようにする

**Architecture:** バックエンドに `PATCH /api/v1/profile`（プロフィール更新）と `favorite_works` リソース（ベスト5CRUD）を追加。フロントエンドは `UserProfileHeader` を拡張してインライン編集UIを実装し、新規 `FavoriteWorks` コンポーネントでベスト5表示・編集を行う。

**Tech Stack:** Ruby on Rails 8 (API) / React 19 + TypeScript / PostgreSQL / RSpec / Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-04-01-profile-edit-design.md`

**既存パターン参照:**
- CSS Modules + `tokens.css` 変数を使用（ハードコード禁止）
- モーダル: overlay `rgba(0,0,0,0.5)` + `z-index: 100`、本体 `max-width` + `width: 90%` + `border-radius: 8px`
- エラー表示: `color: var(--color-error)` / `font-size: var(--font-size-meta)`
- ボタン: 既存 `Button` コンポーネント（primary/secondary/ghost）
- フィルタータブ: `PublicLibrary` の `filterButton` パターン
- テスト: FactoryBotなし。直接 `User.create!` / `Work.create!` でデータ作成

---

## ファイル構成

### バックエンド（新規作成）

| ファイル | 役割 |
|---------|------|
| `backend/db/migrate/XXXXXX_add_favorite_display_mode_to_users.rb` | users テーブルに `favorite_display_mode` カラム追加 |
| `backend/db/migrate/XXXXXX_create_favorite_works.rb` | `favorite_works` テーブル作成 |
| `backend/app/models/favorite_work.rb` | FavoriteWork モデル（バリデーション・アソシエーション） |
| `backend/app/controllers/api/v1/profile_controller.rb` | プロフィール更新API（PATCH） + アバターpresign |
| `backend/app/controllers/api/v1/favorite_works_controller.rb` | ベスト5取得・一括更新API |
| `backend/spec/requests/api/v1/profile_spec.rb` | プロフィール更新のrequest spec |
| `backend/spec/requests/api/v1/favorite_works_spec.rb` | ベスト5APIのrequest spec |

### バックエンド（変更）

| ファイル | 変更内容 |
|---------|---------|
| `backend/app/models/user.rb` | `has_many :favorite_works` 追加、bio バリデーション追加 |
| `backend/config/routes.rb` | `resource :profile` と `favorite_works` ルート追加 |
| `backend/app/controllers/api/v1/profiles_controller.rb` | `favorite_works` データを show に含める |

### フロントエンド（新規作成）

| ファイル | 役割 |
|---------|------|
| `frontend/src/lib/profileApi.ts` | プロフィール更新・ベスト5 API呼び出し |
| `frontend/src/components/ui/ToggleSwitch/ToggleSwitch.tsx` | トグルスイッチUI |
| `frontend/src/components/ui/ToggleSwitch/ToggleSwitch.module.css` | トグルスイッチCSS |
| `frontend/src/components/FavoriteWorks/FavoriteWorks.tsx` | ベスト5表示・編集 |
| `frontend/src/components/FavoriteWorks/FavoriteWorks.module.css` | ベスト5 CSS |
| `frontend/src/components/FavoriteWorkSelector/FavoriteWorkSelector.tsx` | 作品選択モーダル |
| `frontend/src/components/FavoriteWorkSelector/FavoriteWorkSelector.module.css` | モーダル CSS |

### フロントエンド（変更）

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/lib/types.ts` | `FavoriteWork` 型、 `FavoriteWorksResponse` 型追加 |
| `frontend/src/components/UserProfileHeader/UserProfileHeader.tsx` | `isOwner` prop追加、アバターホバー編集、bioインライン編集 |
| `frontend/src/components/UserProfileHeader/UserProfileHeader.module.css` | 編集UI用CSS追加 |
| `frontend/src/pages/UserProfilePage/UserProfilePage.tsx` | ベスト5コンポーネント統合、isOwner判定 |
| `frontend/src/hooks/useUserProfile.ts` | favorite_works データ取得追加 |
| `frontend/src/styles/tokens.css` | ランキングバッジ色のCSS変数追加 |

---

## Task 1: DBマイグレーション + FavoriteWorkモデル

**Files:**
- Create: `backend/db/migrate/XXXXXX_add_favorite_display_mode_to_users.rb`
- Create: `backend/db/migrate/XXXXXX_create_favorite_works.rb`
- Create: `backend/app/models/favorite_work.rb`
- Modify: `backend/app/models/user.rb`

- [ ] **Step 1: users テーブルにカラム追加するマイグレーション作成**

```bash
cd backend && bin/rails generate migration AddFavoriteDisplayModeToUsers favorite_display_mode:string
```

生成されたマイグレーションファイルを以下のように編集:

```ruby
class AddFavoriteDisplayModeToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :favorite_display_mode, :string, default: 'ranking', null: false
  end
end
```

- [ ] **Step 2: favorite_works テーブルのマイグレーション作成**

```bash
bin/rails generate migration CreateFavoriteWorks
```

生成されたファイルを編集:

```ruby
class CreateFavoriteWorks < ActiveRecord::Migration[8.0]
  def change
    create_table :favorite_works do |t|
      t.references :user, null: false, foreign_key: true
      t.references :work, null: false, foreign_key: true
      t.integer :position, null: false

      t.timestamps
    end

    add_index :favorite_works, %i[user_id work_id], unique: true
    add_index :favorite_works, %i[user_id position], unique: true
  end
end
```

- [ ] **Step 3: マイグレーション実行**

```bash
bin/rails db:migrate
```

Expected: マイグレーションが成功し、`schema.rb` に `favorite_works` テーブルと `users.favorite_display_mode` カラムが追加される

- [ ] **Step 4: FavoriteWork モデル作成**

`backend/app/models/favorite_work.rb`:

```ruby
# frozen_string_literal: true

class FavoriteWork < ApplicationRecord
  belongs_to :user
  belongs_to :work

  validates :position, presence: true,
                       inclusion: { in: 1..5 },
                       uniqueness: { scope: :user_id }
  validates :work_id, uniqueness: { scope: :user_id }
end
```

- [ ] **Step 5: User モデルにアソシエーションとバリデーション追加**

`backend/app/models/user.rb` に以下を追加:

`has_many :favorite_works, dependent: :destroy` を既存の `has_many` の下に追加。
`validates :bio, length: { maximum: 100 }` を既存の validates の下に追加。
`validates :favorite_display_mode, inclusion: { in: %w[ranking favorites] }` を追加。

```ruby
has_many :favorite_works, dependent: :destroy

validates :bio, length: { maximum: 100 }
validates :favorite_display_mode, inclusion: { in: %w[ranking favorites] }
```

- [ ] **Step 6: コミット**

```bash
git add -A && git commit -m "feat: FavoriteWorkモデルとマイグレーション追加 #89"
```

---

## Task 2: プロフィール更新API（バックエンド）

**Files:**
- Create: `backend/spec/requests/api/v1/profile_spec.rb`
- Create: `backend/app/controllers/api/v1/profile_controller.rb`
- Modify: `backend/config/routes.rb`

- [ ] **Step 1: request spec を書く（テストファースト）**

`backend/spec/requests/api/v1/profile_spec.rb`:

```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Profile', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }

  describe 'PATCH /api/v1/profile' do
    context '認証済みの場合' do
      before { sign_in user }

      it 'bioを更新できる' do
        patch '/api/v1/profile', params: { profile: { bio: '自己紹介テスト' } }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['user']['bio']).to eq('自己紹介テスト')
        expect(user.reload.bio).to eq('自己紹介テスト')
      end

      it 'avatar_urlを更新できる' do
        patch '/api/v1/profile', params: { profile: { avatar_url: 'uploads/avatars/test.jpg' } }
        expect(response).to have_http_status(:ok)
        expect(user.reload.avatar_url).to eq('uploads/avatars/test.jpg')
      end

      it 'favorite_display_modeを更新できる' do
        patch '/api/v1/profile', params: { profile: { favorite_display_mode: 'favorites' } }
        expect(response).to have_http_status(:ok)
        expect(user.reload.favorite_display_mode).to eq('favorites')
      end

      it 'bioが100文字を超えるとエラー' do
        patch '/api/v1/profile', params: { profile: { bio: 'あ' * 101 } }
        expect(response).to have_http_status(:unprocessable_content)
      end

      it '不正なfavorite_display_modeはエラー' do
        patch '/api/v1/profile', params: { profile: { favorite_display_mode: 'invalid' } }
        expect(response).to have_http_status(:unprocessable_content)
      end

      it 'avatar_urlを空にするとnilになる' do
        user.update!(avatar_url: 'uploads/avatars/old.jpg')
        patch '/api/v1/profile', params: { profile: { avatar_url: '' } }
        expect(response).to have_http_status(:ok)
        expect(user.reload.avatar_url).to be_nil
      end
    end

    context '未認証の場合' do
      it '401を返す' do
        patch '/api/v1/profile', params: { profile: { bio: 'test' } }
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'POST /api/v1/profile/presign_avatar' do
    before { sign_in user }

    it '署名付きURLを返す' do
      post '/api/v1/profile/presign_avatar', params: {
        image: { file_name: 'avatar.jpg', content_type: 'image/jpeg', file_size: 500_000 }
      }
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['presigned_url']).to be_present
      expect(json['s3_key']).to start_with('uploads/avatars/')
    end

    it '対応していないファイル形式はエラー' do
      post '/api/v1/profile/presign_avatar', params: {
        image: { file_name: 'avatar.bmp', content_type: 'image/bmp', file_size: 500_000 }
      }
      expect(response).to have_http_status(:unprocessable_content)
    end

    it '10MBを超えるファイルはエラー' do
      post '/api/v1/profile/presign_avatar', params: {
        image: { file_name: 'avatar.jpg', content_type: 'image/jpeg', file_size: 11_000_000 }
      }
      expect(response).to have_http_status(:unprocessable_content)
    end
  end
end
```

- [ ] **Step 2: テスト実行して失敗を確認**

```bash
cd backend && bundle exec rspec spec/requests/api/v1/profile_spec.rb
```

Expected: FAIL（ルートとコントローラーが未定義）

- [ ] **Step 3: ルーティング追加**

`backend/config/routes.rb` の `namespace :api` → `namespace :v1` 内に追加:

```ruby
resource :profile, only: [:update], controller: 'profile' do
  post :presign_avatar
end
```

- [ ] **Step 4: ProfileController 実装**

`backend/app/controllers/api/v1/profile_controller.rb`:

```ruby
# frozen_string_literal: true

module Api
  module V1
    class ProfileController < ApplicationController
      before_action :authenticate_user!

      ALLOWED_CONTENT_TYPES = %w[image/jpeg image/png image/gif image/webp].freeze
      MAX_FILE_SIZE = 10.megabytes

      # PATCH /api/v1/profile
      def update
        # 空文字のavatar_urlはnilに変換（画像削除）
        if profile_params.key?(:avatar_url) && profile_params[:avatar_url].blank?
          current_user.avatar_url = nil
        end

        if current_user.update(profile_params.reject { |k, v| k == 'avatar_url' && v.blank? })
          render json: { user: user_json(current_user) }
        else
          render json: { errors: current_user.errors.full_messages }, status: :unprocessable_content
        end
      end

      # POST /api/v1/profile/presign_avatar
      def presign_avatar
        content_type = avatar_presign_params[:content_type]
        file_size = avatar_presign_params[:file_size].to_i
        file_name = avatar_presign_params[:file_name]

        unless ALLOWED_CONTENT_TYPES.include?(content_type)
          return render json: { error: '対応していないファイル形式です' }, status: :unprocessable_content
        end

        if file_size > MAX_FILE_SIZE
          return render json: { error: 'ファイルサイズが10MBを超えています' }, status: :unprocessable_content
        end

        extension = File.extname(file_name).delete('.')
        s3_key = "uploads/avatars/#{current_user.id}/#{SecureRandom.uuid}.#{extension}"
        presigned_url = S3PresignService.presign_put(s3_key, content_type)

        render json: { presigned_url: presigned_url, s3_key: s3_key }
      end

      private

      def profile_params
        params.expect(profile: %i[bio avatar_url favorite_display_mode])
      end

      def avatar_presign_params
        params.expect(image: %i[file_name content_type file_size])
      end
    end
  end
end
```

- [ ] **Step 5: テスト実行してパスを確認**

```bash
bundle exec rspec spec/requests/api/v1/profile_spec.rb
```

Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add -A && git commit -m "feat: プロフィール更新API追加（PATCH /api/v1/profile） #89"
```

---

## Task 3: お気に入り作品API（バックエンド）

**Files:**
- Create: `backend/spec/requests/api/v1/favorite_works_spec.rb`
- Create: `backend/app/controllers/api/v1/favorite_works_controller.rb`
- Modify: `backend/config/routes.rb`
- Modify: `backend/app/controllers/api/v1/profiles_controller.rb`
- Modify: `backend/app/controllers/application_controller.rb`

- [ ] **Step 1: request spec を書く**

`backend/spec/requests/api/v1/favorite_works_spec.rb`:

```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::FavoriteWorks', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work1) { Work.create!(title: 'テストアニメ1', media_type: :anime) }
  let(:work2) { Work.create!(title: 'テスト映画1', media_type: :movie) }
  let(:work3) { Work.create!(title: 'テストドラマ1', media_type: :drama) }

  describe 'GET /api/v1/users/:id/favorite_works' do
    it 'お気に入り作品を position 順で返す' do
      FavoriteWork.create!(user: user, work: work2, position: 2)
      FavoriteWork.create!(user: user, work: work1, position: 1)

      get "/api/v1/users/#{user.id}/favorite_works"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['favorite_works'].length).to eq(2)
      expect(json['favorite_works'][0]['position']).to eq(1)
      expect(json['favorite_works'][0]['work']['title']).to eq('テストアニメ1')
      expect(json['favorite_works'][1]['position']).to eq(2)
      expect(json['display_mode']).to eq('ranking')
    end

    it '認証なしでもアクセスできる' do
      get "/api/v1/users/#{user.id}/favorite_works"
      expect(response).to have_http_status(:ok)
    end

    it '存在しないユーザーは404' do
      get '/api/v1/users/999999/favorite_works'
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'PUT /api/v1/profile/favorite_works' do
    before { sign_in user }

    it 'お気に入り作品を一括設定できる' do
      put '/api/v1/profile/favorite_works', params: {
        favorite_works: [
          { work_id: work1.id, position: 1 },
          { work_id: work2.id, position: 2 }
        ]
      }
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['favorite_works'].length).to eq(2)
      expect(user.favorite_works.count).to eq(2)
    end

    it '既存のお気に入りを置き換える' do
      FavoriteWork.create!(user: user, work: work1, position: 1)
      FavoriteWork.create!(user: user, work: work2, position: 2)

      put '/api/v1/profile/favorite_works', params: {
        favorite_works: [
          { work_id: work3.id, position: 1 }
        ]
      }
      expect(response).to have_http_status(:ok)
      expect(user.favorite_works.count).to eq(1)
      expect(user.favorite_works.first.work).to eq(work3)
    end

    it '空配列で全削除できる' do
      FavoriteWork.create!(user: user, work: work1, position: 1)

      put '/api/v1/profile/favorite_works', params: { favorite_works: [] }
      expect(response).to have_http_status(:ok)
      expect(user.favorite_works.count).to eq(0)
    end

    it '6件以上はエラー' do
      works = (1..6).map { |i| Work.create!(title: "作品#{i}", media_type: :anime) }
      put '/api/v1/profile/favorite_works', params: {
        favorite_works: works.each_with_index.map { |w, i| { work_id: w.id, position: i + 1 } }
      }
      expect(response).to have_http_status(:unprocessable_content)
    end

    it '同じwork_idの重複はエラー' do
      put '/api/v1/profile/favorite_works', params: {
        favorite_works: [
          { work_id: work1.id, position: 1 },
          { work_id: work1.id, position: 2 }
        ]
      }
      expect(response).to have_http_status(:unprocessable_content)
    end

    it '未認証の場合401' do
      sign_out user
      put '/api/v1/profile/favorite_works', params: { favorite_works: [] }
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
```

- [ ] **Step 2: テスト実行して失敗を確認**

```bash
bundle exec rspec spec/requests/api/v1/favorite_works_spec.rb
```

Expected: FAIL

- [ ] **Step 3: ルーティング追加**

`backend/config/routes.rb` に追加。既存の `resources :users` ブロック内に `favorite_works` を追加し、`resource :profile` ブロックに `put :favorite_works` を追加:

既存:
```ruby
resources :users, only: [:show], controller: 'profiles' do
  resources :records, only: [:index], controller: 'user_records'
end
```

変更後:
```ruby
resources :users, only: [:show], controller: 'profiles' do
  resources :records, only: [:index], controller: 'user_records'
  resources :favorite_works, only: [:index], controller: 'favorite_works'
end
```

既存の `resource :profile` に追加:
```ruby
resource :profile, only: [:update], controller: 'profile' do
  post :presign_avatar
  put :favorite_works, action: :update_favorite_works
end
```

- [ ] **Step 4: ApplicationController に共通メソッド追加**

`backend/app/controllers/application_controller.rb` に `favorite_work_json` と `resolve_avatar_url` を追加（複数コントローラーで使うため）:

```ruby
# お気に入り作品のJSON表現
def favorite_work_json(fw)
  {
    id: fw.id,
    position: fw.position,
    work: {
      id: fw.work.id,
      title: fw.work.title,
      media_type: fw.work.media_type,
      cover_image_url: fw.work.resolved_cover_image_url
    }
  }
end

# avatar_urlがS3キーの場合、署名付きURLに変換する
def resolve_avatar_url(avatar_url)
  return nil if avatar_url.blank?
  return avatar_url unless avatar_url.start_with?('uploads/')

  S3PresignService.presign_get(avatar_url)
end
```

- [ ] **Step 5: FavoriteWorksController 実装**

`backend/app/controllers/api/v1/favorite_works_controller.rb`:

```ruby
# frozen_string_literal: true

module Api
  module V1
    class FavoriteWorksController < ApplicationController
      # GET /api/v1/users/:user_id/favorite_works（認証不要）

      def index
        user = User.find(params[:user_id])
        favorite_works = user.favorite_works.includes(:work).order(:position)

        render json: {
          favorite_works: favorite_works.map { |fw| favorite_work_json(fw) },
          display_mode: user.favorite_display_mode
        }
      end
    end
  end
end
```

- [ ] **Step 6: ProfileController に `update_favorite_works` アクション追加**

`backend/app/controllers/api/v1/profile_controller.rb` に追加:

```ruby
# PUT /api/v1/profile/favorite_works
def update_favorite_works
  items = params[:favorite_works] || []

  if items.length > 5
    return render json: { error: 'お気に入りは最大5件です' }, status: :unprocessable_content
  end

  work_ids = items.map { |item| item[:work_id].to_i }
  if work_ids.uniq.length != work_ids.length
    return render json: { error: '同じ作品を複数回選択できません' }, status: :unprocessable_content
  end

  ActiveRecord::Base.transaction do
    current_user.favorite_works.destroy_all
    items.each do |item|
      current_user.favorite_works.create!(
        work_id: item[:work_id],
        position: item[:position]
      )
    end
  end

  favorite_works = current_user.favorite_works.includes(:work).order(:position)
  render json: {
    favorite_works: favorite_works.map { |fw| favorite_work_json(fw) }
  }
rescue ActiveRecord::RecordInvalid => e
  render json: { error: e.message }, status: :unprocessable_content
end
```

- [ ] **Step 7: ProfilesController#show で avatar_url を署名付きURLに変換**

`backend/app/controllers/api/v1/profiles_controller.rb` の `show` メソッド内の `render json` を修正:

```ruby
render json: {
  user: {
    id: user.id, username: user.username, bio: user.bio,
    avatar_url: resolve_avatar_url(user.avatar_url), created_at: user.created_at
  },
  statistics: build_statistics(records.where(visibility: :public_record))
}
```

同様に、`backend/app/controllers/application_controller.rb` の `user_json` メソッドも修正:

```ruby
def user_json(user)
  user.as_json(only: %i[id username email bio created_at]).merge(
    avatar_url: resolve_avatar_url(user.avatar_url),
    has_password: user.encrypted_password.present?,
    providers: user.user_providers.pluck(:provider),
    email_missing: user.email.blank?
  )
end
```

- [ ] **Step 8: テスト実行してパスを確認**

```bash
bundle exec rspec spec/requests/api/v1/favorite_works_spec.rb
```

Expected: ALL PASS

- [ ] **Step 9: RuboCop 実行**

```bash
bundle exec rubocop app/models/favorite_work.rb app/controllers/api/v1/profile_controller.rb app/controllers/api/v1/favorite_works_controller.rb app/controllers/application_controller.rb
```

Expected: no offenses

- [ ] **Step 10: コミット**

```bash
git add -A && git commit -m "feat: お気に入り作品API追加（GET/PUT） #89"
```

---

## Task 4: フロントエンド型定義 + API クライアント

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/profileApi.ts`
- Modify: `frontend/src/styles/tokens.css`

- [ ] **Step 1: 型定義追加**

`frontend/src/lib/types.ts` の末尾に追加:

```typescript
// お気に入り作品
export interface FavoriteWorkItem {
  id: number
  position: number
  work: WorkSummary
}

export type FavoriteDisplayMode = 'ranking' | 'favorites'

export interface FavoriteWorksResponse {
  favorite_works: FavoriteWorkItem[]
  display_mode: FavoriteDisplayMode
}
```

- [ ] **Step 2: profileApi 作成**

`frontend/src/lib/profileApi.ts`:

```typescript
import type { AuthResponse, FavoriteWorksResponse, PresignResponse } from './types'
import { request } from './api'

export const profileApi = {
  // プロフィール更新（bio, avatar_url, favorite_display_mode）
  update(params: {
    bio?: string
    avatar_url?: string | null
    favorite_display_mode?: 'ranking' | 'favorites'
  }): Promise<AuthResponse> {
    return request<AuthResponse>('/profile', {
      method: 'PATCH',
      body: JSON.stringify({ profile: params }),
    })
  },

  // アバター用署名付きURL発行
  presignAvatar(fileName: string, contentType: string, fileSize: number): Promise<PresignResponse> {
    return request<PresignResponse>('/profile/presign_avatar', {
      method: 'POST',
      body: JSON.stringify({
        image: { file_name: fileName, content_type: contentType, file_size: fileSize },
      }),
    })
  },

  // お気に入り作品取得
  getFavoriteWorks(userId: number): Promise<FavoriteWorksResponse> {
    return request<FavoriteWorksResponse>(`/users/${userId}/favorite_works`)
  },

  // お気に入り作品一括更新
  updateFavoriteWorks(
    items: Array<{ work_id: number; position: number }>,
  ): Promise<{ favorite_works: FavoriteWorksResponse['favorite_works'] }> {
    return request<{ favorite_works: FavoriteWorksResponse['favorite_works'] }>(
      '/profile/favorite_works',
      {
        method: 'PUT',
        body: JSON.stringify({ favorite_works: items }),
      },
    )
  },
}
```

- [ ] **Step 3: tokens.css にランキングバッジ色を追加**

`frontend/src/styles/tokens.css` のカラー変数セクションに追加:

```css
/* ランキングバッジ */
--color-rank-gold: #d4a012;
--color-rank-silver: #9e9e9e;
--color-rank-bronze: #b07d4b;
--color-rank-default: #d0d0d0;
```

- [ ] **Step 4: コミット**

```bash
git add -A && git commit -m "feat: プロフィール編集の型定義・APIクライアント・デザイントークン追加 #89"
```

---

## Task 5: UserProfileHeader 拡張（アバター + bio 編集）

**Files:**
- Modify: `frontend/src/components/UserProfileHeader/UserProfileHeader.tsx`
- Modify: `frontend/src/components/UserProfileHeader/UserProfileHeader.module.css`

- [ ] **Step 1: UserProfileHeader.tsx を拡張**

`frontend/src/components/UserProfileHeader/UserProfileHeader.tsx` を以下に書き換え:

```typescript
import { useState, useRef } from 'react'
import type { UserProfile } from '../../lib/types'
import { profileApi } from '../../lib/profileApi'
import { imagesApi } from '../../lib/imagesApi'
import { Button } from '../ui/Button/Button'
import styles from './UserProfileHeader.module.css'

type UserProfileHeaderProps = {
  profile: UserProfile
  isOwner: boolean
  onProfileUpdate?: (updates: Partial<UserProfile>) => void
}

const BIO_MAX_LENGTH = 100
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/** 参加年月を「2026年3月から利用」形式で返す */
function formatJoinDate(createdAt: string): string {
  const date = new Date(createdAt)
  const formatted = date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
  })
  return `${formatted}から利用`
}

export function UserProfileHeader({ profile, isOwner, onProfileUpdate }: UserProfileHeaderProps) {
  const initial = profile.username.charAt(0).toUpperCase()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // bio編集状態
  const [isEditingBio, setIsEditingBio] = useState(false)
  const [bioValue, setBioValue] = useState(profile.bio ?? '')
  const [bioError, setBioError] = useState<string | null>(null)
  const [isSavingBio, setIsSavingBio] = useState(false)

  // アバターアップロード状態
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const handleAvatarClick = () => {
    if (!isOwner || isUploadingAvatar) return
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // ファイル選択をリセット（同じファイルを再選択可能にする）
    e.target.value = ''

    if (!ALLOWED_TYPES.includes(file.type)) {
      setAvatarError('JPEG, PNG, GIF, WebPのみ対応しています')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setAvatarError('ファイルサイズは10MB以下にしてください')
      return
    }

    setAvatarError(null)
    setIsUploadingAvatar(true)

    try {
      // S3に直接アップロード
      const { presigned_url, s3_key } = await profileApi.presignAvatar(
        file.name,
        file.type,
        file.size,
      )
      await imagesApi.uploadToS3(presigned_url, file)

      // プロフィール更新
      await profileApi.update({ avatar_url: s3_key })
      onProfileUpdate?.({ avatar_url: presigned_url })
    } catch {
      setAvatarError('アップロードに失敗しました')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleBioSave = async () => {
    setBioError(null)
    setIsSavingBio(true)

    try {
      const trimmed = bioValue.trim()
      await profileApi.update({ bio: trimmed || '' })
      onProfileUpdate?.({ bio: trimmed || null })
      setIsEditingBio(false)
    } catch {
      setBioError('保存に失敗しました')
    } finally {
      setIsSavingBio(false)
    }
  }

  const handleBioCancel = () => {
    setBioValue(profile.bio ?? '')
    setBioError(null)
    setIsEditingBio(false)
  }

  const startEditBio = () => {
    setBioValue(profile.bio ?? '')
    setIsEditingBio(true)
  }

  return (
    <header className={styles.header}>
      <div
        className={`${styles.avatar} ${isOwner ? styles.avatarEditable : ''}`}
        onClick={handleAvatarClick}
        role={isOwner ? 'button' : undefined}
        tabIndex={isOwner ? 0 : undefined}
        aria-label={isOwner ? 'アバター画像を変更' : undefined}
        onKeyDown={isOwner ? (e) => { if (e.key === 'Enter') handleAvatarClick() } : undefined}
      >
        {profile.avatar_url ? (
          <img
            className={styles.avatarImage}
            src={profile.avatar_url}
            alt={`${profile.username}のアバター`}
          />
        ) : (
          <span className={styles.avatarInitial}>{initial}</span>
        )}
        {isOwner && (
          <div className={styles.avatarOverlay}>
            <span className={styles.cameraIcon}>📷</span>
          </div>
        )}
        {isUploadingAvatar && (
          <div className={styles.avatarOverlay}>
            <span className={styles.uploadingText}>...</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className={styles.fileInput}
          onChange={(e) => void handleFileSelect(e)}
        />
      </div>

      <div className={styles.info}>
        <h1 className={styles.username}>{profile.username}</h1>

        {/* bio表示・編集 */}
        {isEditingBio ? (
          <div className={styles.bioEdit}>
            <textarea
              className={styles.bioTextarea}
              value={bioValue}
              onChange={(e) => setBioValue(e.target.value)}
              maxLength={BIO_MAX_LENGTH}
              rows={2}
              autoFocus
            />
            <div className={styles.bioEditFooter}>
              <span className={styles.charCount}>
                {bioValue.length} / {BIO_MAX_LENGTH}
              </span>
              <div className={styles.bioEditActions}>
                <Button variant="secondary" size="sm" onClick={handleBioCancel} disabled={isSavingBio}>
                  キャンセル
                </Button>
                <Button variant="primary" size="sm" onClick={() => void handleBioSave()} disabled={isSavingBio}>
                  {isSavingBio ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
            {bioError && <p className={styles.error}>{bioError}</p>}
          </div>
        ) : (
          <>
            {profile.bio ? (
              <p className={styles.bio}>
                {profile.bio}
                {isOwner && (
                  <button
                    type="button"
                    className={styles.editBioButton}
                    onClick={startEditBio}
                    aria-label="自己紹介を編集"
                  >
                    ✏️
                  </button>
                )}
              </p>
            ) : isOwner ? (
              <button
                type="button"
                className={styles.addBioButton}
                onClick={startEditBio}
              >
                ＋ 自己紹介を追加
              </button>
            ) : null}
          </>
        )}

        <span className={styles.joinDate}>{formatJoinDate(profile.created_at)}</span>
      </div>

      {avatarError && <p className={styles.avatarError}>{avatarError}</p>}
    </header>
  )
}
```

- [ ] **Step 2: CSS追加**

`frontend/src/components/UserProfileHeader/UserProfileHeader.module.css` に以下を追加:

```css
/* アバター編集 */
.avatarEditable {
  cursor: pointer;
  position: relative;
}

.avatarOverlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.avatarEditable:hover .avatarOverlay,
.avatarEditable:focus-visible .avatarOverlay {
  opacity: 1;
}

.cameraIcon {
  font-size: var(--font-size-h3);
  filter: grayscale(1) brightness(10);
}

.uploadingText {
  color: var(--color-bg-white);
  font-family: var(--font-body);
  font-size: var(--font-size-label);
}

.fileInput {
  display: none;
}

/* bio編集 */
.bioEdit {
  width: 100%;
  max-width: 400px;
}

.bioTextarea {
  width: 100%;
  padding: var(--spacing-sm);
  border: var(--border-width-thin) solid var(--color-border-light);
  border-radius: 6px;
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  color: var(--color-text);
  line-height: var(--line-height-normal);
  resize: none;
  box-sizing: border-box;
}

.bioTextarea:focus {
  outline: none;
  border-color: var(--color-text);
}

.bioEditFooter {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--spacing-xs);
}

.charCount {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
}

.bioEditActions {
  display: flex;
  gap: var(--spacing-xs);
}

.editBioButton {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 var(--spacing-xs);
  font-size: var(--font-size-meta);
  opacity: 0.5;
  transition: opacity var(--transition-fast);
}

.editBioButton:hover {
  opacity: 1;
}

.addBioButton {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  font-style: italic;
  transition: color var(--transition-fast);
}

.addBioButton:hover {
  color: var(--color-text);
}

.error {
  color: var(--color-error);
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  margin-top: var(--spacing-xs);
}

.avatarError {
  color: var(--color-error);
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  margin-top: var(--spacing-xs);
  flex-basis: 100%;
}
```

- [ ] **Step 3: ESLint + Prettier 確認**

```bash
cd frontend && npx eslint src/components/UserProfileHeader/UserProfileHeader.tsx && npx prettier --check src/components/UserProfileHeader/
```

Expected: no errors

- [ ] **Step 4: コミット**

```bash
git add -A && git commit -m "feat: UserProfileHeader にアバター・bio編集UI追加 #89"
```

---

## Task 6: ToggleSwitch 共通コンポーネント

**Files:**
- Create: `frontend/src/components/ui/ToggleSwitch/ToggleSwitch.tsx`
- Create: `frontend/src/components/ui/ToggleSwitch/ToggleSwitch.module.css`

- [ ] **Step 1: ToggleSwitch.tsx 作成**

```typescript
import styles from './ToggleSwitch.module.css'

type ToggleSwitchProps = {
  leftLabel: string
  rightLabel: string
  isRight: boolean
  onChange: (isRight: boolean) => void
  disabled?: boolean
}

export function ToggleSwitch({
  leftLabel,
  rightLabel,
  isRight,
  onChange,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <div className={styles.container}>
      <span className={`${styles.label} ${!isRight ? styles.labelActive : ''}`}>
        {leftLabel}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isRight}
        aria-label={`${leftLabel}と${rightLabel}を切り替え`}
        className={styles.track}
        onClick={() => onChange(!isRight)}
        disabled={disabled}
      >
        <span className={`${styles.thumb} ${isRight ? styles.thumbRight : ''}`} />
      </button>
      <span className={`${styles.label} ${isRight ? styles.labelActive : ''}`}>
        {rightLabel}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: ToggleSwitch.module.css 作成**

```css
.container {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.label {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
  user-select: none;
}

.labelActive {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.track {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: var(--color-text);
  border: none;
  cursor: pointer;
  position: relative;
  padding: 0;
  transition: background var(--transition-fast);
  flex-shrink: 0;
}

.track:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.thumb {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-bg-white);
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform var(--transition-fast);
}

.thumbRight {
  transform: translateX(16px);
}
```

- [ ] **Step 3: コミット**

```bash
git add -A && git commit -m "feat: ToggleSwitch共通コンポーネント追加 #89"
```

---

## Task 7: FavoriteWorks 表示コンポーネント

**Files:**
- Create: `frontend/src/components/FavoriteWorks/FavoriteWorks.tsx`
- Create: `frontend/src/components/FavoriteWorks/FavoriteWorks.module.css`

- [ ] **Step 1: FavoriteWorks.tsx 作成**

```typescript
import { useState } from 'react'
import type { FavoriteWorkItem, FavoriteDisplayMode } from '../../lib/types'
import { profileApi } from '../../lib/profileApi'
import { ToggleSwitch } from '../ui/ToggleSwitch/ToggleSwitch'
import { Button } from '../ui/Button/Button'
import styles from './FavoriteWorks.module.css'

type FavoriteWorksProps = {
  favoriteWorks: FavoriteWorkItem[]
  displayMode: FavoriteDisplayMode
  isOwner: boolean
  onOpenSelector: () => void
  onRemove: (workId: number) => void
  onDisplayModeChange: (mode: FavoriteDisplayMode) => void
}

const RANK_CLASSES = ['rankGold', 'rankSilver', 'rankBronze', 'rankDefault', 'rankDefault'] as const

export function FavoriteWorks({
  favoriteWorks,
  displayMode,
  isOwner,
  onOpenSelector,
  onRemove,
  onDisplayModeChange,
}: FavoriteWorksProps) {
  const [isSwitching, setIsSwitching] = useState(false)

  // 他人のページでお気に入り未設定の場合は非表示
  if (!isOwner && favoriteWorks.length === 0) {
    return null
  }

  const handleModeToggle = async (isRight: boolean) => {
    const newMode: FavoriteDisplayMode = isRight ? 'favorites' : 'ranking'
    setIsSwitching(true)
    try {
      await profileApi.update({ favorite_display_mode: newMode })
      onDisplayModeChange(newMode)
    } catch {
      // 失敗時はUIを戻さない（楽観的更新なし）
    } finally {
      setIsSwitching(false)
    }
  }

  const isRanking = displayMode === 'ranking'
  const sectionTitle = isRanking ? 'マイベスト5' : 'お気に入り'
  const emptySlots = 5 - favoriteWorks.length

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>{sectionTitle}</h2>
        {isOwner && (
          <ToggleSwitch
            leftLabel="ランキング"
            rightLabel="お気に入り"
            isRight={displayMode === 'favorites'}
            onChange={handleModeToggle}
            disabled={isSwitching}
          />
        )}
      </div>

      {favoriteWorks.length === 0 && isOwner ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            お気に入りの作品をライブラリから選んで表示しましょう
          </p>
          <Button variant="primary" size="sm" onClick={onOpenSelector}>
            ＋ 作品を追加
          </Button>
        </div>
      ) : (
        <div className={styles.grid}>
          {favoriteWorks.map((fw, index) => (
            <div key={fw.id} className={styles.workItem}>
              {isRanking && (
                <span className={`${styles.rankBadge} ${styles[RANK_CLASSES[index]]}`}>
                  {fw.position}
                </span>
              )}
              <div
                className={`${styles.coverWrapper} ${isRanking && index === 0 ? styles.coverGold : ''}`}
              >
                {fw.work.cover_image_url ? (
                  <img
                    className={styles.coverImage}
                    src={fw.work.cover_image_url}
                    alt={fw.work.title}
                  />
                ) : (
                  <div className={styles.coverPlaceholder}>
                    {fw.work.title.charAt(0)}
                  </div>
                )}
                {isOwner && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => onRemove(fw.work.id)}
                    aria-label={`${fw.work.title}を削除`}
                  >
                    ✕
                  </button>
                )}
              </div>
              <span className={styles.workTitle}>{fw.work.title}</span>
            </div>
          ))}

          {isOwner && emptySlots > 0 && (
            <div className={styles.workItem}>
              <button
                type="button"
                className={styles.addSlot}
                onClick={onOpenSelector}
                aria-label="作品を追加"
              >
                ＋
              </button>
              <span className={styles.workTitle}>追加</span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: FavoriteWorks.module.css 作成**

```css
.section {
  margin-bottom: var(--spacing-xl);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
}

.title {
  font-family: var(--font-heading);
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0;
}

.grid {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.workItem {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  width: 72px;
}

.rankBadge {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  font-weight: var(--font-weight-bold);
  color: var(--color-bg-white);
  padding: 1px 7px;
  border-radius: 8px;
  z-index: 1;
}

.rankGold {
  background: var(--color-rank-gold);
}

.rankSilver {
  background: var(--color-rank-silver);
}

.rankBronze {
  background: var(--color-rank-bronze);
}

.rankDefault {
  background: var(--color-rank-default);
  color: var(--color-text-muted);
}

.coverWrapper {
  width: 72px;
  height: 100px;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  background: var(--color-border-light);
}

.coverGold {
  border: 2px solid var(--color-rank-gold);
}

.coverImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.coverPlaceholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-heading);
  font-size: var(--font-size-h3);
  color: var(--color-text-muted);
  background: var(--color-border-light);
}

.removeButton {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: var(--color-bg-white);
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.coverWrapper:hover .removeButton {
  opacity: 1;
}

.workTitle {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text);
  margin-top: var(--spacing-xs);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.addSlot {
  width: 72px;
  height: 100px;
  border: var(--border-width) dashed var(--color-border-light);
  border-radius: 6px;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-h3);
  color: var(--color-text-muted);
  transition: border-color var(--transition-fast), color var(--transition-fast);
}

.addSlot:hover {
  border-color: var(--color-text);
  color: var(--color-text);
}

.empty {
  padding: var(--spacing-xl);
  border: var(--border-width) dashed var(--color-border-light);
  border-radius: 8px;
  text-align: center;
}

.emptyText {
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-md);
}

@media (max-width: 768px) {
  .workItem {
    width: 60px;
  }

  .coverWrapper {
    width: 60px;
    height: 84px;
  }

  .addSlot {
    width: 60px;
    height: 84px;
  }
}
```

- [ ] **Step 3: コミット**

```bash
git add -A && git commit -m "feat: FavoriteWorks表示コンポーネント追加 #89"
```

---

## Task 8: FavoriteWorkSelector モーダル

**Files:**
- Create: `frontend/src/components/FavoriteWorkSelector/FavoriteWorkSelector.tsx`
- Create: `frontend/src/components/FavoriteWorkSelector/FavoriteWorkSelector.module.css`

- [ ] **Step 1: FavoriteWorkSelector.tsx 作成**

```typescript
import { useEffect, useState } from 'react'
import type { MediaType, PublicRecord, WorkSummary } from '../../lib/types'
import { request } from '../../lib/api'
import { GENRE_FILTERS } from '../../pages/SearchPage/genreFilters'
import styles from './FavoriteWorkSelector.module.css'

type FavoriteWorkSelectorProps = {
  isOpen: boolean
  onClose: () => void
  onSelect: (work: WorkSummary) => void
  excludeWorkIds: number[]
}

export function FavoriteWorkSelector({
  isOpen,
  onClose,
  onSelect,
  excludeWorkIds,
}: FavoriteWorkSelectorProps) {
  const [records, setRecords] = useState<PublicRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mediaType, setMediaType] = useState<MediaType | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setIsLoading(true)

    const fetchRecords = async () => {
      try {
        // ユーザー自身の全記録を取得（認証済みエンドポイント使用）
        const params = new URLSearchParams({ per_page: '100' })
        if (mediaType) params.set('media_type', mediaType)
        const res = await request<{ records: PublicRecord[] }>(`/records?${params.toString()}`)
        setRecords(res.records)
      } catch {
        setRecords([])
      } finally {
        setIsLoading(false)
      }
    }

    void fetchRecords()
  }, [isOpen, mediaType])

  if (!isOpen) return null

  const filtered = records.filter((r) => {
    if (excludeWorkIds.includes(r.work.id)) return false
    if (searchQuery) {
      return r.work.title.toLowerCase().includes(searchQuery.toLowerCase())
    }
    return true
  })

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>作品を選択</h3>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <input
          type="text"
          className={styles.searchInput}
          placeholder="作品名で絞り込み..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className={styles.genreFilters}>
          {GENRE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`${styles.filterButton} ${
                (mediaType ?? 'all') === filter.value ? styles.filterActive : ''
              }`}
              onClick={() =>
                setMediaType(filter.value === 'all' ? null : (filter.value as MediaType))
              }
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className={styles.workGrid}>
          {isLoading ? (
            <p className={styles.loadingText}>読み込み中...</p>
          ) : filtered.length === 0 ? (
            <p className={styles.emptyText}>
              {records.length === 0
                ? 'ライブラリに作品を追加してから設定してください'
                : '該当する作品がありません'}
            </p>
          ) : (
            filtered.map((r) => (
              <button
                key={r.work.id}
                type="button"
                className={styles.workCard}
                onClick={() => onSelect(r.work)}
              >
                {r.work.cover_image_url ? (
                  <img
                    className={styles.workCover}
                    src={r.work.cover_image_url}
                    alt={r.work.title}
                  />
                ) : (
                  <div className={styles.workCoverPlaceholder}>
                    {r.work.title.charAt(0)}
                  </div>
                )}
                <span className={styles.workName}>{r.work.title}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: FavoriteWorkSelector.module.css 作成**

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
  padding: var(--spacing-lg);
  max-width: 520px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modalHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.modalTitle {
  font-family: var(--font-heading);
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0;
}

.closeButton {
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-body);
  color: var(--color-text-muted);
  padding: var(--spacing-xs);
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.searchInput {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width-thin) solid var(--color-border-light);
  border-radius: 6px;
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  color: var(--color-text);
  margin-bottom: var(--spacing-sm);
  box-sizing: border-box;
}

.searchInput:focus {
  outline: none;
  border-color: var(--color-text);
}

.genreFilters {
  display: flex;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
  flex-wrap: wrap;
}

.filterButton {
  padding: var(--spacing-xs) var(--spacing-sm);
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  border: var(--border-width) solid var(--color-border-light);
  border-radius: 4px;
  background: none;
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filterButton:hover {
  border-color: var(--color-text);
  color: var(--color-text);
}

.filterActive {
  border-color: var(--color-text);
  color: var(--color-text);
  font-weight: var(--font-weight-bold);
}

.workGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-sm);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.workCard {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--spacing-xs);
  border-radius: 6px;
  text-align: center;
  transition: background var(--transition-fast);
}

.workCard:hover {
  background: var(--color-border-light);
}

.workCover {
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: 4px;
}

.workCoverPlaceholder {
  width: 100%;
  aspect-ratio: 2 / 3;
  background: var(--color-border-light);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-heading);
  font-size: var(--font-size-h4);
  color: var(--color-text-muted);
}

.workName {
  display: block;
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text);
  margin-top: var(--spacing-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loadingText,
.emptyText {
  grid-column: 1 / -1;
  text-align: center;
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  padding: var(--spacing-xl);
}

@media (max-width: 768px) {
  .modal {
    width: calc(100% - var(--spacing-lg) * 2);
    padding: var(--spacing-md);
    max-height: 85vh;
  }

  .workGrid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

- [ ] **Step 3: コミット**

```bash
git add -A && git commit -m "feat: FavoriteWorkSelector作品選択モーダル追加 #89"
```

---

## Task 9: UserProfilePage 統合

**Files:**
- Modify: `frontend/src/pages/UserProfilePage/UserProfilePage.tsx`
- Modify: `frontend/src/hooks/useUserProfile.ts`

- [ ] **Step 1: useUserProfile フックを拡張**

`frontend/src/hooks/useUserProfile.ts` を以下に書き換え:

```typescript
import { useCallback, useEffect, useState } from 'react'
import type {
  FavoriteDisplayMode,
  FavoriteWorkItem,
  UserProfile,
  UserStatistics,
} from '../lib/types'
import { usersApi } from '../lib/usersApi'
import { profileApi } from '../lib/profileApi'

export function useUserProfile(userId: number) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [statistics, setStatistics] = useState<UserStatistics | null>(null)
  const [favoriteWorks, setFavoriteWorks] = useState<FavoriteWorkItem[]>([])
  const [displayMode, setDisplayMode] = useState<FavoriteDisplayMode>('ranking')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const fetchData = async () => {
      try {
        const [profileRes, favRes] = await Promise.all([
          usersApi.getProfile(userId),
          profileApi.getFavoriteWorks(userId),
        ])
        if (!cancelled) {
          setProfile(profileRes.user)
          setStatistics(profileRes.statistics)
          setFavoriteWorks(favRes.favorite_works)
          setDisplayMode(favRes.display_mode)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'エラーが発生しました')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void fetchData()
    return () => {
      cancelled = true
    }
  }, [userId])

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => (prev ? { ...prev, ...updates } : prev))
  }, [])

  return {
    profile,
    statistics,
    favoriteWorks,
    setFavoriteWorks,
    displayMode,
    setDisplayMode,
    isLoading,
    error,
    updateProfile,
  }
}
```

- [ ] **Step 2: UserProfilePage.tsx を書き換え**

```typescript
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useUserProfile } from '../../hooks/useUserProfile'
import { useAuth } from '../../contexts/useAuth'
import { profileApi } from '../../lib/profileApi'
import { UserProfileHeader } from '../../components/UserProfileHeader/UserProfileHeader'
import { UserStats } from '../../components/UserStats/UserStats'
import { PublicLibrary } from '../../components/PublicLibrary/PublicLibrary'
import { FavoriteWorks } from '../../components/FavoriteWorks/FavoriteWorks'
import { FavoriteWorkSelector } from '../../components/FavoriteWorkSelector/FavoriteWorkSelector'
import type { FavoriteDisplayMode, WorkSummary } from '../../lib/types'
import styles from './UserProfilePage.module.css'

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>()
  const userId = Number(id)
  const { user } = useAuth()
  const {
    profile,
    statistics,
    favoriteWorks,
    setFavoriteWorks,
    displayMode,
    setDisplayMode,
    isLoading,
    error,
    updateProfile,
  } = useUserProfile(userId)

  const [isSelectorOpen, setIsSelectorOpen] = useState(false)

  const isOwner = user?.id === userId

  if (isLoading) {
    return <div className={styles.loading}>読み込み中...</div>
  }

  if (error || !profile || !statistics) {
    return <div className={styles.error}>{error ?? 'ユーザーが見つかりません'}</div>
  }

  const handleSelectWork = async (work: WorkSummary) => {
    setIsSelectorOpen(false)
    const nextPosition = favoriteWorks.length + 1
    const newItems = [
      ...favoriteWorks.map((fw) => ({ work_id: fw.work.id, position: fw.position })),
      { work_id: work.id, position: nextPosition },
    ]

    try {
      const res = await profileApi.updateFavoriteWorks(newItems)
      setFavoriteWorks(res.favorite_works)
    } catch {
      // エラー時は何もしない（楽観的更新していないため）
    }
  }

  const handleRemoveWork = async (workId: number) => {
    const remaining = favoriteWorks
      .filter((fw) => fw.work.id !== workId)
      .map((fw, i) => ({ work_id: fw.work.id, position: i + 1 }))

    try {
      const res = await profileApi.updateFavoriteWorks(remaining)
      setFavoriteWorks(res.favorite_works)
    } catch {
      // エラー時は何もしない
    }
  }

  const handleDisplayModeChange = (mode: FavoriteDisplayMode) => {
    setDisplayMode(mode)
  }

  return (
    <div className={styles.page}>
      <UserProfileHeader
        profile={profile}
        isOwner={isOwner}
        onProfileUpdate={updateProfile}
      />
      <FavoriteWorks
        favoriteWorks={favoriteWorks}
        displayMode={displayMode}
        isOwner={isOwner}
        onOpenSelector={() => setIsSelectorOpen(true)}
        onRemove={(workId) => void handleRemoveWork(workId)}
        onDisplayModeChange={handleDisplayModeChange}
      />
      <UserStats statistics={statistics} />
      <PublicLibrary userId={userId} />

      <FavoriteWorkSelector
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        onSelect={(work) => void handleSelectWork(work)}
        excludeWorkIds={favoriteWorks.map((fw) => fw.work.id)}
      />
    </div>
  )
}
```

- [ ] **Step 3: ESLint + Prettier 確認**

```bash
cd frontend && npx eslint src/pages/UserProfilePage/ src/hooks/useUserProfile.ts src/components/FavoriteWorks/ src/components/FavoriteWorkSelector/ src/components/ui/ToggleSwitch/ && npx prettier --check src/pages/UserProfilePage/ src/hooks/useUserProfile.ts src/components/FavoriteWorks/ src/components/FavoriteWorkSelector/ src/components/ui/ToggleSwitch/
```

Expected: no errors

- [ ] **Step 4: コミット**

```bash
git add -A && git commit -m "feat: UserProfilePageにベスト5機能を統合 #89"
```

---

## Task 10: バックエンドの profiles#show にお気に入りデータ追加 + 全テスト確認

**Files:**
- Modify: `backend/app/controllers/api/v1/profiles_controller.rb`

- [ ] **Step 1: profiles_spec にお気に入りテスト追加**

`backend/spec/requests/api/v1/profiles_spec.rb` に追加:

```ruby
it 'avatar_url と bio を返す' do
  user.update!(bio: 'テスト自己紹介', avatar_url: 'uploads/avatars/test.jpg')
  get "/api/v1/users/#{user.id}"
  json = response.parsed_body
  expect(json['user']['bio']).to eq('テスト自己紹介')
  expect(json['user']['avatar_url']).to eq('uploads/avatars/test.jpg')
end
```

- [ ] **Step 2: テスト実行**

```bash
cd backend && bundle exec rspec
```

Expected: ALL PASS

- [ ] **Step 3: フロントエンドテスト実行**

```bash
cd frontend && npx vitest run
```

Expected: 既存テストがパスする（新規テストは後のイテレーションで追加）

- [ ] **Step 4: RuboCop + ESLint 全体チェック**

```bash
cd backend && bundle exec rubocop
cd ../frontend && npx eslint src/ && npx prettier --check src/
```

Expected: no offenses / no errors

- [ ] **Step 5: コミット**

```bash
git add -A && git commit -m "test: プロフィール編集機能の全テスト確認 #89"
```
