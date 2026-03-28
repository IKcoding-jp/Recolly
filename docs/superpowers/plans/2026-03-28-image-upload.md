# 画像アップロード機能 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手動登録時にカバー画像をS3にアップロードし、ポリモーフィック関連のimagesテーブルで管理する機能を追加する

**Architecture:** 署名付きURL方式でフロントエンドからS3に直接アップロード。バックエンドは署名付きURL発行・メタデータ管理・S3削除を担当。ImageUploaderを共通コンポーネントとして作成し、ManualWorkFormと作品詳細画面で再利用する。

**Tech Stack:** Rails 8 + aws-sdk-s3 / React 19 + TypeScript + XHR（進捗取得） / PostgreSQL / RSpec + Vitest

**スペック:** `docs/superpowers/specs/2026-03-28-image-upload-design.md`

---

## ファイル構成

### バックエンド — 新規作成

| ファイル | 責務 |
|---------|------|
| `backend/db/migrate/XXXXXXX_create_images.rb` | imagesテーブルマイグレーション |
| `backend/app/models/image.rb` | Imageモデル（ポリモーフィック関連 + バリデーション） |
| `backend/app/services/s3_presign_service.rb` | 署名付きURL発行（PUT/GET） |
| `backend/app/services/s3_delete_service.rb` | S3ファイル削除 |
| `backend/app/controllers/api/v1/images_controller.rb` | presign/create/destroy アクション |
| `backend/app/jobs/orphaned_image_cleanup_job.rb` | 孤立ファイルクリーンアップジョブ |
| `backend/config/initializers/aws.rb` | AWS SDK初期化 |
| `backend/spec/models/image_spec.rb` | Imageモデルテスト |
| `backend/spec/services/s3_presign_service_spec.rb` | S3PresignServiceテスト |
| `backend/spec/services/s3_delete_service_spec.rb` | S3DeleteServiceテスト |
| `backend/spec/requests/api/v1/images_spec.rb` | ImagesControllerテスト |
| `backend/spec/jobs/orphaned_image_cleanup_job_spec.rb` | クリーンアップジョブテスト |

### バックエンド — 修正

| ファイル | 変更内容 |
|---------|---------|
| `backend/Gemfile` | aws-sdk-s3 gem追加 |
| `backend/app/models/work.rb` | images関連 + cover_imageヘルパー追加 |
| `backend/config/routes.rb` | imagesリソース追加 |

### フロントエンド — 新規作成

| ファイル | 責務 |
|---------|------|
| `frontend/src/lib/imagesApi.ts` | 画像API（presign/create/destroy/S3アップロード） |
| `frontend/src/components/ImageUploader/ImageUploader.tsx` | 画像アップロードコンポーネント |
| `frontend/src/components/ImageUploader/ImageUploader.module.css` | ImageUploaderスタイル |
| `frontend/src/components/ImageUploader/ImageUploader.test.tsx` | ImageUploaderテスト |
| `frontend/src/components/ImageUploader/index.ts` | エクスポート |

### フロントエンド — 修正

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/lib/types.ts` | Image型 + PresignResponse型追加 |
| `frontend/src/components/ManualWorkForm/ManualWorkForm.tsx` | ImageUploader統合 |
| `frontend/src/components/ManualWorkForm/ManualWorkForm.test.tsx` | テスト追加 |
| `frontend/src/pages/SearchPage/SearchPage.tsx` | handleManualSubmit更新 |

---

## Task 1: aws-sdk-s3 gem追加 + AWS初期化 + 環境変数

**Files:**
- Modify: `backend/Gemfile`
- Create: `backend/config/initializers/aws.rb`

- [ ] **Step 1: Gemfileにaws-sdk-s3を追加**

```ruby
# backend/Gemfile — faraday-retryの後に追加

# S3画像アップロード用（ADR-XXXX）
gem 'aws-sdk-s3'
```

- [ ] **Step 2: bundle install**

Run: `docker compose exec backend bundle install`
Expected: `Bundle complete!` が表示される

- [ ] **Step 3: AWS初期化ファイルを作成**

```ruby
# backend/config/initializers/aws.rb
# frozen_string_literal: true

# AWS SDK共通設定
# 署名付きURL発行とS3操作で使用する
Aws.config.update(
  region: ENV.fetch("AWS_REGION", "ap-northeast-1"),
  credentials: Aws::Credentials.new(
    ENV.fetch("AWS_ACCESS_KEY_ID", ""),
    ENV.fetch("AWS_SECRET_ACCESS_KEY", "")
  )
)
```

- [ ] **Step 4: 環境変数をdocker-compose.ymlに追加**

`docker-compose.yml`のbackendサービスのenvironment（またはenv_file）に以下を確認・追加:

```yaml
AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
AWS_REGION: ap-northeast-1
S3_BUCKET_NAME: ${S3_BUCKET_NAME:-recolly-dev-images}
```

- [ ] **Step 5: コンテナ再起動して確認**

Run: `docker compose up -d backend`
Run: `docker compose exec backend rails runner "puts Aws::S3::Client.new.class"`
Expected: `Aws::S3::Client` が表示される

- [ ] **Step 6: コミット**

```bash
git add backend/Gemfile backend/Gemfile.lock backend/config/initializers/aws.rb docker-compose.yml
git commit -m "feat: aws-sdk-s3 gemとAWS初期化設定を追加"
```

---

## Task 2: imagesテーブルマイグレーション + Imageモデル + テスト

**Files:**
- Create: `backend/db/migrate/XXXXXXX_create_images.rb`
- Create: `backend/app/models/image.rb`
- Create: `backend/spec/models/image_spec.rb`

- [ ] **Step 1: テストを書く（Imageモデルのバリデーション）**

```ruby
# backend/spec/models/image_spec.rb
# frozen_string_literal: true

require "rails_helper"

