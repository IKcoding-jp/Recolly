# 作品検索・外部API連携・記録機能 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 外部API 4つ（TMDB, AniList, Google Books, IGDB）と連携した作品検索、手動登録、記録（ライブラリ追加）機能を実装する

**Architecture:** アダプタパターンで4つの外部APIクライアントを統一インターフェースで束ね、WorkSearchServiceが検索を実行。検索結果はRedis（Rails.cache）でTTL付きキャッシュ。ユーザーが「記録する」を押した時にWorksテーブル + Recordsテーブルに保存。フロントエンドはReact + TypeScriptで検索ページ・WorkCard・手動登録フォームを実装。

**Tech Stack:** Rails 8 API / Faraday / Redis / RSpec + WebMock / React 19 / TypeScript / Vitest + RTL

**Issue:** #18
**Working Docs:** `docs/working/20260321_18_作品検索外部API連携/`
**関連ADR:** 0008（Redis）, 0009（Faraday）, 0010（AniList GraphQL）, 0011（アダプタパターン）

---

## ファイル構成

### バックエンド — 新規作成
| ファイル | 責務 |
|---------|------|
| `backend/db/migrate/xxx_create_works.rb` | Worksテーブル作成 |
| `backend/db/migrate/xxx_create_records.rb` | Recordsテーブル作成 |
| `backend/app/models/work.rb` | Workモデル（バリデーション、enum） |
| `backend/app/models/record.rb` | Recordモデル（バリデーション、リレーション） |
| `backend/app/services/external_apis/base_adapter.rb` | 外部APIアダプタ共通インターフェース |
| `backend/app/services/external_apis/tmdb_adapter.rb` | TMDB API（映画・ドラマ） |
| `backend/app/services/external_apis/anilist_adapter.rb` | AniList API（アニメ・漫画） |
| `backend/app/services/external_apis/google_books_adapter.rb` | Google Books API（本） |
| `backend/app/services/external_apis/igdb_adapter.rb` | IGDB API（ゲーム） |
| `backend/app/services/work_search_service.rb` | アダプタを束ねる検索サービス |
| `backend/app/controllers/api/v1/works_controller.rb` | 検索 + 手動登録 |
| `backend/app/controllers/api/v1/records_controller.rb` | 記録作成 |
| `backend/config/initializers/redis.rb` | Redis接続設定 |

### バックエンド — 変更
| ファイル | 変更内容 |
|---------|---------|
| `backend/Gemfile` | faraday, redis, webmock 追加 |
| `backend/app/models/user.rb` | `has_many :records` 追加 |
| `backend/config/routes.rb` | works, records エンドポイント追加 |
| `backend/config/environments/development.rb` | cache_store を redis_cache_store に変更 |
| `backend/config/environments/test.rb` | cache_store を memory_store に変更 |

### バックエンド — テスト
| ファイル | テスト対象 |
|---------|----------|
| `backend/spec/models/work_spec.rb` | Workモデル |
| `backend/spec/models/record_spec.rb` | Recordモデル |
| `backend/spec/services/external_apis/tmdb_adapter_spec.rb` | TmdbAdapter |
| `backend/spec/services/external_apis/anilist_adapter_spec.rb` | AniListAdapter |
| `backend/spec/services/external_apis/google_books_adapter_spec.rb` | GoogleBooksAdapter |
| `backend/spec/services/external_apis/igdb_adapter_spec.rb` | IgdbAdapter |
| `backend/spec/services/work_search_service_spec.rb` | WorkSearchService |
| `backend/spec/requests/api/v1/works_spec.rb` | Works API |
| `backend/spec/requests/api/v1/records_spec.rb` | Records API |

### フロントエンド — 新規作成
| ファイル | 責務 |
|---------|------|
| `frontend/src/lib/worksApi.ts` | 作品検索・手動登録API通信 |
| `frontend/src/lib/worksApi.test.ts` | worksApiテスト |
| `frontend/src/lib/recordsApi.ts` | 記録API通信 |
| `frontend/src/lib/recordsApi.test.ts` | recordsApiテスト |
| `frontend/src/pages/SearchPage/SearchPage.tsx` | 検索ページ |
| `frontend/src/pages/SearchPage/SearchPage.module.css` | 検索ページスタイル |
| `frontend/src/pages/SearchPage/SearchPage.test.tsx` | 検索ページテスト |
| `frontend/src/components/WorkCard/WorkCard.tsx` | 作品カード |
| `frontend/src/components/WorkCard/WorkCard.module.css` | 作品カードスタイル |
| `frontend/src/components/WorkCard/WorkCard.test.tsx` | 作品カードテスト |
| `frontend/src/components/ManualWorkForm/ManualWorkForm.tsx` | 手動登録フォーム |
| `frontend/src/components/ManualWorkForm/ManualWorkForm.module.css` | 手動登録フォームスタイル |
| `frontend/src/components/ManualWorkForm/ManualWorkForm.test.tsx` | 手動登録フォームテスト |

### フロントエンド — 変更
| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/lib/api.ts` | `request` 関数をexport |
| `frontend/src/lib/types.ts` | Work, Record, SearchResult 型追加 |
| `frontend/src/App.tsx` | `/search` ルート追加 |

### インフラ — 変更
| ファイル | 変更内容 |
|---------|---------|
| `docker-compose.yml` | Redis サービス追加 |

---

## Task 1: インフラ基盤（Redis + gem追加）

**Files:**
- Modify: `docker-compose.yml`
- Modify: `backend/Gemfile`
- Create: `backend/config/initializers/redis.rb`
- Modify: `backend/config/environments/development.rb:27`
- Modify: `backend/config/environments/test.rb:23`

- [ ] **Step 1: docker-compose.yml に Redis サービスを追加**

```yaml
# servicesセクション内、dbの後に追加
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

# backendサービスのdepends_onにredisを追加
  backend:
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      # 既存の環境変数に追加
      REDIS_URL: redis://redis:6379/0

# volumesセクションに追加
  redis_data:
```

- [ ] **Step 2: Gemfile に faraday, redis, webmock を追加**

```ruby
# Gemfileの末尾（devise gemの後あたり）に追加

# HTTPクライアント（外部API通信用、ADR-0009）
gem 'faraday'

# Redis（検索キャッシュ用、ADR-0008）
gem 'redis'

# テストグループに追加
group :development, :test do
  # 既存のgemの後に追加
  gem 'webmock'
end
```

- [ ] **Step 3: Redis 初期化ファイルを作成**

```ruby
# backend/config/initializers/redis.rb
# frozen_string_literal: true

# Redis接続（検索キャッシュ等で使用、ADR-0008）
REDIS = Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"))
```

- [ ] **Step 4: development.rb の cache_store を Redis に変更**

`config.cache_store = :memory_store` を以下に変更:

```ruby
# 検索結果キャッシュにRedisを使用（ADR-0008）
config.cache_store = :redis_cache_store, { url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0") }
```

- [ ] **Step 5: test.rb の cache_store を memory_store に変更**

`config.cache_store = :null_store` を以下に変更:

```ruby
# テスト環境ではメモリストアでキャッシュ動作をテスト可能にする
config.cache_store = :memory_store
```

- [ ] **Step 6: bundle install を実行**

Run: `docker compose run --rm backend bundle install`

- [ ] **Step 7: Redis 接続を確認**

Run: `docker compose up -d db redis && docker compose run --rm backend rails runner "puts REDIS.ping"`
Expected: `PONG`

- [ ] **Step 8: コミット**

```bash
git add docker-compose.yml backend/Gemfile backend/Gemfile.lock backend/config/initializers/redis.rb backend/config/environments/development.rb backend/config/environments/test.rb
git commit -m "feat: Redis + Faraday + WebMock を導入（ADR-0008, ADR-0009）"
```

---

## Task 2: Work モデル（TDD）

**Files:**
- Create: `backend/spec/models/work_spec.rb`
- Create: `backend/db/migrate/xxx_create_works.rb`
- Create: `backend/app/models/work.rb`

- [ ] **Step 1: Work モデルのテストを書く**

```ruby
# backend/spec/models/work_spec.rb
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Work, type: :model do
  describe 'バリデーション' do
    let(:valid_attributes) do
      { title: '進撃の巨人', media_type: 'anime' }
    end

    it '必須フィールド（title, media_type）で作成できる' do
      work = described_class.new(valid_attributes)
      expect(work).to be_valid
    end

    it '全フィールド指定で作成できる' do
      work = described_class.new(
        valid_attributes.merge(
          description: '巨人と人類の戦い',
          cover_image_url: 'https://example.com/image.jpg',
          total_episodes: 25,
          external_api_id: '16498',
          external_api_source: 'anilist',
          metadata: { genres: ['action', 'drama'] }
        )
      )
      expect(work).to be_valid
    end

    it 'titleなしでバリデーションエラー' do
      work = described_class.new(valid_attributes.merge(title: ''))
      expect(work).not_to be_valid
      expect(work.errors[:title]).to be_present
    end

    it 'media_typeなしでバリデーションエラー' do
      work = described_class.new(valid_attributes.merge(media_type: nil))
      expect(work).not_to be_valid
      expect(work.errors[:media_type]).to be_present
    end

    it '無効なmedia_typeでArgumentError' do
      expect do
        described_class.new(valid_attributes.merge(media_type: 'invalid'))
      end.to raise_error(ArgumentError)
    end
  end

  describe 'ユニーク制約' do
    it 'external_api_id + external_api_source が重複するとバリデーションエラー' do
      described_class.create!(title: '進撃の巨人', media_type: 'anime',
                              external_api_id: '16498', external_api_source: 'anilist')
      duplicate = described_class.new(title: '別タイトル', media_type: 'anime',
                                      external_api_id: '16498', external_api_source: 'anilist')
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:external_api_id]).to be_present
    end

    it 'external_api_id が同じでも source が違えば作成できる' do
      described_class.create!(title: '進撃の巨人', media_type: 'anime',
                              external_api_id: '16498', external_api_source: 'anilist')
      different_source = described_class.new(title: '進撃の巨人', media_type: 'anime',
                                             external_api_id: '16498', external_api_source: 'tmdb')
      expect(different_source).to be_valid
    end

    it 'external_api_id が nil の場合はユニーク制約の対象外' do
      described_class.create!(title: '手動登録作品1', media_type: 'anime')
      manual = described_class.new(title: '手動登録作品2', media_type: 'anime')
      expect(manual).to be_valid
    end
  end

  describe 'enum' do
    it 'media_type の全値が定義されている' do
      expected = %w[anime movie drama book manga game]
      expect(described_class.media_types.keys).to match_array(expected)
    end
  end

  describe 'リレーション' do
    it 'records を複数持てる' do
      association = described_class.reflect_on_association(:records)
      expect(association.macro).to eq(:has_many)
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/work_spec.rb`
Expected: FAIL（Work クラスが未定義）

- [ ] **Step 3: マイグレーション作成**

Run: `docker compose run --rm backend bin/rails generate migration CreateWorks`

マイグレーションファイルを編集:

```ruby
# frozen_string_literal: true