RSpec.describe Image, type: :model do
  let(:work) { Work.create!(title: "テスト作品", media_type: :anime) }

  let(:valid_attributes) do
    {
      imageable: work,
      s3_key: "uploads/images/#{SecureRandom.uuid}.jpg",
      file_name: "cover.jpg",
      content_type: "image/jpeg",
      file_size: 1_200_000
    }
  end

  describe "バリデーション" do
    it "全属性が正しければ有効" do
      image = Image.new(valid_attributes)
      expect(image).to be_valid
    end

    it "s3_keyが必須" do
      image = Image.new(valid_attributes.merge(s3_key: nil))
      expect(image).not_to be_valid
      expect(image.errors[:s3_key]).to include("can't be blank")
    end

    it "s3_keyが一意" do
      Image.create!(valid_attributes)
      duplicate = Image.new(valid_attributes.merge(file_name: "other.jpg"))
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:s3_key]).to include("has already been taken")
    end

    it "file_nameが必須" do
      image = Image.new(valid_attributes.merge(file_name: nil))
      expect(image).not_to be_valid
    end

    it "content_typeが必須" do
      image = Image.new(valid_attributes.merge(content_type: nil))
      expect(image).not_to be_valid
    end

    it "content_typeが許可リストに含まれる" do
      %w[image/jpeg image/png image/gif image/webp].each do |ct|
        image = Image.new(valid_attributes.merge(content_type: ct))
        expect(image).to be_valid, "#{ct} は有効であるべき"
      end
    end

    it "content_typeが許可リスト外なら無効" do
      image = Image.new(valid_attributes.merge(content_type: "application/pdf"))
      expect(image).not_to be_valid
      expect(image.errors[:content_type]).to include("は対応していない形式です")
    end

    it "file_sizeが必須" do
      image = Image.new(valid_attributes.merge(file_size: nil))
      expect(image).not_to be_valid
    end

    it "file_sizeが10MB以下なら有効" do
      image = Image.new(valid_attributes.merge(file_size: 10 * 1024 * 1024))
      expect(image).to be_valid
    end

    it "file_sizeが10MB超なら無効" do
      image = Image.new(valid_attributes.merge(file_size: 10 * 1024 * 1024 + 1))
      expect(image).not_to be_valid
      expect(image.errors[:file_size]).to include("は10MB以下にしてください")
    end

    it "imageableが必須" do
      image = Image.new(valid_attributes.merge(imageable: nil))
      expect(image).not_to be_valid
    end
  end

  describe "アソシエーション" do
    it "Workにポリモーフィック関連で紐づく" do
      image = Image.create!(valid_attributes)
      expect(image.imageable).to eq(work)
      expect(image.imageable_type).to eq("Work")
      expect(image.imageable_id).to eq(work.id)
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec backend bundle exec rspec spec/models/image_spec.rb`
Expected: FAIL — `uninitialized constant Image`

- [ ] **Step 3: マイグレーションを作成**

Run: `docker compose exec backend rails generate migration CreateImages`

生成されたマイグレーションファイルを以下の内容に編集:

```ruby
# backend/db/migrate/XXXXXXX_create_images.rb
# frozen_string_literal: true

class CreateImages < ActiveRecord::Migration[8.0]
  def change
    create_table :images do |t|
      # ポリモーフィック関連（imageable_type + imageable_id）
      t.references :imageable, polymorphic: true, null: false

      t.string :s3_key, null: false
      t.string :file_name, null: false
      t.string :content_type, null: false
      t.integer :file_size, null: false

      t.timestamps
    end

    add_index :images, :s3_key, unique: true
  end
end
```

- [ ] **Step 4: マイグレーション実行**

Run: `docker compose exec backend rails db:migrate`
Expected: `CreateImages: migrated`

- [ ] **Step 5: Imageモデルを作成**

```ruby
# backend/app/models/image.rb
# frozen_string_literal: true

class Image < ApplicationRecord
  # ポリモーフィック関連: Work, User, EpisodeReview等と紐づく
  belongs_to :imageable, polymorphic: true

  ALLOWED_CONTENT_TYPES = %w[image/jpeg image/png image/gif image/webp].freeze
  MAX_FILE_SIZE = 10 * 1024 * 1024 # 10MB

  validates :s3_key, presence: true, uniqueness: true
  validates :file_name, presence: true
  validates :content_type, presence: true, inclusion: {
    in: ALLOWED_CONTENT_TYPES,
    message: "は対応していない形式です"
  }
  validates :file_size, presence: true, numericality: {
    less_than_or_equal_to: MAX_FILE_SIZE,
    message: "は10MB以下にしてください"
  }
end
```

- [ ] **Step 6: テストを実行してパスを確認**

Run: `docker compose exec backend bundle exec rspec spec/models/image_spec.rb`
Expected: 全テストパス

- [ ] **Step 7: RuboCopチェック**

Run: `docker compose exec backend bundle exec rubocop app/models/image.rb spec/models/image_spec.rb`
Expected: no offenses detected

- [ ] **Step 8: コミット**

```bash
git add backend/db/migrate/ backend/db/schema.rb backend/app/models/image.rb backend/spec/models/image_spec.rb
git commit -m "feat: imagesテーブルとImageモデルを追加（ポリモーフィック関連）"
```

---

## Task 3: Workモデルにimages関連を追加

**Files:**
- Modify: `backend/app/models/work.rb`

- [ ] **Step 1: Workモデルにアソシエーションとヘルパーを追加**

`backend/app/models/work.rb` に以下を追加:

```ruby
# frozen_string_literal: true

class Work < ApplicationRecord
  has_many :records, dependent: :destroy
  has_many :images, as: :imageable, dependent: :destroy

  # （既存のenum、validatesはそのまま）

  # カバー画像（最新の1枚を返す）
  def cover_image
    images.order(created_at: :desc).first
  end

  # カバー画像のURL（S3署名付きURL or 既存のcover_image_urlカラム）
  def resolved_cover_image_url
    if cover_image
      S3PresignService.presign_get(cover_image.s3_key)
    else
      cover_image_url
    end
  end

  # JSONシリアライズ時にS3署名付きURLを使う
  def as_json(options = {})
    super(options).merge("cover_image_url" => resolved_cover_image_url)
  end
end
```

- [ ] **Step 2: Railsコンソールで確認**

Run: `docker compose exec backend rails runner "puts Work.new.respond_to?(:images)"`
Expected: `true`

- [ ] **Step 3: コミット**

```bash
git add backend/app/models/work.rb
git commit -m "feat: Workモデルにimagesポリモーフィック関連とcover_imageヘルパーを追加"
```

---

## Task 4: S3PresignService + テスト

**Files:**
- Create: `backend/app/services/s3_presign_service.rb`
- Create: `backend/spec/services/s3_presign_service_spec.rb`

- [ ] **Step 1: テストを書く**

```ruby
# backend/spec/services/s3_presign_service_spec.rb
# frozen_string_literal: true

require "rails_helper"

RSpec.describe S3PresignService do
  let(:s3_key) { "uploads/images/test-uuid.jpg" }
  let(:content_type) { "image/jpeg" }
  let(:mock_presigner) { instance_double(Aws::S3::Presigner) }

  before do
    allow(Aws::S3::Presigner).to receive(:new).and_return(mock_presigner)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("S3_BUCKET_NAME").and_return("test-bucket")
  end

  describe ".presign_put" do
    it "PUT用の署名付きURLを返す" do
      allow(mock_presigner).to receive(:presigned_url).and_return("https://s3.example.com/put-url")

      url = described_class.presign_put(s3_key, content_type)

      expect(url).to eq("https://s3.example.com/put-url")
      expect(mock_presigner).to have_received(:presigned_url).with(
        :put_object,
        bucket: "test-bucket",
        key: s3_key,
        content_type: content_type,
        expires_in: 300
      )
    end
  end

  describe ".presign_get" do
    it "GET用の署名付きURLを返す" do
      allow(mock_presigner).to receive(:presigned_url).and_return("https://s3.example.com/get-url")

      url = described_class.presign_get(s3_key)

      expect(url).to eq("https://s3.example.com/get-url")
      expect(mock_presigner).to have_received(:presigned_url).with(
        :get_object,
        bucket: "test-bucket",
        key: s3_key,
        expires_in: 900
      )
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec backend bundle exec rspec spec/services/s3_presign_service_spec.rb`
Expected: FAIL — `uninitialized constant S3PresignService`

- [ ] **Step 3: S3PresignServiceを実装**

```ruby
# backend/app/services/s3_presign_service.rb
# frozen_string_literal: true

# S3の署名付きURL（一時的な合鍵）を発行するサービス
# PUT: フロントエンドからS3に直接アップロードするために使用（有効期限5分）
# GET: プライベートバケットの画像を閲覧するために使用（有効期限15分）
class S3PresignService
  UPLOAD_EXPIRATION = 300  # 5分
  VIEW_EXPIRATION = 900    # 15分

  def self.presign_put(s3_key, content_type)
    presigner.presigned_url(
      :put_object,
      bucket: bucket_name,
      key: s3_key,
      content_type: content_type,
      expires_in: UPLOAD_EXPIRATION
    )
  end

  def self.presign_get(s3_key)
    presigner.presigned_url(
      :get_object,
      bucket: bucket_name,
      key: s3_key,
      expires_in: VIEW_EXPIRATION
    )
  end

  def self.presigner
    Aws::S3::Presigner.new(client: Aws::S3::Client.new)
  end

  def self.bucket_name
    ENV.fetch("S3_BUCKET_NAME")
  end
end
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/s3_presign_service_spec.rb`
Expected: 全テストパス

- [ ] **Step 5: RuboCopチェック**

Run: `docker compose exec backend bundle exec rubocop app/services/s3_presign_service.rb spec/services/s3_presign_service_spec.rb`
Expected: no offenses detected

- [ ] **Step 6: コミット**

```bash
git add backend/app/services/s3_presign_service.rb backend/spec/services/s3_presign_service_spec.rb
git commit -m "feat: S3PresignService（署名付きURL発行サービス）を追加"
```

---

## Task 5: S3DeleteService + テスト

**Files:**
- Create: `backend/app/services/s3_delete_service.rb`
- Create: `backend/spec/services/s3_delete_service_spec.rb`

- [ ] **Step 1: テストを書く**

```ruby
# backend/spec/services/s3_delete_service_spec.rb
# frozen_string_literal: true

require "rails_helper"

RSpec.describe S3DeleteService do
  let(:s3_key) { "uploads/images/test-uuid.jpg" }
  let(:mock_client) { instance_double(Aws::S3::Client) }

  before do
    allow(Aws::S3::Client).to receive(:new).and_return(mock_client)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("S3_BUCKET_NAME").and_return("test-bucket")
  end

  describe ".call" do
    it "S3からファイルを削除する" do
      allow(mock_client).to receive(:delete_object)

      described_class.call(s3_key)

      expect(mock_client).to have_received(:delete_object).with(
        bucket: "test-bucket",
        key: s3_key
      )
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec backend bundle exec rspec spec/services/s3_delete_service_spec.rb`
Expected: FAIL — `uninitialized constant S3DeleteService`

- [ ] **Step 3: S3DeleteServiceを実装**

```ruby
# backend/app/services/s3_delete_service.rb
# frozen_string_literal: true

# S3からファイルを削除するサービス
# 画像削除時と、メタデータ登録失敗時のロールバックで使用
class S3DeleteService
  def self.call(s3_key)
    Aws::S3::Client.new.delete_object(
      bucket: ENV.fetch("S3_BUCKET_NAME"),
      key: s3_key
    )
  end
end
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `docker compose exec backend bundle exec rspec spec/services/s3_delete_service_spec.rb`
Expected: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/s3_delete_service.rb backend/spec/services/s3_delete_service_spec.rb
git commit -m "feat: S3DeleteService（S3ファイル削除サービス）を追加"
```

---

## Task 6: ルーティング + ImagesController#presign + テスト

**Files:**
- Modify: `backend/config/routes.rb`
- Create: `backend/app/controllers/api/v1/images_controller.rb`
- Create: `backend/spec/requests/api/v1/images_spec.rb`

- [ ] **Step 1: presignアクションのテストを書く**

```ruby
# backend/spec/requests/api/v1/images_spec.rb
# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Images", type: :request do
  let(:user) { User.create!(username: "testuser", email: "test@example.com", password: "password123") }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("S3_BUCKET_NAME").and_return("test-bucket")
  end

  describe "POST /api/v1/images/presign" do
    let(:presign_params) do
      { image: { file_name: "cover.jpg", content_type: "image/jpeg", file_size: 1_200_000 } }
    end

    context "認証済み" do
      before do
        sign_in user
        allow(S3PresignService).to receive(:presign_put).and_return("https://s3.example.com/presigned-url")
      end

      it "署名付きURLとs3_keyを返す" do
        post "/api/v1/images/presign", params: presign_params, as: :json
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["presigned_url"]).to eq("https://s3.example.com/presigned-url")
        expect(json["s3_key"]).to match(%r{uploads/images/.+\.jpg})
      end

      it "不正なcontent_typeで422" do
        params = { image: { file_name: "file.pdf", content_type: "application/pdf", file_size: 1000 } }
        post "/api/v1/images/presign", params: params, as: :json
        expect(response).to have_http_status(:unprocessable_content)
        expect(response.parsed_body["error"]).to include("対応していないファイル形式")
      end

      it "10MB超のfile_sizeで422" do
        params = { image: { file_name: "big.jpg", content_type: "image/jpeg", file_size: 11_000_000 } }
        post "/api/v1/images/presign", params: params, as: :json
        expect(response).to have_http_status(:unprocessable_content)
        expect(response.parsed_body["error"]).to include("10MB")
      end
    end

    context "未認証" do
      it "401を返す" do
        post "/api/v1/images/presign", params: presign_params, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/images_spec.rb`
Expected: FAIL — ルーティングエラー

- [ ] **Step 3: ルーティングを追加**

`backend/config/routes.rb` の `namespace :api` > `namespace :v1` ブロック内に追加:

```ruby
      # 画像アップロード
      resources :images, only: %i[create destroy] do
        collection do
          post :presign
        end
      end