class CreateWorks < ActiveRecord::Migration[8.1]
  def change
    create_table :works do |t|
      t.string :title, null: false
      t.integer :media_type, null: false
      t.text :description
      t.string :cover_image_url
      t.integer :total_episodes
      t.string :external_api_id
      t.string :external_api_source
      t.jsonb :metadata, default: {}

      t.timestamps null: false
    end

    # 同じ外部APIの同じIDの作品は重複させない
    add_index :works, [:external_api_id, :external_api_source], unique: true,
              where: "external_api_id IS NOT NULL"
  end
end
```

- [ ] **Step 4: Work モデル実装**

```ruby
# backend/app/models/work.rb
# frozen_string_literal: true

class Work < ApplicationRecord
  has_many :records, dependent: :destroy

  # 仕様書セクション4.3: media_type enum
  enum :media_type, {
    anime: 0,
    movie: 1,
    drama: 2,
    book: 3,
    manga: 4,
    game: 5
  }

  validates :title, presence: true
  validates :media_type, presence: true
  validates :external_api_id, uniqueness: { scope: :external_api_source },
                              allow_nil: true
end
```

- [ ] **Step 5: マイグレーション実行**

Run: `docker compose run --rm -e RAILS_ENV=test backend bin/rails db:migrate`

- [ ] **Step 6: テストを実行してパスを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/work_spec.rb`
Expected: ALL PASS

- [ ] **Step 7: コミット**

```bash
git add backend/app/models/work.rb backend/db/migrate/*_create_works.rb backend/db/schema.rb backend/spec/models/work_spec.rb
git commit -m "feat: Workモデルを追加（6ジャンルenum、外部APIユニーク制約）"
```

---

## Task 3: Record モデル（TDD）

**Files:**
- Create: `backend/spec/models/record_spec.rb`
- Create: `backend/db/migrate/xxx_create_records.rb`
- Create: `backend/app/models/record.rb`
- Modify: `backend/app/models/user.rb`

- [ ] **Step 1: Record モデルのテストを書く**

```ruby
# backend/spec/models/record_spec.rb
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Record, type: :model do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:work) { Work.create!(title: '進撃の巨人', media_type: 'anime') }

  describe 'バリデーション' do
    it 'user_id + work_id で記録作成できる' do
      record = described_class.new(user: user, work: work)
      expect(record).to be_valid
    end

    it 'statusのデフォルト値が plan_to_watch' do
      record = described_class.create!(user: user, work: work)
      expect(record.status).to eq('plan_to_watch')
    end

    it '同じ user + work の重複を拒否' do
      described_class.create!(user: user, work: work)
      duplicate = described_class.new(user: user, work: work)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:work_id]).to be_present
    end

    it 'rating は 1〜5 の範囲' do
      record = described_class.new(user: user, work: work, rating: 6)
      expect(record).not_to be_valid
    end

    it 'rating が nil でも有効（未評価）' do
      record = described_class.new(user: user, work: work, rating: nil)
      expect(record).to be_valid
    end
  end

  describe 'enum' do
    it 'status の全値が定義されている' do
      expected = %w[watching completed on_hold dropped plan_to_watch]
      expect(described_class.statuses.keys).to match_array(expected)
    end
  end

  describe 'リレーション' do
    it 'user に属する' do
      association = described_class.reflect_on_association(:user)
      expect(association.macro).to eq(:belongs_to)
    end

    it 'work に属する' do
      association = described_class.reflect_on_association(:work)
      expect(association.macro).to eq(:belongs_to)
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/record_spec.rb`
Expected: FAIL

- [ ] **Step 3: マイグレーション作成**

Run: `docker compose run --rm backend bin/rails generate migration CreateRecords`

マイグレーションファイルを編集:

```ruby
# frozen_string_literal: true

class CreateRecords < ActiveRecord::Migration[8.1]
  def change
    create_table :records do |t|
      t.references :user, null: false, foreign_key: true
      t.references :work, null: false, foreign_key: true
      t.integer :status, null: false, default: 4
      t.integer :rating
      t.integer :current_episode, default: 0
      t.integer :rewatch_count, default: 0
      t.date :started_at
      t.date :completed_at

      t.timestamps null: false
    end

    # 同じユーザーが同じ作品を二重記録できない
    add_index :records, [:user_id, :work_id], unique: true
  end
end
```

- [ ] **Step 4: Record モデル実装**

```ruby
# backend/app/models/record.rb
# frozen_string_literal: true

class Record < ApplicationRecord
  belongs_to :user
  belongs_to :work

  # 仕様書セクション4.3: status enum
  enum :status, {
    watching: 0,
    completed: 1,
    on_hold: 2,
    dropped: 3,
    plan_to_watch: 4
  }

  validates :work_id, uniqueness: { scope: :user_id, message: 'は既に記録済みです' }
  validates :rating, inclusion: { in: 1..5 }, allow_nil: true
end
```

- [ ] **Step 5: User モデルにリレーション追加**

```ruby
# backend/app/models/user.rb に追加
has_many :records, dependent: :destroy
```

- [ ] **Step 6: マイグレーション実行 + テスト実行**

Run: `docker compose run --rm -e RAILS_ENV=test backend bin/rails db:migrate && docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/record_spec.rb`
Expected: ALL PASS

- [ ] **Step 7: 全モデルテスト実行**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/`
Expected: ALL PASS

- [ ] **Step 8: コミット**

```bash
git add backend/app/models/record.rb backend/app/models/user.rb backend/db/migrate/*_create_records.rb backend/db/schema.rb backend/spec/models/record_spec.rb
git commit -m "feat: Recordモデルを追加（ステータスenum、ユーザー重複制約）"
```

---

## Task 4: BaseAdapter（共通インターフェース）

**Files:**
- Create: `backend/app/services/external_apis/base_adapter.rb`

- [ ] **Step 1: BaseAdapter を作成**

```ruby
# backend/app/services/external_apis/base_adapter.rb
# frozen_string_literal: true

module ExternalApis
  # 外部API共通インターフェース（ADR-0011: アダプタパターン）
  # 各APIアダプタはこのクラスを継承し、search メソッドを実装する
  class BaseAdapter
    # 検索結果の統一フォーマット
    SearchResult = Struct.new(
      :title, :media_type, :description, :cover_image_url,
      :total_episodes, :external_api_id, :external_api_source, :metadata,
      keyword_init: true
    )

    # このアダプタが対応するmedia_type一覧
    def media_types
      raise NotImplementedError, "#{self.class}#media_types を実装してください"
    end

    # キーワード検索（子クラスで実装）
    def search(query)
      raise NotImplementedError, "#{self.class}#search を実装してください"
    end

    # エラーハンドリング付き検索（コントローラーから呼ぶ）
    def safe_search(query)
      search(query)
    rescue Faraday::Error => e
      Rails.logger.error("[#{self.class.name}] API通信エラー: #{e.message}")
      []
    rescue StandardError => e
      Rails.logger.error("[#{self.class.name}] 予期せぬエラー: #{e.message}")
      []
    end

    private

    def connection(url:)
      Faraday.new(url: url) do |f|
        f.request :json
        f.response :json
        f.adapter Faraday.default_adapter
      end
    end
  end
end
```

- [ ] **Step 2: コミット**

```bash
git add backend/app/services/external_apis/base_adapter.rb
git commit -m "feat: BaseAdapter（外部API共通インターフェース）を追加"
```

---

## Task 5: TmdbAdapter（TDD）

**Files:**
- Create: `backend/spec/services/external_apis/tmdb_adapter_spec.rb`
- Create: `backend/app/services/external_apis/tmdb_adapter.rb`

TMDB API仕様:
- 検索: `GET https://api.themoviedb.org/3/search/multi?api_key=KEY&query=QUERY&language=ja`
- 画像: `https://image.tmdb.org/t/p/w500{poster_path}`
- media_type: レスポンスに `movie` or `tv` が含まれる（`tv` → `drama` にマッピング）

- [ ] **Step 1: TmdbAdapter のテストを書く**

```ruby
# backend/spec/services/external_apis/tmdb_adapter_spec.rb
# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::TmdbAdapter, type: :service do
  subject(:adapter) { described_class.new }

  let(:api_key) { 'test_tmdb_key' }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('TMDB_API_KEY').and_return(api_key)
  end

  describe '#media_types' do
    it 'movie と drama を返す' do
      expect(adapter.media_types).to eq(%w[movie drama])
    end
  end

  describe '#search' do
    let(:tmdb_response) do
      {
        'results' => [
          {
            'id' => 550,
            'title' => 'ファイト・クラブ',
            'overview' => '空虚な生活を送る男の物語',
            'poster_path' => '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
            'media_type' => 'movie',
            'release_date' => '1999-10-15'
          },
          {
            'id' => 1396,
            'name' => 'ブレイキング・バッド',
            'overview' => '化学教師が犯罪に手を染める',
            'poster_path' => '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
            'media_type' => 'tv',
            'first_air_date' => '2008-01-20'
          },
          {
            'id' => 999,
            'name' => 'ある人物',
            'media_type' => 'person'
          }
        ]
      }
    end

    before do
      stub_request(:get, /api.themoviedb.org\/3\/search\/multi/)
        .to_return(status: 200, body: tmdb_response.to_json, headers: { 'Content-Type' => 'application/json' })
    end

    it 'movie と tv の結果を返す（person は除外）' do
      results = adapter.search('ファイト・クラブ')
      expect(results.length).to eq(2)
    end

    it '映画の結果を統一フォーマットで返す' do
      results = adapter.search('ファイト・クラブ')
      movie = results.find { |r| r.media_type == 'movie' }
      expect(movie.title).to eq('ファイト・クラブ')
      expect(movie.external_api_id).to eq('550')
      expect(movie.external_api_source).to eq('tmdb')
      expect(movie.cover_image_url).to include('image.tmdb.org')
    end

    it 'tv の結果を drama にマッピングする' do
      results = adapter.search('ブレイキング・バッド')
      drama = results.find { |r| r.media_type == 'drama' }
      expect(drama).to be_present
      expect(drama.title).to eq('ブレイキング・バッド')
    end

    it '結果が0件の場合は空配列を返す' do
      stub_request(:get, /api.themoviedb.org/)
        .to_return(status: 200, body: { 'results' => [] }.to_json,
                   headers: { 'Content-Type' => 'application/json' })
      expect(adapter.search('存在しない作品')).to eq([])
    end
  end

  describe '#safe_search' do
    it 'APIエラー時に空配列を返す' do
      stub_request(:get, /api.themoviedb.org/).to_return(status: 500)
      expect(adapter.safe_search('テスト')).to eq([])
    end

    it 'タイムアウト時に空配列を返す' do
      stub_request(:get, /api.themoviedb.org/).to_timeout
      expect(adapter.safe_search('テスト')).to eq([])
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/external_apis/tmdb_adapter_spec.rb`
Expected: FAIL

- [ ] **Step 3: TmdbAdapter 実装**

```ruby
# backend/app/services/external_apis/tmdb_adapter.rb
# frozen_string_literal: true

module ExternalApis
  class TmdbAdapter < BaseAdapter
    BASE_URL = 'https://api.themoviedb.org'
    IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'

    def media_types
      %w[movie drama]
    end

    def search(query)
      response = tmdb_connection.get('/3/search/multi', {
        api_key: ENV.fetch('TMDB_API_KEY'),
        query: query,
        language: 'ja'
      })

      response.body['results']
        .select { |item| %w[movie tv].include?(item['media_type']) }
        .map { |item| normalize(item) }
    end

    private

    def tmdb_connection
      @tmdb_connection ||= connection(url: BASE_URL)
    end

    def normalize(item)
      SearchResult.new(
        title: item['title'] || item['name'],
        media_type: item['media_type'] == 'tv' ? 'drama' : 'movie',
        description: item['overview'],
        cover_image_url: item['poster_path'] ? "#{IMAGE_BASE_URL}#{item['poster_path']}" : nil,
        total_episodes: nil,
        external_api_id: item['id'].to_s,
        external_api_source: 'tmdb',
        metadata: {
          release_date: item['release_date'] || item['first_air_date'],
          original_language: item['original_language'],
          vote_average: item['vote_average']
        }.compact
      )
    end
  end
end
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/external_apis/tmdb_adapter_spec.rb`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/external_apis/tmdb_adapter.rb backend/spec/services/external_apis/tmdb_adapter_spec.rb
git commit -m "feat: TmdbAdapter を実装（映画・ドラマ検索）"
```

---

## Task 6: AniListAdapter（TDD）

**Files:**
- Create: `backend/spec/services/external_apis/anilist_adapter_spec.rb`
- Create: `backend/app/services/external_apis/anilist_adapter.rb`

AniList API仕様（ADR-0010: GraphQL直接クエリ）:
- エンドポイント: `POST https://graphql.anilist.co`
- 認証不要（公開API）

- [ ] **Step 1: AniListAdapter のテストを書く**

```ruby
# backend/spec/services/external_apis/anilist_adapter_spec.rb
# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::AniListAdapter, type: :service do
  subject(:adapter) { described_class.new }

  describe '#media_types' do
    it 'anime と manga を返す' do
      expect(adapter.media_types).to eq(%w[anime manga])
    end
  end

  describe '#search' do
    let(:anilist_response) do
      {
        'data' => {
          'Page' => {
            'media' => [
              {
                'id' => 16498,
                'title' => { 'romaji' => 'Shingeki no Kyojin', 'native' => '進撃の巨人' },
                'description' => '巨人が支配する世界',
                'coverImage' => { 'large' => 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498.jpg' },
                'episodes' => 25,
                'type' => 'ANIME',
                'genres' => ['Action', 'Drama'],
                'status' => 'FINISHED',
                'seasonYear' => 2013
              },
              {
                'id' => 53390,
                'title' => { 'romaji' => 'Shingeki no Kyojin', 'native' => '進撃の巨人' },
                'description' => '巨人が支配する世界（漫画版）',
                'coverImage' => { 'large' => 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx53390.jpg' },
                'chapters' => 139,
                'type' => 'MANGA',
                'genres' => ['Action', 'Drama'],
                'status' => 'FINISHED'
              }
            ]
          }
        }
      }
    end

    before do
      stub_request(:post, 'https://graphql.anilist.co')
        .to_return(status: 200, body: anilist_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it 'anime と manga の結果を返す' do
      results = adapter.search('進撃の巨人')
      expect(results.length).to eq(2)
      expect(results.map(&:media_type)).to contain_exactly('anime', 'manga')
    end

    it 'アニメの結果を統一フォーマットで返す' do
      results = adapter.search('進撃の巨人')
      anime = results.find { |r| r.media_type == 'anime' }
      expect(anime.title).to eq('進撃の巨人')
      expect(anime.external_api_id).to eq('16498')
      expect(anime.external_api_source).to eq('anilist')
      expect(anime.total_episodes).to eq(25)
    end

    it 'native タイトルを優先する' do
      results = adapter.search('進撃の巨人')
      expect(results.first.title).to eq('進撃の巨人')
    end
  end

  describe '#safe_search' do
    it 'APIエラー時に空配列を返す' do
      stub_request(:post, 'https://graphql.anilist.co').to_return(status: 500)
      expect(adapter.safe_search('テスト')).to eq([])
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/external_apis/anilist_adapter_spec.rb`
Expected: FAIL

- [ ] **Step 3: AniListAdapter 実装**

```ruby
# backend/app/services/external_apis/anilist_adapter.rb
# frozen_string_literal: true

module ExternalApis
  class AniListAdapter < BaseAdapter
    ENDPOINT = 'https://graphql.anilist.co'

    SEARCH_QUERY = <<~GRAPHQL
      query ($search: String) {
        Page(perPage: 20) {
          media(search: $search, type: null) {
            id
            title { romaji native english }
            description(asHtml: false)
            coverImage { large }
            episodes
            chapters
            type
            genres
            status
            seasonYear
          }
        }
      }
    GRAPHQL

    def media_types
      %w[anime manga]
    end

    def search(query)
      response = anilist_connection.post(ENDPOINT, {
        query: SEARCH_QUERY,
        variables: { search: query }
      })

      media_list = response.body.dig('data', 'Page', 'media') || []
      media_list.map { |item| normalize(item) }
    end

    private

    def anilist_connection
      @anilist_connection ||= connection(url: ENDPOINT)
    end

    def normalize(item)
      media_type = item['type'] == 'MANGA' ? 'manga' : 'anime'
      title = item.dig('title', 'native') ||
              item.dig('title', 'english') ||
              item.dig('title', 'romaji')

      SearchResult.new(
        title: title,
        media_type: media_type,
        description: item['description'],
        cover_image_url: item.dig('coverImage', 'large'),
        total_episodes: item['episodes'] || item['chapters'],
        external_api_id: item['id'].to_s,
        external_api_source: 'anilist',
        metadata: {
          genres: item['genres'],
          status: item['status'],
          season_year: item['seasonYear']
        }.compact
      )
    end
  end
end
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/external_apis/anilist_adapter_spec.rb`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/external_apis/anilist_adapter.rb backend/spec/services/external_apis/anilist_adapter_spec.rb
git commit -m "feat: AniListAdapter を実装（アニメ・漫画検索、GraphQL直接クエリ）"
```

---

## Task 7: GoogleBooksAdapter（TDD）

**Files:**
- Create: `backend/spec/services/external_apis/google_books_adapter_spec.rb`
- Create: `backend/app/services/external_apis/google_books_adapter.rb`

Google Books API仕様:
- 検索: `GET https://www.googleapis.com/books/v1/volumes?q=QUERY&key=KEY`

- [ ] **Step 1: GoogleBooksAdapter のテストを書く**

```ruby
# backend/spec/services/external_apis/google_books_adapter_spec.rb
# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::GoogleBooksAdapter, type: :service do
  subject(:adapter) { described_class.new }

  let(:api_key) { 'test_google_books_key' }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOOGLE_BOOKS_API_KEY').and_return(api_key)
  end

  describe '#media_types' do
    it 'book を返す' do
      expect(adapter.media_types).to eq(%w[book])
    end
  end

  describe '#search' do
    let(:google_response) do
      {
        'items' => [
          {
            'id' => 'abc123',
            'volumeInfo' => {
              'title' => 'ノルウェイの森',
              'authors' => ['村上春樹'],
              'description' => '静かな恋愛小説',
              'imageLinks' => { 'thumbnail' => 'https://books.google.com/books/content?id=abc123' },
              'pageCount' => 298,
              'publishedDate' => '1987-09-04',
              'categories' => ['Fiction']
            }
          }
        ]
      }
    end

    before do
      stub_request(:get, /www.googleapis.com\/books\/v1\/volumes/)
        .to_return(status: 200, body: google_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it '本の検索結果を統一フォーマットで返す' do
      results = adapter.search('ノルウェイの森')
      expect(results.length).to eq(1)
      book = results.first
      expect(book.title).to eq('ノルウェイの森')
      expect(book.media_type).to eq('book')
      expect(book.external_api_id).to eq('abc123')
      expect(book.external_api_source).to eq('google_books')
      expect(book.metadata[:authors]).to eq(['村上春樹'])
    end

    it '結果がない場合は空配列を返す' do
      stub_request(:get, /www.googleapis.com/)
        .to_return(status: 200, body: { 'totalItems' => 0 }.to_json,
                   headers: { 'Content-Type' => 'application/json' })
      expect(adapter.search('存在しない本')).to eq([])
    end
  end
end
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/external_apis/google_books_adapter_spec.rb`
Expected: FAIL

- [ ] **Step 3: GoogleBooksAdapter 実装**

```ruby
# backend/app/services/external_apis/google_books_adapter.rb
# frozen_string_literal: true

module ExternalApis
  class GoogleBooksAdapter < BaseAdapter
    BASE_URL = 'https://www.googleapis.com'

    def media_types
      %w[book]
    end

    def search(query)
      response = books_connection.get('/books/v1/volumes', {
        q: query,
        key: ENV.fetch('GOOGLE_BOOKS_API_KEY'),
        maxResults: 20,
        langRestrict: 'ja'
      })

      items = response.body['items'] || []
      items.map { |item| normalize(item) }
    end

    private

    def books_connection
      @books_connection ||= connection(url: BASE_URL)
    end

    def normalize(item)
      info = item['volumeInfo'] || {}

      SearchResult.new(
        title: info['title'],
        media_type: 'book',
        description: info['description'],
        cover_image_url: info.dig('imageLinks', 'thumbnail'),
        total_episodes: nil,
        external_api_id: item['id'],
        external_api_source: 'google_books',
        metadata: {
          authors: info['authors'],
          publisher: info['publisher'],
          published_date: info['publishedDate'],
          page_count: info['pageCount'],
          categories: info['categories']
        }.compact
      )
    end
  end
end
```

- [ ] **Step 4: テスト実行してパスを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/external_apis/google_books_adapter_spec.rb`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/external_apis/google_books_adapter.rb backend/spec/services/external_apis/google_books_adapter_spec.rb
git commit -m "feat: GoogleBooksAdapter を実装（本検索）"
```

---

## Task 8: IgdbAdapter（TDD）

**Files:**
- Create: `backend/spec/services/external_apis/igdb_adapter_spec.rb`
- Create: `backend/app/services/external_apis/igdb_adapter.rb`

IGDB API仕様:
- Twitch OAuth2 Client Credentials でアクセストークン取得
- 検索: `POST https://api.igdb.com/v4/games` (body: `search "query"; fields name,summary,...;`)

- [ ] **Step 1: IgdbAdapter のテストを書く**

```ruby
# backend/spec/services/external_apis/igdb_adapter_spec.rb
# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::IgdbAdapter, type: :service do
  subject(:adapter) { described_class.new }

  let(:client_id) { 'test_igdb_client_id' }
  let(:client_secret) { 'test_igdb_client_secret' }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('IGDB_CLIENT_ID').and_return(client_id)
    allow(ENV).to receive(:fetch).with('IGDB_CLIENT_SECRET').and_return(client_secret)
    Rails.cache.clear

    # Twitch OAuth トークン取得
    stub_request(:post, 'https://id.twitch.tv/oauth2/token')
      .to_return(status: 200,
                 body: { 'access_token' => 'test_token', 'expires_in' => 5_000_000 }.to_json,
                 headers: { 'Content-Type' => 'application/json' })
  end

  describe '#media_types' do
    it 'game を返す' do
      expect(adapter.media_types).to eq(%w[game])
    end
  end

  describe '#search' do
    let(:igdb_response) do
      [
        {
          'id' => 1942,
          'name' => 'The Witcher 3: Wild Hunt',
          'summary' => 'オープンワールドRPG',
          'cover' => { 'image_id' => 'co1wyy' },
          'platforms' => [{ 'name' => 'PC' }, { 'name' => 'PlayStation 4' }],
          'genres' => [{ 'name' => 'RPG' }],
          'first_release_date' => 1_431_993_600
        }
      ]
    end

    before do
      stub_request(:post, 'https://api.igdb.com/v4/games')
        .to_return(status: 200, body: igdb_response.to_json,
                   headers: { 'Content-Type' => 'application/json' })
    end

    it 'ゲームの検索結果を統一フォーマットで返す' do
      results = adapter.search('Witcher')
      expect(results.length).to eq(1)
      game = results.first
      expect(game.title).to eq('The Witcher 3: Wild Hunt')
      expect(game.media_type).to eq('game')
      expect(game.external_api_id).to eq('1942')
      expect(game.external_api_source).to eq('igdb')
      expect(game.cover_image_url).to include('images.igdb.com')
    end

    it 'Twitch OAuth トークンを取得してAPIに送信する' do
      adapter.search('Witcher')
      expect(WebMock).to have_requested(:post, 'https://id.twitch.tv/oauth2/token')
      expect(WebMock).to have_requested(:post, 'https://api.igdb.com/v4/games')
        .with(headers: { 'Authorization' => 'Bearer test_token', 'Client-ID' => client_id })
    end
  end

  describe '#safe_search' do
    it 'OAuth認証失敗時に空配列を返す' do
      stub_request(:post, 'https://id.twitch.tv/oauth2/token').to_return(status: 401)
      expect(adapter.safe_search('テスト')).to eq([])
    end
  end
end
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/external_apis/igdb_adapter_spec.rb`
Expected: FAIL

- [ ] **Step 3: IgdbAdapter 実装**

```ruby
# backend/app/services/external_apis/igdb_adapter.rb
# frozen_string_literal: true

module ExternalApis
  class IgdbAdapter < BaseAdapter
    IGDB_URL = 'https://api.igdb.com/v4'
    TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
    IMAGE_BASE_URL = 'https://images.igdb.com/igdb/image/upload/t_cover_big'
    TOKEN_CACHE_KEY = 'igdb_access_token'

    def media_types
      %w[game]
    end

    def search(query)
      # ユーザー入力のダブルクオート・セミコロンをエスケープ（IGDBクエリ言語の構文破壊防止）
      sanitized = query.gsub('"', '\\"').gsub(';', '')
      response = igdb_connection.post('/v4/games',
        "search \"#{sanitized}\"; fields name,summary,cover.image_id,platforms.name,genres.name,first_release_date; limit 20;")

      (response.body || []).map { |item| normalize(item) }
    end

    private

    def igdb_connection
      token = access_token
      client_id = ENV.fetch('IGDB_CLIENT_ID')

      Faraday.new(url: IGDB_URL) do |f|
        f.request :json
        f.response :json
        f.headers['Authorization'] = "Bearer #{token}"
        f.headers['Client-ID'] = client_id
        f.adapter Faraday.default_adapter
      end
    end

    def access_token
      Rails.cache.fetch(TOKEN_CACHE_KEY, expires_in: 50.days) do
        response = Faraday.post(TWITCH_TOKEN_URL, {
          client_id: ENV.fetch('IGDB_CLIENT_ID'),
          client_secret: ENV.fetch('IGDB_CLIENT_SECRET'),
          grant_type: 'client_credentials'
        })
        JSON.parse(response.body)['access_token']
      end
    end

    def normalize(item)
      cover_id = item.dig('cover', 'image_id')

      SearchResult.new(
        title: item['name'],
        media_type: 'game',
        description: item['summary'],
        cover_image_url: cover_id ? "#{IMAGE_BASE_URL}/#{cover_id}.jpg" : nil,
        total_episodes: nil,
        external_api_id: item['id'].to_s,
        external_api_source: 'igdb',
        metadata: {
          platforms: item['platforms']&.map { |p| p['name'] },
          genres: item['genres']&.map { |g| g['name'] },
          first_release_date: item['first_release_date']
        }.compact
      )
    end
  end
end
```

- [ ] **Step 4: テスト実行してパスを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/external_apis/igdb_adapter_spec.rb`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/external_apis/igdb_adapter.rb backend/spec/services/external_apis/igdb_adapter_spec.rb
git commit -m "feat: IgdbAdapter を実装（ゲーム検索、Twitch OAuth2）"
```

---

## Task 9: WorkSearchService（TDD）

**Files:**
- Create: `backend/spec/services/work_search_service_spec.rb`
- Create: `backend/app/services/work_search_service.rb`

- [ ] **Step 1: WorkSearchService のテストを書く**

```ruby
# backend/spec/services/work_search_service_spec.rb
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe WorkSearchService, type: :service do
  subject(:service) { described_class.new }

  let(:mock_result) do
    ExternalApis::BaseAdapter::SearchResult.new(
      title: 'テスト作品', media_type: 'anime', description: '説明',
      cover_image_url: nil, total_episodes: 12,
      external_api_id: '1', external_api_source: 'anilist', metadata: {}
    )
  end

  before do
    Rails.cache.clear
    # 各アダプタをスタブ化
    allow_any_instance_of(ExternalApis::TmdbAdapter).to receive(:safe_search).and_return([])
    allow_any_instance_of(ExternalApis::AniListAdapter).to receive(:safe_search).and_return([mock_result])
    allow_any_instance_of(ExternalApis::GoogleBooksAdapter).to receive(:safe_search).and_return([])
    allow_any_instance_of(ExternalApis::IgdbAdapter).to receive(:safe_search).and_return([])
  end

  describe '#search' do
    it 'ジャンル指定なしで全アダプタに問い合わせる' do
      results = service.search('テスト')
      expect(results.length).to eq(1)
      expect(results.first.title).to eq('テスト作品')
    end

    it 'media_type: anime で AniListAdapter のみに問い合わせる' do
      expect_any_instance_of(ExternalApis::TmdbAdapter).not_to receive(:safe_search)
      results = service.search('テスト', media_type: 'anime')
      expect(results.length).to eq(1)
    end

    it 'media_type: movie で TmdbAdapter のみに問い合わせる' do
      expect_any_instance_of(ExternalApis::AniListAdapter).not_to receive(:safe_search)
      service.search('テスト', media_type: 'movie')
    end

    it 'media_type: book で GoogleBooksAdapter のみに問い合わせる' do
      expect_any_instance_of(ExternalApis::AniListAdapter).not_to receive(:safe_search)
      service.search('テスト', media_type: 'book')
    end

    it 'media_type: game で IgdbAdapter のみに問い合わせる' do
      expect_any_instance_of(ExternalApis::AniListAdapter).not_to receive(:safe_search)
      service.search('テスト', media_type: 'game')
    end
  end

  describe 'キャッシュ' do
    it '同じクエリの2回目はキャッシュから返す（APIを再呼び出ししない）' do
      service.search('テスト')

      # 2回目: アダプタが呼ばれないことを確認
      expect_any_instance_of(ExternalApis::AniListAdapter).not_to receive(:safe_search)
      results = service.search('テスト')
      expect(results.length).to eq(1)
    end

    it '異なるmedia_typeは別のキャッシュキーを使う' do
      service.search('テスト', media_type: 'anime')
      # 別のmedia_typeでは新しく検索される
      expect_any_instance_of(ExternalApis::TmdbAdapter).to receive(:safe_search).and_return([])
      service.search('テスト', media_type: 'movie')
    end
  end
end
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/work_search_service_spec.rb`
Expected: FAIL

- [ ] **Step 3: WorkSearchService 実装**

```ruby
# backend/app/services/work_search_service.rb
# frozen_string_literal: true

class WorkSearchService
  CACHE_TTL = 30.minutes

  # media_type → 対応するアダプタクラスのマッピング
  ADAPTER_MAP = {
    'movie' => ExternalApis::TmdbAdapter,
    'drama' => ExternalApis::TmdbAdapter,
    'anime' => ExternalApis::AniListAdapter,
    'manga' => ExternalApis::AniListAdapter,
    'book' => ExternalApis::GoogleBooksAdapter,
    'game' => ExternalApis::IgdbAdapter
  }.freeze

  def search(query, media_type: nil)
    cache_key = "work_search:#{media_type || 'all'}:#{query}"

    Rails.cache.fetch(cache_key, expires_in: CACHE_TTL) do
      adapters = select_adapters(media_type)
      adapters.flat_map { |adapter| adapter.safe_search(query) }
    end
  end

  private

  def select_adapters(media_type)
    if media_type.present?
      adapter_class = ADAPTER_MAP[media_type]
      adapter_class ? [adapter_class.new] : []
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
end
```

- [ ] **Step 4: テスト実行してパスを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/work_search_service_spec.rb`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "feat: WorkSearchService を実装（アダプタ選択 + キャッシュ）"
```

---

## Task 10: Works API — 検索 + 手動登録（TDD）

**Files:**
- Create: `backend/spec/requests/api/v1/works_spec.rb`
- Create: `backend/app/controllers/api/v1/works_controller.rb`
- Modify: `backend/config/routes.rb`

- [ ] **Step 1: Works API のテストを書く**

```ruby
# backend/spec/requests/api/v1/works_spec.rb
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Works', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:mock_results) do
    [
      ExternalApis::BaseAdapter::SearchResult.new(
        title: 'テスト作品', media_type: 'anime', description: '説明',
        cover_image_url: 'https://example.com/img.jpg', total_episodes: 12,
        external_api_id: '1', external_api_source: 'anilist', metadata: {}
      )
    ]
  end

  before do
    allow_any_instance_of(WorkSearchService).to receive(:search).and_return(mock_results)
  end

  describe 'GET /api/v1/works/search' do
    context '認証済み' do
      before { sign_in user }

      it 'キーワードで検索して結果を返す' do
        get '/api/v1/works/search', params: { q: 'テスト' }, as: :json
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json['results'].length).to eq(1)
        expect(json['results'].first['title']).to eq('テスト作品')
      end

      it 'media_typeフィルタで絞り込みできる' do
        get '/api/v1/works/search', params: { q: 'テスト', media_type: 'anime' }, as: :json
        expect(response).to have_http_status(:ok)
      end

      it 'キーワード未指定で422' do
        get '/api/v1/works/search', params: {}, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    context '未認証' do
      it '401を返す' do
        get '/api/v1/works/search', params: { q: 'テスト' }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'POST /api/v1/works（手動登録）' do
    let(:work_params) do
      { work: { title: '手動登録作品', media_type: 'anime', description: '手動で追加' } }
    end

    context '認証済み' do
      before { sign_in user }

      it 'title + media_type で作品を登録して201を返す' do
        post '/api/v1/works', params: work_params, as: :json
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['work']['title']).to eq('手動登録作品')
      end

      it 'Workレコードが作成される' do
        expect do
          post '/api/v1/works', params: work_params, as: :json
        end.to change(Work, :count).by(1)
      end

      it 'titleなしで422' do
        post '/api/v1/works', params: { work: { media_type: 'anime' } }, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    context '未認証' do
      it '401を返す' do
        post '/api/v1/works', params: work_params, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/works_spec.rb`
Expected: FAIL

- [ ] **Step 3: ルーティング追加**

`backend/config/routes.rb` の `namespace :api / namespace :v1` ブロック内に追加:

```ruby
# 作品検索・手動登録
resources :works, only: [:create] do
  collection do
    get :search
  end
end
```

- [ ] **Step 4: WorksController 実装**

```ruby
# backend/app/controllers/api/v1/works_controller.rb
# frozen_string_literal: true

module Api
  module V1
    class WorksController < ApplicationController
      before_action :authenticate_user!

      # GET /api/v1/works/search?q=キーワード&media_type=anime
      def search
        query = params[:q]
        return render json: { error: '検索キーワードを入力してください' }, status: :unprocessable_entity if query.blank?

        results = WorkSearchService.new.search(query, media_type: params[:media_type])
        render json: { results: results.map(&:to_h) }
      end

      # POST /api/v1/works（手動登録）
      def create
        work = Work.new(work_params)

        if work.save
          render json: { work: work.as_json }, status: :created
        else
          render json: { errors: work.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def work_params
        params.expect(work: %i[title media_type description cover_image_url total_episodes])
      end
    end
  end
end
```

- [ ] **Step 5: テスト実行してパスを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/works_spec.rb`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add backend/app/controllers/api/v1/works_controller.rb backend/config/routes.rb backend/spec/requests/api/v1/works_spec.rb
git commit -m "feat: Works API を実装（検索 + 手動登録エンドポイント）"
```

---

## Task 11: Records API — 記録作成（TDD）

**Files:**
- Create: `backend/spec/requests/api/v1/records_spec.rb`
- Create: `backend/app/controllers/api/v1/records_controller.rb`
- Modify: `backend/config/routes.rb`

- [ ] **Step 1: Records API のテストを書く**

```ruby
# backend/spec/requests/api/v1/records_spec.rb
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Records', type: :request do
  let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
  let(:existing_work) { Work.create!(title: '既存作品', media_type: 'anime') }

  describe 'POST /api/v1/records' do
    context '認証済み' do
      before { sign_in user }

      it '既存Workへの記録追加で201を返す' do
        post '/api/v1/records', params: { record: { work_id: existing_work.id } }, as: :json
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['record']['work_id']).to eq(existing_work.id)
        expect(json['record']['status']).to eq('plan_to_watch')
      end

      it 'work_data からWorkを作成して記録追加（検索結果から記録）' do
        record_params = {
          record: {
            work_data: {
              title: '新規作品',
              media_type: 'anime',
              description: '外部APIからの作品',
              external_api_id: '99999',
              external_api_source: 'anilist'
            }
          }
        }
        expect do
          post '/api/v1/records', params: record_params, as: :json
        end.to change(Work, :count).by(1).and change(Record, :count).by(1)
        expect(response).to have_http_status(:created)
      end

      it '同じexternal_api_id + sourceのWorkが既存なら再利用する' do
        Work.create!(title: '既存外部作品', media_type: 'anime',
                     external_api_id: '99999', external_api_source: 'anilist')
        record_params = {
          record: {
            work_data: {
              title: '既存外部作品', media_type: 'anime',
              external_api_id: '99999', external_api_source: 'anilist'
            }
          }
        }
        expect do
          post '/api/v1/records', params: record_params, as: :json
        end.to change(Work, :count).by(0).and change(Record, :count).by(1)
      end

      it '同じ作品を二重記録しようとすると422' do
        Record.create!(user: user, work: existing_work)
        post '/api/v1/records', params: { record: { work_id: existing_work.id } }, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'work_id も work_data もない場合は422' do
        post '/api/v1/records', params: { record: {} }, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    context '未認証' do
      it '401を返す' do
        post '/api/v1/records', params: { record: { work_id: existing_work.id } }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/records_spec.rb`
Expected: FAIL

- [ ] **Step 3: ルーティング追加**

`backend/config/routes.rb` の `namespace :api / namespace :v1` ブロック内に追加:

```ruby
# 記録（ライブラリ追加）
resources :records, only: [:create]
```

- [ ] **Step 4: RecordsController 実装**

```ruby
# backend/app/controllers/api/v1/records_controller.rb
# frozen_string_literal: true

module Api
  module V1
    class RecordsController < ApplicationController
      before_action :authenticate_user!

      # POST /api/v1/records
      def create
        work = find_or_create_work
        return render json: { error: 'work_id または work_data が必要です' }, status: :unprocessable_entity unless work

        record = current_user.records.new(work: work)

        if record.save
          render json: { record: record.as_json(include: :work) }, status: :created
        else
          render json: { errors: record.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def find_or_create_work
        if params.dig(:record, :work_id).present?
          Work.find_by(id: params[:record][:work_id])
        elsif params.dig(:record, :work_data).present?
          find_or_create_from_external
        end
      end

      def find_or_create_from_external
        data = params.expect(record: { work_data: %i[title media_type description
                                                      cover_image_url total_episodes
                                                      external_api_id external_api_source] })[:work_data]

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
      end
    end
  end
end
```

- [ ] **Step 5: テスト実行してパスを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/records_spec.rb`
Expected: ALL PASS

- [ ] **Step 6: バックエンド全テスト実行**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec`
Expected: ALL PASS

- [ ] **Step 7: コミット**

```bash
git add backend/app/controllers/api/v1/records_controller.rb backend/config/routes.rb backend/spec/requests/api/v1/records_spec.rb
git commit -m "feat: Records API を実装（ライブラリ追加、Work自動作成）"
```

---

## Task 12: フロントエンド — 型定義 + API通信（TDD）

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/worksApi.ts`
- Create: `frontend/src/lib/worksApi.test.ts`
- Create: `frontend/src/lib/recordsApi.ts`
- Create: `frontend/src/lib/recordsApi.test.ts`

- [ ] **Step 1: 型定義を追加**

`frontend/src/lib/types.ts` に以下を追加:

```typescript
// メディアジャンル
export type MediaType = 'anime' | 'movie' | 'drama' | 'book' | 'manga' | 'game'

// 記録ステータス
export type RecordStatus = 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch'

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
  metadata: Record<string, unknown>
  created_at: string
}

// 検索結果（外部APIからの結果、DB未保存）
export interface SearchResult {
  title: string
  media_type: MediaType
  description: string | null
  cover_image_url: string | null
  total_episodes: number | null
  external_api_id: string | null
  external_api_source: string | null
  metadata: Record<string, unknown>
}

// 記録
export interface UserRecord {
  id: number
  work_id: number
  status: RecordStatus
  rating: number | null
  current_episode: number
  rewatch_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  work: Work
}

// API レスポンス型
export interface SearchResponse {
  results: SearchResult[]
}

export interface WorkResponse {
  work: Work
}

export interface RecordResponse {
  record: UserRecord
}
```

- [ ] **Step 2: api.ts の request 関数を export する**

`frontend/src/lib/api.ts` の `request` 関数を export:

```typescript
// async function request → export async function request に変更
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
```

- [ ] **Step 3: worksApi のテストを書く**

```typescript
// frontend/src/lib/worksApi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { worksApi } from './worksApi'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('worksApi', () => {
  describe('search', () => {
    it('正常系: 検索結果を返す', async () => {
      const searchData = {
        results: [
          { title: 'テスト作品', media_type: 'anime', description: '説明' },
        ],
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(searchData),
      })

      const result = await worksApi.search('テスト')
      expect(result.results).toHaveLength(1)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/works/search?q=%E3%83%86%E3%82%B9%E3%83%88',
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    it('media_type指定時にクエリパラメータに含まれる', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })

      await worksApi.search('テスト', 'anime')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('media_type=anime'),
        expect.any(Object),
      )
    })
  })

  describe('create', () => {
    it('正常系: 作品を手動登録して返す', async () => {
      const workData = { work: { id: 1, title: '手動作品', media_type: 'anime' } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(workData),
      })

      const result = await worksApi.create('手動作品', 'anime', '説明')
      expect(result.work.title).toBe('手動作品')
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/works',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })
})
```

- [ ] **Step 4: worksApi 実装**

```typescript
// frontend/src/lib/worksApi.ts
import type { SearchResponse, WorkResponse, MediaType } from './types'
import { request } from './api'

export const worksApi = {
  search(query: string, mediaType?: MediaType): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query })
    if (mediaType) params.append('media_type', mediaType)
    return request<SearchResponse>(`/works/search?${params.toString()}`)
  },

  create(
    title: string,
    mediaType: MediaType,
    description?: string,
  ): Promise<WorkResponse> {
    return request<WorkResponse>('/works', {
      method: 'POST',
      body: JSON.stringify({
        work: { title, media_type: mediaType, description },
      }),
    })
  },
}
```

- [ ] **Step 5: recordsApi のテストを書く**

```typescript
// frontend/src/lib/recordsApi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recordsApi } from './recordsApi'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('recordsApi', () => {
  describe('create (from work_id)', () => {
    it('正常系: 既存Workへの記録を作成', async () => {
      const recordData = { record: { id: 1, work_id: 10, status: 'plan_to_watch' } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(recordData),
      })

      const result = await recordsApi.createFromWorkId(10)
      expect(result.record.work_id).toBe(10)
    })
  })

  describe('create (from search result)', () => {
    it('正常系: 検索結果から記録を作成', async () => {
      const recordData = { record: { id: 1, work_id: 1, status: 'plan_to_watch' } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(recordData),
      })

      const workData = {
        title: 'テスト',
        media_type: 'anime' as const,
        external_api_id: '123',
        external_api_source: 'anilist',
      }
      const result = await recordsApi.createFromSearchResult(workData)
      expect(result.record.status).toBe('plan_to_watch')
    })
  })
})
```

- [ ] **Step 6: recordsApi 実装**

```typescript
// frontend/src/lib/recordsApi.ts
import type { RecordResponse, SearchResult } from './types'
import { request } from './api'

export const recordsApi = {
  createFromWorkId(workId: number): Promise<RecordResponse> {
    return request<RecordResponse>('/records', {
      method: 'POST',
      body: JSON.stringify({ record: { work_id: workId } }),
    })
  },

  createFromSearchResult(
    workData: Pick<SearchResult, 'title' | 'media_type' | 'description' | 'cover_image_url' | 'total_episodes' | 'external_api_id' | 'external_api_source'>,
  ): Promise<RecordResponse> {
    return request<RecordResponse>('/records', {
      method: 'POST',
      body: JSON.stringify({ record: { work_data: workData } }),
    })
  },
}
```

- [ ] **Step 7: テスト実行**

Run: `docker compose run --rm frontend npm test -- --run`
Expected: ALL PASS

- [ ] **Step 8: コミット**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/src/lib/worksApi.ts frontend/src/lib/worksApi.test.ts frontend/src/lib/recordsApi.ts frontend/src/lib/recordsApi.test.ts
git commit -m "feat: フロントエンド型定義 + 作品検索・記録API通信を追加"
```

---

## Task 13: WorkCard コンポーネント（TDD）

**Files:**
- Create: `frontend/src/components/WorkCard/WorkCard.test.tsx`
- Create: `frontend/src/components/WorkCard/WorkCard.tsx`
- Create: `frontend/src/components/WorkCard/WorkCard.module.css`

- [ ] **Step 1: WorkCard テストを書く**

```tsx
// frontend/src/components/WorkCard/WorkCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkCard } from './WorkCard'
import type { SearchResult } from '../../lib/types'

const mockWork: SearchResult = {
  title: 'テスト作品',
  media_type: 'anime',
  description: 'テストの説明文',
  cover_image_url: 'https://example.com/cover.jpg',
  total_episodes: 12,
  external_api_id: '123',
  external_api_source: 'anilist',
  metadata: {},
}

describe('WorkCard', () => {
  it('作品タイトルが表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    expect(screen.getByText('テスト作品')).toBeInTheDocument()
  })

  it('ジャンルラベルが表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    expect(screen.getByText('アニメ')).toBeInTheDocument()
  })

  it('「記録する」ボタンが表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    expect(screen.getByRole('button', { name: '記録する' })).toBeInTheDocument()
  })

  it('「記録する」ボタン押下でコールバックが呼ばれる', async () => {
    const onRecord = vi.fn()
    render(<WorkCard work={mockWork} onRecord={onRecord} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '記録する' }))
    expect(onRecord).toHaveBeenCalledWith(mockWork)
  })

  it('記録済みの場合は「記録済み」と表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} isRecorded />)
    expect(screen.getByText('記録済み')).toBeInTheDocument()
  })

  it('カバー画像が表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg')
  })
})
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm frontend npm test -- --run WorkCard`
Expected: FAIL

- [ ] **Step 3: WorkCard 実装**

```tsx
// frontend/src/components/WorkCard/WorkCard.tsx
import type { SearchResult, MediaType } from '../../lib/types'
import { Button } from '../ui/Button/Button'
import styles from './WorkCard.module.css'

type WorkCardProps = {
  work: SearchResult
  onRecord: (work: SearchResult) => void
  isRecorded?: boolean
  isLoading?: boolean
}

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  anime: 'アニメ',
  movie: '映画',
  drama: 'ドラマ',
  book: '本',
  manga: '漫画',
  game: 'ゲーム',
}

export function WorkCard({ work, onRecord, isRecorded = false, isLoading = false }: WorkCardProps) {
  const handleRecord = () => {
    if (!isRecorded && !isLoading) {
      onRecord(work)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.coverWrapper}>
        {work.cover_image_url ? (
          <img
            className={styles.cover}
            src={work.cover_image_url}
            alt={`${work.title}のカバー画像`}
          />
        ) : (
          <div className={styles.coverPlaceholder} />
        )}
      </div>
      <div className={styles.info}>
        <span className={`${styles.genre} ${styles[work.media_type]}`}>
          {MEDIA_TYPE_LABELS[work.media_type]}
        </span>
        <h3 className={styles.title}>{work.title}</h3>
        {work.description && (
          <p className={styles.description}>{work.description}</p>
        )}
        {isRecorded ? (
          <span className={styles.recorded}>記録済み</span>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={handleRecord}
            disabled={isLoading}
          >
            {isLoading ? '記録中...' : '記録する'}
          </Button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: WorkCard スタイル作成**

```css
/* frontend/src/components/WorkCard/WorkCard.module.css */
.card {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-bottom: var(--border-width) var(--border-style) var(--color-border-light);
}