```

- [ ] **Step 4: ImagesControllerのpresignアクションを実装**

```ruby
# backend/app/controllers/api/v1/images_controller.rb
# frozen_string_literal: true

module Api
  module V1
    class ImagesController < ApplicationController
      before_action :authenticate_user!

      ALLOWED_CONTENT_TYPES = %w[image/jpeg image/png image/gif image/webp].freeze
      MAX_FILE_SIZE = 10.megabytes

      # POST /api/v1/images/presign
      # 署名付きURLを発行する（S3アップロード用の一時的な合鍵）
      def presign
        content_type = presign_params[:content_type]
        file_size = presign_params[:file_size].to_i
        file_name = presign_params[:file_name]

        unless ALLOWED_CONTENT_TYPES.include?(content_type)
          return render json: { error: "対応していないファイル形式です" }, status: :unprocessable_content
        end

        if file_size > MAX_FILE_SIZE
          return render json: { error: "ファイルサイズが10MBを超えています" }, status: :unprocessable_content
        end

        extension = File.extname(file_name).delete(".")
        s3_key = "uploads/images/#{SecureRandom.uuid}.#{extension}"
        presigned_url = S3PresignService.presign_put(s3_key, content_type)

        render json: { presigned_url: presigned_url, s3_key: s3_key }
      end

      private

      def presign_params
        params.expect(image: %i[file_name content_type file_size])
      end
    end
  end
end
```

- [ ] **Step 5: テストを実行してパスを確認**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/images_spec.rb`
Expected: 全テストパス

- [ ] **Step 6: RuboCopチェック**

Run: `docker compose exec backend bundle exec rubocop app/controllers/api/v1/images_controller.rb spec/requests/api/v1/images_spec.rb`
Expected: no offenses detected

- [ ] **Step 7: コミット**

```bash
git add backend/config/routes.rb backend/app/controllers/api/v1/images_controller.rb backend/spec/requests/api/v1/images_spec.rb
git commit -m "feat: ImagesController#presign — 署名付きURL発行エンドポイントを追加"
```

---

## Task 7: ImagesController#create（ロールバック含む）+ テスト

**Files:**
- Modify: `backend/app/controllers/api/v1/images_controller.rb`
- Modify: `backend/spec/requests/api/v1/images_spec.rb`

- [ ] **Step 1: createアクションのテストを追加**

`backend/spec/requests/api/v1/images_spec.rb` に追加:

```ruby
  describe "POST /api/v1/images" do
    let(:work) { Work.create!(title: "テスト作品", media_type: :anime) }
    let(:image_params) do
      {
        image: {
          s3_key: "uploads/images/test-uuid.jpg",
          file_name: "cover.jpg",
          content_type: "image/jpeg",
          file_size: 1_200_000,
          imageable_type: "Work",
          imageable_id: work.id
        }
      }
    end

    context "認証済み" do
      before do
        sign_in user
        allow(S3PresignService).to receive(:presign_get).and_return("https://s3.example.com/view-url")
        allow(S3DeleteService).to receive(:call)
      end

      it "メタデータを登録して201を返す" do
        post "/api/v1/images", params: image_params, as: :json
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json["image"]["file_name"]).to eq("cover.jpg")
        expect(json["image"]["url"]).to eq("https://s3.example.com/view-url")
      end

      it "Imageレコードが作成される" do
        expect do
          post "/api/v1/images", params: image_params, as: :json
        end.to change(Image, :count).by(1)
      end

      it "不正なcontent_typeで422 + S3ロールバック" do
        params = image_params.deep_merge(image: { content_type: "application/pdf" })
        post "/api/v1/images", params: params, as: :json
        expect(response).to have_http_status(:unprocessable_content)
        expect(S3DeleteService).to have_received(:call).with("uploads/images/test-uuid.jpg")
      end

      it "存在しないimageableで422 + S3ロールバック" do
        params = image_params.deep_merge(image: { imageable_id: 999_999 })
        post "/api/v1/images", params: params, as: :json
        expect(response).to have_http_status(:unprocessable_content)
        expect(S3DeleteService).to have_received(:call).with("uploads/images/test-uuid.jpg")
      end
    end

    context "未認証" do
      it "401を返す" do
        post "/api/v1/images", params: image_params, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/images_spec.rb`
Expected: FAIL — `The action 'create' could not be found`

- [ ] **Step 3: createアクションを実装**

`backend/app/controllers/api/v1/images_controller.rb` に追加:

```ruby
      # POST /api/v1/images
      # S3アップロード完了後、メタデータをDBに登録する
      # 登録失敗時はS3のファイルを削除（即時ロールバック）
      def create
        image = Image.new(image_params)

        if image.save
          render json: { image: image_json(image) }, status: :created
        else
          S3DeleteService.call(image_params[:s3_key]) if image_params[:s3_key].present?
          render json: { errors: image.errors.full_messages }, status: :unprocessable_content
        end
      end
```

privateセクションにメソッドを追加:

```ruby
      def image_params
        params.expect(image: %i[s3_key file_name content_type file_size imageable_type imageable_id])
      end

      def image_json(image)
        image.as_json(only: %i[id s3_key file_name content_type file_size imageable_type imageable_id created_at]).merge(
          "url" => S3PresignService.presign_get(image.s3_key)
        )
      end
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/images_spec.rb`
Expected: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add backend/app/controllers/api/v1/images_controller.rb backend/spec/requests/api/v1/images_spec.rb
git commit -m "feat: ImagesController#create — メタデータ登録 + S3ロールバックを追加"
```

---

## Task 8: ImagesController#destroy + テスト

**Files:**
- Modify: `backend/app/controllers/api/v1/images_controller.rb`
- Modify: `backend/spec/requests/api/v1/images_spec.rb`

- [ ] **Step 1: destroyアクションのテストを追加**

`backend/spec/requests/api/v1/images_spec.rb` に追加:

```ruby
  describe "DELETE /api/v1/images/:id" do
    let(:work) { Work.create!(title: "テスト作品", media_type: :anime) }
    let!(:image) do
      Image.create!(
        imageable: work,
        s3_key: "uploads/images/to-delete.jpg",
        file_name: "cover.jpg",
        content_type: "image/jpeg",
        file_size: 1_200_000
      )
    end

    context "認証済み" do
      before do
        sign_in user
        allow(S3DeleteService).to receive(:call)
      end

      it "DBレコードを削除して204を返す" do
        expect do
          delete "/api/v1/images/#{image.id}", as: :json
        end.to change(Image, :count).by(-1)
        expect(response).to have_http_status(:no_content)
      end

      it "S3のファイルも削除する" do
        delete "/api/v1/images/#{image.id}", as: :json
        expect(S3DeleteService).to have_received(:call).with("uploads/images/to-delete.jpg")
      end

      it "存在しないIDで404" do
        delete "/api/v1/images/999999", as: :json
        expect(response).to have_http_status(:not_found)
      end
    end

    context "未認証" do
      it "401を返す" do
        delete "/api/v1/images/#{image.id}", as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/images_spec.rb`
Expected: FAIL — `The action 'destroy' could not be found`

- [ ] **Step 3: destroyアクションを実装**

`backend/app/controllers/api/v1/images_controller.rb` に追加:

```ruby
      # DELETE /api/v1/images/:id
      # DB先に削除 → S3削除の順（設計書通り）
      # S3削除が失敗してもDBは削除済み。定期バッチで掃除する。
      def destroy
        image = Image.find(params[:id])
        s3_key = image.s3_key
        image.destroy!
        S3DeleteService.call(s3_key)
        head :no_content
      end
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `docker compose exec backend bundle exec rspec spec/requests/api/v1/images_spec.rb`
Expected: 全テストパス

- [ ] **Step 5: RuboCop全体チェック**

Run: `docker compose exec backend bundle exec rubocop app/controllers/api/v1/images_controller.rb spec/requests/api/v1/images_spec.rb`
Expected: no offenses detected

- [ ] **Step 6: コミット**

```bash
git add backend/app/controllers/api/v1/images_controller.rb backend/spec/requests/api/v1/images_spec.rb
git commit -m "feat: ImagesController#destroy — DB削除→S3削除の順で画像を削除"
```

---

## Task 9: OrphanedImageCleanupJob + テスト

**Files:**
- Create: `backend/app/jobs/orphaned_image_cleanup_job.rb`
- Create: `backend/spec/jobs/orphaned_image_cleanup_job_spec.rb`

- [ ] **Step 1: テストを書く**

```ruby
# backend/spec/jobs/orphaned_image_cleanup_job_spec.rb
# frozen_string_literal: true

require "rails_helper"

RSpec.describe OrphanedImageCleanupJob, type: :job do
  let(:mock_client) { instance_double(Aws::S3::Client) }
  let(:work) { Work.create!(title: "テスト作品", media_type: :anime) }

  before do
    allow(Aws::S3::Client).to receive(:new).and_return(mock_client)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("S3_BUCKET_NAME").and_return("test-bucket")
  end

  it "DBに記録がないS3ファイルを削除する" do
    # DBに存在する画像
    Image.create!(
      imageable: work,
      s3_key: "uploads/images/exists.jpg",
      file_name: "exists.jpg",
      content_type: "image/jpeg",
      file_size: 1000
    )

    # S3には2つのファイルがあるが、DBには1つだけ
    s3_objects = [
      double(key: "uploads/images/exists.jpg"),
      double(key: "uploads/images/orphaned.jpg")
    ]
    allow(mock_client).to receive(:list_objects_v2).and_return(
      double(contents: s3_objects, is_truncated: false)
    )
    allow(mock_client).to receive(:delete_object)

    described_class.perform_now

    # 孤立ファイルだけが削除される
    expect(mock_client).to have_received(:delete_object).with(
      bucket: "test-bucket",
      key: "uploads/images/orphaned.jpg"
    )
    expect(mock_client).not_to have_received(:delete_object).with(
      bucket: "test-bucket",
      key: "uploads/images/exists.jpg"
    )
  end

  it "S3にファイルがなければ何もしない" do
    allow(mock_client).to receive(:list_objects_v2).and_return(
      double(contents: [], is_truncated: false)
    )

    expect { described_class.perform_now }.not_to raise_error
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec backend bundle exec rspec spec/jobs/orphaned_image_cleanup_job_spec.rb`
Expected: FAIL — `uninitialized constant OrphanedImageCleanupJob`

- [ ] **Step 3: ジョブを実装**

```ruby
# backend/app/jobs/orphaned_image_cleanup_job.rb
# frozen_string_literal: true

# S3にあるがDBに記録がない孤立ファイルを削除するジョブ
# Solid Queueで1日1回実行する
class OrphanedImageCleanupJob < ApplicationJob
  queue_as :default

  UPLOADS_PREFIX = "uploads/images/"

  def perform
    client = Aws::S3::Client.new
    bucket = ENV.fetch("S3_BUCKET_NAME")

    # DBに登録されているs3_keyの一覧を取得
    db_keys = Image.pluck(:s3_key).to_set

    # S3のファイル一覧を取得して、DBにないものを削除
    continuation_token = nil
    loop do
      response = client.list_objects_v2(
        bucket: bucket,
        prefix: UPLOADS_PREFIX,
        continuation_token: continuation_token
      )

      response.contents.each do |object|
        unless db_keys.include?(object.key)
          client.delete_object(bucket: bucket, key: object.key)
          Rails.logger.info("[OrphanedImageCleanup] 孤立ファイルを削除: #{object.key}")
        end
      end

      break unless response.is_truncated

      continuation_token = response.next_continuation_token
    end
  end
end
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `docker compose exec backend bundle exec rspec spec/jobs/orphaned_image_cleanup_job_spec.rb`
Expected: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add backend/app/jobs/orphaned_image_cleanup_job.rb backend/spec/jobs/orphaned_image_cleanup_job_spec.rb
git commit -m "feat: OrphanedImageCleanupJob — 孤立S3ファイルの定期クリーンアップジョブを追加"
```

---

## Task 10: バックエンド全テスト実行 + 既存テスト確認

**Files:** なし（確認のみ）

- [ ] **Step 1: 全バックエンドテストを実行**

Run: `docker compose exec backend bundle exec rspec`
Expected: 全テストパス（既存テストが壊れていないこと）

- [ ] **Step 2: RuboCop全体チェック**

Run: `docker compose exec backend bundle exec rubocop`
Expected: no offenses detected

- [ ] **Step 3: 問題があれば修正してコミット**

特に `Work#as_json` の変更で既存テストが壊れていないか確認。`S3PresignService.presign_get` が呼ばれるWorkのテストでは、S3サービスのモックが必要になる可能性がある。

---

## Task 11: フロントエンド型定義 + imagesApi

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/imagesApi.ts`

- [ ] **Step 1: Image型とPresignResponse型を追加**

`frontend/src/lib/types.ts` に追加:

```typescript
// 画像（S3にアップロード済み、DBに登録済み）
export interface ImageRecord {
  id: number
  s3_key: string
  file_name: string
  content_type: string
  file_size: number
  imageable_type: string
  imageable_id: number
  url: string
  created_at: string
}

// 署名付きURL発行レスポンス
export interface PresignResponse {
  presigned_url: string
  s3_key: string
}