.coverWrapper {
  flex-shrink: 0;
  width: 80px;
  height: 120px;
}

.cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.coverPlaceholder {
  width: 100%;
  height: 100%;
  background-color: var(--color-border-light);
}

.info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.genre {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
}

.anime { color: var(--color-anime); }
.movie { color: var(--color-movie); }
.drama { color: var(--color-drama); }
.book { color: var(--color-book); }
.manga { color: var(--color-manga); }
.game { color: var(--color-game); }

.title {
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0;
}

.description {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recorded {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
}
```

- [ ] **Step 5: テスト実行してパスを確認**

Run: `docker compose run --rm frontend npm test -- --run WorkCard`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/WorkCard/
git commit -m "feat: WorkCard コンポーネントを追加（ジャンルカラー、記録ボタン）"
```

---

## Task 14: ManualWorkForm コンポーネント（TDD）

**Files:**
- Create: `frontend/src/components/ManualWorkForm/ManualWorkForm.test.tsx`
- Create: `frontend/src/components/ManualWorkForm/ManualWorkForm.tsx`
- Create: `frontend/src/components/ManualWorkForm/ManualWorkForm.module.css`

- [ ] **Step 1: ManualWorkForm テストを書く**

```tsx
// frontend/src/components/ManualWorkForm/ManualWorkForm.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ManualWorkForm } from './ManualWorkForm'

describe('ManualWorkForm', () => {
  it('タイトルとジャンルの入力欄が表示される', () => {
    render(<ManualWorkForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('タイトル')).toBeInTheDocument()
    expect(screen.getByLabelText('ジャンル')).toBeInTheDocument()
  })

  it('タイトルとジャンルを入力して送信できる', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ManualWorkForm onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('タイトル'), 'テスト作品')
    await user.selectOptions(screen.getByLabelText('ジャンル'), 'anime')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(onSubmit).toHaveBeenCalledWith('テスト作品', 'anime', '')
  })

  it('タイトル未入力でバリデーションエラー', async () => {
    render(<ManualWorkForm onSubmit={vi.fn()} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '登録する' }))
    expect(screen.getByText('タイトルを入力してください')).toBeInTheDocument()
  })

  it('登録成功後にフォームがリセットされる', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ManualWorkForm onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('タイトル'), 'テスト作品')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    const titleInput = screen.getByLabelText('タイトル') as HTMLInputElement
    expect(titleInput.value).toBe('')
  })
})
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm frontend npm test -- --run ManualWorkForm`
Expected: FAIL

- [ ] **Step 3: ManualWorkForm 実装**

```tsx
// frontend/src/components/ManualWorkForm/ManualWorkForm.tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { MediaType } from '../../lib/types'
import { Button } from '../ui/Button/Button'
import styles from './ManualWorkForm.module.css'

type ManualWorkFormProps = {
  onSubmit: (title: string, mediaType: MediaType, description: string) => Promise<void>
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
      await onSubmit(title, mediaType, description)
      setTitle('')
      setDescription('')
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

- [ ] **Step 4: ManualWorkForm スタイル作成**

```css
/* frontend/src/components/ManualWorkForm/ManualWorkForm.module.css */
.form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border: var(--border-width) var(--border-style) var(--color-border-light);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.field label {
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  font-weight: 600;
  color: var(--color-text);
}

.field input,
.field select,
.field textarea {
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) var(--border-style) var(--color-text);
  border-radius: 0;
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  color: var(--color-text);
  background-color: var(--color-bg);
  transition: border-color var(--transition-fast);
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.error {
  color: var(--color-error);
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
}
```

- [ ] **Step 5: テスト実行してパスを確認**

Run: `docker compose run --rm frontend npm test -- --run ManualWorkForm`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ManualWorkForm/
git commit -m "feat: ManualWorkForm コンポーネントを追加（手動作品登録フォーム）"
```

---

## Task 15: SearchPage コンポーネント（TDD）

**Files:**
- Create: `frontend/src/pages/SearchPage/SearchPage.test.tsx`
- Create: `frontend/src/pages/SearchPage/SearchPage.tsx`
- Create: `frontend/src/pages/SearchPage/SearchPage.module.css`

- [ ] **Step 1: SearchPage テストを書く**

```tsx
// frontend/src/pages/SearchPage/SearchPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { SearchPage } from './SearchPage'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  // 初回セッション確認: 認証済み
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ user: { id: 1, username: 'test', email: 'test@example.com' } }),
  })
})

function renderSearchPage() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <SearchPage />
      </AuthProvider>
    </BrowserRouter>,
  )
}

describe('SearchPage', () => {
  it('検索バーが表示される', async () => {
    renderSearchPage()
    expect(await screen.findByPlaceholderText('作品を検索...')).toBeInTheDocument()
  })

  it('ジャンルフィルタが表示される', async () => {
    renderSearchPage()
    expect(await screen.findByText('すべて')).toBeInTheDocument()
    expect(screen.getByText('アニメ')).toBeInTheDocument()
    expect(screen.getByText('映画')).toBeInTheDocument()
  })

  it('キーワード入力→検索で結果が表示される', async () => {
    renderSearchPage()
    const user = userEvent.setup()

    // 検索APIの応答
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [
          {
            title: 'テスト作品', media_type: 'anime', description: '説明',
            cover_image_url: null, total_episodes: 12,
            external_api_id: '1', external_api_source: 'anilist', metadata: {},
          },
        ],
      }),
    })

    const searchInput = await screen.findByPlaceholderText('作品を検索...')
    await user.type(searchInput, 'テスト')
    await user.click(screen.getByRole('button', { name: '検索' }))

    await waitFor(() => {
      expect(screen.getByText('テスト作品')).toBeInTheDocument()
    })
  })

  it('結果がない場合「見つかりませんでした」と表示される', async () => {
    renderSearchPage()
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    })

    const searchInput = await screen.findByPlaceholderText('作品を検索...')
    await user.type(searchInput, '存在しない')
    await user.click(screen.getByRole('button', { name: '検索' }))

    await waitFor(() => {
      expect(screen.getByText('作品が見つかりませんでした')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm frontend npm test -- --run SearchPage`
Expected: FAIL

- [ ] **Step 3: SearchPage 実装**

```tsx
// frontend/src/pages/SearchPage/SearchPage.tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SearchResult, MediaType } from '../../lib/types'
import { worksApi } from '../../lib/worksApi'
import { recordsApi } from '../../lib/recordsApi'
import { ApiError } from '../../lib/api'
import { WorkCard } from '../../components/WorkCard/WorkCard'
import { ManualWorkForm } from '../../components/ManualWorkForm/ManualWorkForm'
import { Typography } from '../../components/ui/Typography/Typography'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { Button } from '../../components/ui/Button/Button'
import styles from './SearchPage.module.css'

type GenreFilter = MediaType | 'all'

const GENRE_FILTERS: { value: GenreFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'anime', label: 'アニメ' },
  { value: 'movie', label: '映画' },
  { value: 'drama', label: 'ドラマ' },
  { value: 'book', label: '本' },
  { value: 'manga', label: '漫画' },
  { value: 'game', label: 'ゲーム' },
]

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState<GenreFilter>('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set())
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState('')
  const [showManualForm, setShowManualForm] = useState(false)

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsSearching(true)
    setError('')
    setHasSearched(true)

    try {
      const mediaType = genre === 'all' ? undefined : genre
      const response = await worksApi.search(query, mediaType)
      setResults(response.results)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('検索に失敗しました')
      }
    } finally {
      setIsSearching(false)
    }
  }

  const handleRecord = async (work: SearchResult) => {
    const workKey = `${work.external_api_source}:${work.external_api_id}`
    setLoadingId(workKey)

    try {
      await recordsApi.createFromSearchResult(work)
      setRecordedIds((prev) => new Set(prev).add(workKey))
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      }
    } finally {
      setLoadingId(null)
    }
  }

  const handleManualSubmit = async (title: string, mediaType: MediaType, description: string) => {
    await worksApi.create(title, mediaType, description)
    setShowManualForm(false)
  }

  const handleGenreChange = (newGenre: GenreFilter) => {
    setGenre(newGenre)
    if (query.trim() && hasSearched) {
      setIsSearching(true)
      setError('')
      const mediaType = newGenre === 'all' ? undefined : newGenre
      worksApi.search(query, mediaType)
        .then((response) => setResults(response.results))
        .catch(() => setError('検索に失敗しました'))
        .finally(() => setIsSearching(false))
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Typography variant="h2">作品検索</Typography>

        <form className={styles.searchForm} onSubmit={handleSearch}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="作品を検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button variant="primary" type="submit" disabled={isSearching}>
            {isSearching ? '検索中...' : '検索'}
          </Button>
        </form>

        <div className={styles.filters}>
          {GENRE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              className={`${styles.filterButton} ${genre === filter.value ? styles.filterActive : ''}`}
              onClick={() => handleGenreChange(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {isSearching && <p className={styles.loading}>検索中...</p>}

        {!isSearching && hasSearched && results.length === 0 && (
          <div className={styles.empty}>
            <p>作品が見つかりませんでした</p>
            <Button
              variant="secondary"
              onClick={() => setShowManualForm(true)}
            >
              手動で登録する
            </Button>
          </div>
        )}

        {results.length > 0 && (
          <div className={styles.results}>
            {results.map((work) => {
              const workKey = `${work.external_api_source}:${work.external_api_id}`
              return (
                <WorkCard
                  key={workKey}
                  work={work}
                  onRecord={handleRecord}
                  isRecorded={recordedIds.has(workKey)}
                  isLoading={loadingId === workKey}
                />
              )
            })}
          </div>
        )}

        <div className={styles.manualSection}>
          <SectionTitle>手動登録</SectionTitle>
          <Button
            variant="ghost"
            onClick={() => setShowManualForm(!showManualForm)}
          >
            {showManualForm ? '閉じる' : '作品を手動で登録する'}
          </Button>
          {showManualForm && <ManualWorkForm onSubmit={handleManualSubmit} />}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: SearchPage スタイル作成**

```css
/* frontend/src/pages/SearchPage/SearchPage.module.css */
.page {
  min-height: 100vh;
  background-color: var(--color-bg);
  padding: var(--spacing-xl);
}

.container {
  max-width: 800px;
  margin: 0 auto;
}

.searchForm {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
}

.searchInput {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) var(--border-style) var(--color-text);
  border-radius: 0;
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  color: var(--color-text);
  background-color: var(--color-bg-white);
  transition: border-color var(--transition-fast);
}