// 画像メタデータ登録レスポンス
export interface ImageResponse {
  image: ImageRecord
}
```

- [ ] **Step 2: imagesApiを作成**

```typescript
// frontend/src/lib/imagesApi.ts
import { request } from './api'
import type { PresignResponse, ImageResponse } from './types'

export const imagesApi = {
  // 署名付きURL発行（S3アップロード用の一時的な合鍵を取得）
  presign(fileName: string, contentType: string, fileSize: number): Promise<PresignResponse> {
    return request<PresignResponse>('/images/presign', {
      method: 'POST',
      body: JSON.stringify({
        image: { file_name: fileName, content_type: contentType, file_size: fileSize },
      }),
    })
  },

  // メタデータ登録（S3アップロード完了後にDBに記録）
  create(params: {
    s3Key: string
    fileName: string
    contentType: string
    fileSize: number
    imageableType: string
    imageableId: number
  }): Promise<ImageResponse> {
    return request<ImageResponse>('/images', {
      method: 'POST',
      body: JSON.stringify({
        image: {
          s3_key: params.s3Key,
          file_name: params.fileName,
          content_type: params.contentType,
          file_size: params.fileSize,
          imageable_type: params.imageableType,
          imageable_id: params.imageableId,
        },
      }),
    })
  },

  // 画像削除
  destroy(id: number): Promise<void> {
    return request<void>(`/images/${id}`, { method: 'DELETE' })
  },

  // S3に直接アップロード（XHRでプログレスバー対応）
  // fetchにはアップロード進捗を取得する機能がないため、XHRを使用する
  uploadToS3(
    presignedUrl: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', file.type)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`S3アップロードに失敗しました: ${xhr.status}`))
        }
      }

      xhr.onerror = () => reject(new Error('ネットワークエラーが発生しました'))
      xhr.send(file)
    })
  },
}
```

- [ ] **Step 3: ESLint + Prettierチェック**

Run: `docker compose exec frontend npx eslint src/lib/imagesApi.ts src/lib/types.ts`
Expected: no errors

- [ ] **Step 4: コミット**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/imagesApi.ts
git commit -m "feat: Image型定義とimagesApi（presign/create/destroy/S3アップロード）を追加"
```

---

## Task 12: ImageUploaderコンポーネント + CSS + テスト

**Files:**
- Create: `frontend/src/components/ImageUploader/ImageUploader.tsx`
- Create: `frontend/src/components/ImageUploader/ImageUploader.module.css`
- Create: `frontend/src/components/ImageUploader/ImageUploader.test.tsx`
- Create: `frontend/src/components/ImageUploader/index.ts`

- [ ] **Step 1: テストを書く**

```typescript
// frontend/src/components/ImageUploader/ImageUploader.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageUploader } from './ImageUploader'

// imagesApiをモック
vi.mock('../../lib/imagesApi', () => ({
  imagesApi: {
    presign: vi.fn().mockResolvedValue({
      presigned_url: 'https://s3.example.com/presigned',
      s3_key: 'uploads/images/test-uuid.jpg',
    }),
    uploadToS3: vi.fn().mockResolvedValue(undefined),
  },
}))

const createMockFile = (name: string, size: number, type: string): File => {
  const file = new File(['x'.repeat(size)], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('ImageUploader', () => {
  const defaultProps = {
    onUploadComplete: vi.fn(),
    onRemove: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ドロップゾーンが表示される', () => {
    render(<ImageUploader {...defaultProps} />)
    expect(screen.getByText('ドラッグ&ドロップ')).toBeInTheDocument()
    expect(screen.getByText(/ファイルを選択/)).toBeInTheDocument()
  })

  it('不正なファイル形式でエラー表示', async () => {
    render(<ImageUploader {...defaultProps} />)
    const user = userEvent.setup()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile('test.pdf', 1000, 'application/pdf')
    await user.upload(input, file)
    expect(screen.getByText(/対応していないファイル形式/)).toBeInTheDocument()
  })

  it('10MB超のファイルでエラー表示', async () => {
    render(<ImageUploader {...defaultProps} />)
    const user = userEvent.setup()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile('big.jpg', 11 * 1024 * 1024, 'image/jpeg')
    await user.upload(input, file)
    expect(screen.getByText(/10MB/)).toBeInTheDocument()
  })

  it('完了後に「画像を削除」リンクが表示される', async () => {
    render(<ImageUploader {...defaultProps} />)
    const user = userEvent.setup()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile('cover.jpg', 1000, 'image/jpeg')
    await user.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText('アップロード完了')).toBeInTheDocument()
    })
    expect(screen.getByText('画像を削除')).toBeInTheDocument()
  })

  it('「画像を削除」クリックでidleに戻る', async () => {
    render(<ImageUploader {...defaultProps} />)
    const user = userEvent.setup()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile('cover.jpg', 1000, 'image/jpeg')
    await user.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText('画像を削除')).toBeInTheDocument()
    })
    await user.click(screen.getByText('画像を削除'))
    expect(screen.getByText('ドラッグ&ドロップ')).toBeInTheDocument()
    expect(defaultProps.onRemove).toHaveBeenCalled()
  })

  it('アップロード完了時にonUploadCompleteが呼ばれる', async () => {
    render(<ImageUploader {...defaultProps} />)
    const user = userEvent.setup()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile('cover.jpg', 1000, 'image/jpeg')
    await user.upload(input, file)

    await waitFor(() => {
      expect(defaultProps.onUploadComplete).toHaveBeenCalledWith({
        s3Key: 'uploads/images/test-uuid.jpg',
        fileName: 'cover.jpg',
        contentType: 'image/jpeg',
        fileSize: 1000,
      })
    })
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec frontend npx vitest run src/components/ImageUploader/ImageUploader.test.tsx`
Expected: FAIL — モジュールが見つからない

- [ ] **Step 3: CSSモジュールを作成**