.searchInput:focus {
  outline: none;
  border-color: var(--color-primary);
}

.filters {
  display: flex;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-md);
  flex-wrap: wrap;
}

.filterButton {
  padding: var(--spacing-xs) var(--spacing-md);
  border: var(--border-width) var(--border-style) var(--color-border-light);
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

.error {
  color: var(--color-error);
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  margin-top: var(--spacing-md);
}

.loading {
  text-align: center;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  margin-top: var(--spacing-xl);
}

.empty {
  text-align: center;
  margin-top: var(--spacing-xl);
  color: var(--color-text-muted);
  font-family: var(--font-body);
}

.empty p {
  margin-bottom: var(--spacing-md);
}

.results {
  margin-top: var(--spacing-lg);
}

.manualSection {
  margin-top: var(--spacing-2xl);
}
```

- [ ] **Step 5: テスト実行してパスを確認**

Run: `docker compose run --rm frontend npm test -- --run SearchPage`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/SearchPage/
git commit -m "feat: SearchPage を追加（検索バー、ジャンルフィルタ、手動登録セクション）"
```

---

## Task 16: ルーティング + lint + 仕上げ

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: App.tsx に /search ルートを追加**

```tsx
// import追加
import { SearchPage } from './pages/SearchPage/SearchPage'

// Routesの中に追加（DashboardPageのRouteの後）
<Route
  path="/search"
  element={
    <ProtectedRoute>
      <SearchPage />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 2: フロントエンド全テスト実行**

Run: `docker compose run --rm frontend npm test -- --run`
Expected: ALL PASS

- [ ] **Step 3: バックエンド全テスト実行**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec`
Expected: ALL PASS

- [ ] **Step 4: RuboCop 実行**

Run: `docker compose run --rm backend bundle exec rubocop`
Expected: ALL PASS（警告があれば修正）

- [ ] **Step 5: ESLint + Prettier 実行**

Run: `docker compose run --rm frontend npm run lint`
Expected: ALL PASS（警告があれば修正）

- [ ] **Step 6: 環境変数サンプル更新**

`.env.example`（なければ作成）に以下を追加:

```
TMDB_API_KEY=your_tmdb_api_key
GOOGLE_BOOKS_API_KEY=your_google_books_api_key
IGDB_CLIENT_ID=your_igdb_client_id
IGDB_CLIENT_SECRET=your_igdb_client_secret
REDIS_URL=redis://redis:6379/0
```

- [ ] **Step 7: コミット**

```bash
git add frontend/src/App.tsx .env.example
git commit -m "feat: 検索ページのルーティング追加 + 環境変数テンプレート更新"
```

- [ ] **Step 8: 全テスト最終確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec && docker compose run --rm frontend npm test -- --run`
Expected: ALL PASS