```css
/* frontend/src/components/ImageUploader/ImageUploader.module.css */
.container {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-start;
}

/* --- プレビュー枠 --- */
.preview {
  flex-shrink: 0;
  width: 100px;
  height: 140px;
  border: var(--border-width) solid var(--color-border-light);
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.previewImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.previewEmpty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
}

.previewIcon {
  width: 32px;
  height: 32px;
  stroke: var(--color-border-light);
}

/* --- 右側エリア --- */
.rightArea {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--spacing-sm);
  height: 140px;
}

/* --- ドロップゾーン --- */
.dropzone {
  border: var(--border-width) dashed var(--color-border-light);
  height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}

.dropzone:hover {
  border-color: var(--color-text);
  background: var(--color-bg);
}

.dropzoneDragover {
  border-color: var(--color-text);
  background: var(--color-bg);
}

.dropzoneText {
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.dropzoneLink {
  color: var(--color-text);
  text-decoration: underline;
  cursor: pointer;
}

.dropzoneHint {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
}

/* --- プログレスバー --- */
.progressArea {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.progressInfo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
}

.progressTrack {
  height: 6px;
  background: var(--color-border-light);
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: var(--color-text);
  transition: width 300ms ease;
}

.progressStatus {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
}

.progressDone {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

/* --- 削除リンク --- */
.removeLink {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  align-self: flex-start;
  transition: color var(--transition-fast);
}

.removeLink:hover {
  color: var(--color-error);
}

/* --- エラー --- */
.error {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-error);
}

/* --- 非表示のファイル入力 --- */
.hiddenInput {
  display: none;
}

@media (max-width: 768px) {
  .preview {
    width: 72px;
    height: 100px;
  }

  .rightArea {
    height: 100px;
  }

  .dropzone {
    height: 100px;
  }
}
```

- [ ] **Step 4: ImageUploaderコンポーネントを実装**

```typescript
// frontend/src/components/ImageUploader/ImageUploader.tsx
import { useState, useRef, useCallback } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { imagesApi } from '../../lib/imagesApi'
import styles from './ImageUploader.module.css'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export type UploadResult = {
  s3Key: string
  fileName: string
  contentType: string
  fileSize: number
}

type ImageUploaderProps = {
  onUploadComplete: (result: UploadResult) => void
  onRemove: () => void
  existingImageUrl?: string
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

export function ImageUploader({ onUploadComplete, onRemove, existingImageUrl }: ImageUploaderProps) {
  const [state, setState] = useState<UploadState>(existingImageUrl ? 'done' : 'idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingImageUrl ?? null)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [isDragover, setIsDragover] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return '対応していないファイル形式です（JPEG, PNG, GIF, WebPのみ）'
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'ファイルサイズが10MBを超えています'
    }
    return null
  }

  const handleUpload = useCallback(async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      setState('error')
      return
    }

    setError('')
    setFileName(file.name)
    setFileSize(file.size)
    setPreviewUrl(URL.createObjectURL(file))
    setState('uploading')
    setProgress(0)

    try {
      // ① 署名付きURL取得
      const { presigned_url, s3_key } = await imagesApi.presign(file.name, file.type, file.size)

      // ② S3に直接アップロード（XHRでプログレスバー対応）
      await imagesApi.uploadToS3(presigned_url, file, setProgress)

      // 完了
      setState('done')
      onUploadComplete({
        s3Key: s3_key,
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      })
    } catch {
      setError('アップロードに失敗しました')
      setState('error')
    }
  }, [onUploadComplete])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void handleUpload(file)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragover(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      void handleUpload(file)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragover(true)
  }

  const handleDragLeave = () => {
    setIsDragover(false)
  }

  const handleRemove = () => {
    setState('idle')
    setPreviewUrl(null)
    setFileName('')
    setFileSize(0)
    setProgress(0)
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onRemove()
  }

  const handleDropzoneClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={styles.container}>
      {/* プレビュー枠 */}
      <div className={styles.preview}>
        {previewUrl ? (
          <img src={previewUrl} alt="プレビュー" className={styles.previewImage} />
        ) : (
          <div className={styles.previewEmpty}>
            <svg className={styles.previewIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
            <span>NO IMAGE</span>
          </div>
        )}
      </div>

      {/* 右側エリア */}
      <div className={styles.rightArea}>
        {/* 非表示のファイル入力 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className={styles.hiddenInput}
        />

        {/* idle / error: ドロップゾーン */}
        {(state === 'idle' || state === 'error') && (
          <>
            <div
              className={`${styles.dropzone} ${isDragover ? styles.dropzoneDragover : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleDropzoneClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleDropzoneClick() }}
            >
              <span className={styles.dropzoneText}>ドラッグ&ドロップ</span>
              <span className={styles.dropzoneHint}>
                または <span className={styles.dropzoneLink}>ファイルを選択</span>
              </span>
              <span className={styles.dropzoneHint}>JPEG, PNG, GIF, WebP（10MBまで）</span>
            </div>
            {error && <p className={styles.error}>{error}</p>}
          </>
        )}

        {/* uploading: プログレスバー */}
        {state === 'uploading' && (
          <div className={styles.progressArea}>
            <div className={styles.progressInfo}>
              <span>{fileName}</span>
              <span>{formatFileSize(fileSize)}</span>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <span className={styles.progressStatus}>アップロード中... {progress}%</span>
          </div>
        )}

        {/* done: 完了 + 削除リンク */}
        {state === 'done' && (
          <div className={styles.progressArea}>
            <div className={styles.progressInfo}>
              <span>{fileName}</span>
              <span>{formatFileSize(fileSize)}</span>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: '100%' }} />
            </div>
            <span className={styles.progressDone}>アップロード完了</span>
            <button type="button" className={styles.removeLink} onClick={handleRemove}>
              画像を削除
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: エクスポートファイルを作成**

```typescript
// frontend/src/components/ImageUploader/index.ts
export { ImageUploader } from './ImageUploader'
export type { UploadResult } from './ImageUploader'
```

- [ ] **Step 6: テストを実行してパスを確認**

Run: `docker compose exec frontend npx vitest run src/components/ImageUploader/ImageUploader.test.tsx`
Expected: 全テストパス

- [ ] **Step 7: ESLint + Prettierチェック**

Run: `docker compose exec frontend npx eslint src/components/ImageUploader/`
Expected: no errors

- [ ] **Step 8: コミット**

```bash
git add frontend/src/components/ImageUploader/
git commit -m "feat: ImageUploaderコンポーネントを追加（D&D+プレビュー+プログレスバー）"
```

---

## Task 13: ManualWorkFormにImageUploader統合 + SearchPage更新

**Files:**
- Modify: `frontend/src/components/ManualWorkForm/ManualWorkForm.tsx`
- Modify: `frontend/src/components/ManualWorkForm/ManualWorkForm.test.tsx`
- Modify: `frontend/src/pages/SearchPage/SearchPage.tsx`

- [ ] **Step 1: ManualWorkFormテストに画像テストを追加**

`frontend/src/components/ManualWorkForm/ManualWorkForm.test.tsx` に追加:

```typescript
// 既存のimportに追加
// vi.mockは既存テストの前に追加
vi.mock('../../lib/imagesApi', () => ({
  imagesApi: {
    presign: vi.fn().mockResolvedValue({
      presigned_url: 'https://s3.example.com/presigned',
      s3_key: 'uploads/images/test-uuid.jpg',
    }),
    uploadToS3: vi.fn().mockResolvedValue(undefined),
  },
}))

// 既存のdescribeブロック内に追加:

  it('画像なしでも登録できる', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ManualWorkForm onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('タイトル'), 'テスト作品')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(onSubmit).toHaveBeenCalledWith('テスト作品', 'anime', '', undefined)
  })

  it('カバー画像の入力欄が表示される', () => {
    render(<ManualWorkForm onSubmit={vi.fn()} />)
    expect(screen.getByText('カバー画像（任意）')).toBeInTheDocument()
    expect(screen.getByText('ドラッグ&ドロップ')).toBeInTheDocument()
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec frontend npx vitest run src/components/ManualWorkForm/ManualWorkForm.test.tsx`
Expected: FAIL — `カバー画像（任意）` が見つからない

- [ ] **Step 3: ManualWorkFormにImageUploaderを統合**

`frontend/src/components/ManualWorkForm/ManualWorkForm.tsx` を更新:

```typescript
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { MediaType } from '../../lib/types'
import { Button } from '../ui/Button/Button'
import { ImageUploader } from '../ImageUploader'
import type { UploadResult } from '../ImageUploader'
import styles from './ManualWorkForm.module.css'

type ManualWorkFormProps = {
  onSubmit: (
    title: string,
    mediaType: MediaType,
    description: string,
    imageData?: UploadResult,
  ) => Promise<void>
}

const MEDIA_TYPE_OPTIONS: { value: MediaType; label: string }[] = [
  { value: 'anime', label: 'アニメ' },
  { value: 'movie', label: '映画' },
  { value: 'drama', label: 'ドラマ' },
  { value: 'book', label: '本' },
  { value: 'manga', label: '漫画' },
  { value: 'game', label: 'ゲーム' },
]

export function ManualWorkForm({ onSubmit }: ManualWorkFormProps) {
  const [title, setTitle] = useState('')
  const [mediaType, setMediaType] = useState<MediaType>('anime')
  const [description, setDescription] = useState('')
  const [imageData, setImageData] = useState<UploadResult | undefined>(undefined)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('タイトルを入力してください')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(title, mediaType, description, imageData)
      setTitle('')
      setDescription('')
      setImageData(undefined)
    } catch {
      setError('登録に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="manual-title">タイトル</label>
        <input
          id="manual-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="manual-media-type">ジャンル</label>
        <select
          id="manual-media-type"
          value={mediaType}
          onChange={(e) => setMediaType(e.target.value as MediaType)}
        >
          {MEDIA_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label>カバー画像（任意）</label>
        <ImageUploader
          onUploadComplete={setImageData}
          onRemove={() => setImageData(undefined)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="manual-description">説明（任意）</label>
        <textarea
          id="manual-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <Button variant="secondary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? '登録中...' : '登録する'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `docker compose exec frontend npx vitest run src/components/ManualWorkForm/ManualWorkForm.test.tsx`
Expected: 全テストパス

- [ ] **Step 5: SearchPageのhandleManualSubmitを更新**

`frontend/src/pages/SearchPage/SearchPage.tsx` の `handleManualSubmit` を更新:

```typescript
// importに追加
import { imagesApi } from '../../lib/imagesApi'
import type { UploadResult } from '../../components/ImageUploader'

// handleManualSubmitを更新
  const handleManualSubmit = async (
    title: string,
    mediaType: MediaType,
    description: string,
    imageData?: UploadResult,
  ) => {
    // ① Workを作成
    const { work } = await worksApi.create(title, mediaType, description)

    // ② 画像がある場合、メタデータをDBに登録
    if (imageData) {
      await imagesApi.create({
        s3Key: imageData.s3Key,
        fileName: imageData.fileName,
        contentType: imageData.contentType,
        fileSize: imageData.fileSize,
        imageableType: 'Work',
        imageableId: work.id,
      })
    }

    setShowManualForm(false)
  }
```

- [ ] **Step 6: ESLint + Prettierチェック**

Run: `docker compose exec frontend npx eslint src/components/ManualWorkForm/ src/pages/SearchPage/SearchPage.tsx`
Expected: no errors

- [ ] **Step 7: フロントエンド全テスト実行**

Run: `docker compose exec frontend npx vitest run`
Expected: 全テストパス

- [ ] **Step 8: コミット**

```bash
git add frontend/src/components/ManualWorkForm/ frontend/src/pages/SearchPage/SearchPage.tsx
git commit -m "feat: ManualWorkFormにImageUploaderを統合し、カバー画像付き手動登録を実装"
```

---

## Task 14: S3バケット作成 + CORS設定

**Files:** なし（AWSインフラ設定のみ）

- [ ] **Step 1: 開発用S3バケットを作成**

Run: `aws s3 mb s3://recolly-dev-images --region ap-northeast-1`
Expected: `make_bucket: recolly-dev-images`

- [ ] **Step 2: パブリックアクセスブロックを有効化**

Run: `aws s3api put-public-access-block --bucket recolly-dev-images --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"`
Expected: エラーなし

- [ ] **Step 3: CORS設定を適用**

以下の内容で `cors.json` を作成:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://localhost:5173"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["Content-Type"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

Run: `aws s3api put-bucket-cors --bucket recolly-dev-images --cors-configuration file://cors.json`
Expected: エラーなし

- [ ] **Step 4: 環境変数を.envファイルに設定**

`.env`（またはDocker Compose用の.envファイル）に以下を追加:

```
S3_BUCKET_NAME=recolly-dev-images
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=（AWSコンソールから取得）
AWS_SECRET_ACCESS_KEY=（AWSコンソールから取得）
```

- [ ] **Step 5: 接続確認**

Run: `docker compose exec backend rails runner "puts Aws::S3::Client.new.list_buckets.buckets.map(&:name)"`
Expected: `recolly-dev-images` が含まれる

---

## スペックカバレッジ確認

| スペックセクション | 対応タスク |
|------------------|-----------|
| 2. データモデル | Task 2, 3 |
| 3. APIエンドポイント（presign） | Task 6 |
| 3. APIエンドポイント（create） | Task 7 |
| 3. APIエンドポイント（destroy） | Task 8 |
| 4. フロントエンド設計 | Task 11, 12, 13 |
| 5. バックエンド設計（サービス） | Task 4, 5 |
| 5. バックエンド設計（ジョブ） | Task 9 |
| 6. インフラ・セキュリティ | Task 1, 14 |
| 7. テスト戦略 | 各Task内のTDDステップ |
| 8. UIデザイン | Task 12 |

**スコープ外（別Issue）:** 作品詳細画面でのカバー画像変更UI（ImageUploaderは共通コンポーネントとして準備済み。詳細画面への統合は別タスクで対応）
