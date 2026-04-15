# Google Books Mixed Content 修正 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本番環境で本のカバー画像が `Mixed Content` ブロックにより表示されない問題を、Google Books Adapter での URL 正規化 / DB バックフィル / 検索キャッシュ version bump の 3 点セットで解消する。

**Architecture:** 発生源である `GoogleBooksAdapter#normalize` 内で、Google Books API が返す `http://books.google.com/...` 形式の thumbnail URL を `https://` に置換する（根本修正）。加えて本番 DB に既に保存済みの履歴データを Rails データマイグレーションで一括更新し、`WorkSearchService::CACHE_VERSION` を bump して古いキャッシュを破棄する。

**Tech Stack:** Ruby 3.3 / Rails 8.1 / RSpec / WebMock / PostgreSQL 16

**Related:**
- 仕様書: `docs/superpowers/specs/2026-04-15-google-books-mixed-content-fix-design.md`
- Issue: #155
- ブランチ: `fix/google-books-mixed-content-issue-155`

---

## File Structure

| ファイル | 役割 | 種別 |
|---|---|---|
| `backend/app/services/external_apis/google_books_adapter.rb` | `normalize` 内で thumbnail URL を https:// に変換 | Modify |
| `backend/spec/services/external_apis/google_books_adapter_spec.rb` | URL 正規化の3ケーステストを追加 | Modify |
| `backend/app/services/work_search_service.rb` | `CACHE_VERSION` を `v4` → `v5` に bump | Modify (1行) |
| `backend/db/migrate/<timestamp>_normalize_google_books_cover_urls.rb` | 既存 DB レコードの http:// を https:// に一括更新 | Create |
| `backend/db/schema.rb` | `rails db:migrate` により自動更新 | Auto |

---

## Task 1: GoogleBooksAdapter で URL を正規化する（TDD）

**Files:**
- Test: `backend/spec/services/external_apis/google_books_adapter_spec.rb`
- Modify: `backend/app/services/external_apis/google_books_adapter.rb:33`

### Step 1-1: 失敗するテストを先に追加する

`backend/spec/services/external_apis/google_books_adapter_spec.rb` の `describe '#search' do` ブロック内（ISBN抽出の `describe` と同じ階層）に、新しい `describe 'カバー画像URLの正規化' do` ブロックを追加する。

- [ ] **Step 1-1: テスト3ケースを追記する**

ファイル末尾の `end # describe '#search'` の直前（`describe 'ISBN抽出' do ... end` の直後）に以下を追加：

```ruby
    describe 'カバー画像URLの正規化' do
      # Google Books API は thumbnail URL を http:// で返すことが多く、
      # HTTPS ページで Mixed Content としてブロックされるため https:// に正規化する
      def build_book_item(thumbnail:)
        {
          'id' => 'abc123',
          'volumeInfo' => {
            'title' => 'テスト本',
            'imageLinks' => { 'thumbnail' => thumbnail }
          }
        }
      end

      it 'http:// で始まる thumbnail URL を https:// に正規化する' do
        stub_books_response([build_book_item(
                               thumbnail: 'http://books.google.com/books/content?id=abc123&img=1'
                             )])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url).to eq('https://books.google.com/books/content?id=abc123&img=1')
      end

      it '既に https:// の thumbnail URL はそのまま保持する（冪等性）' do
        stub_books_response([build_book_item(
                               thumbnail: 'https://books.google.com/books/content?id=abc123'
                             )])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url).to eq('https://books.google.com/books/content?id=abc123')
      end

      it 'thumbnail が nil の場合は nil のままエラーにしない' do
        stub_books_response([{
                              'id' => 'abc123',
                              'volumeInfo' => { 'title' => 'テスト本' }
                            }])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url).to be_nil
      end
    end
```

- [ ] **Step 1-2: テストを走らせて失敗を確認する**

```bash
docker compose exec backend bundle exec rspec spec/services/external_apis/google_books_adapter_spec.rb -e "カバー画像URLの正規化"
```

期待される結果:
- `http:// を https:// に正規化する` が **FAIL**（`http://books.google.com/...` のまま返るため `eq('https://...')` にマッチしない）
- `既に https://` は **PASS**（現状実装でも https はそのまま通るため）
- `thumbnail が nil` は **PASS**（現状実装でも `info.dig('imageLinks', 'thumbnail')` は nil を返すため）

→ 1件失敗、2件成功の状態がスタート地点。

- [ ] **Step 1-3: 実装で修正する**

`backend/app/services/external_apis/google_books_adapter.rb` の 33 行目を書き換える。

Before（33行目）:
```ruby
        info.dig('imageLinks', 'thumbnail'),
```

After:
```ruby
        normalize_cover_image_url(info.dig('imageLinks', 'thumbnail')),
```

さらに、`extract_isbn` メソッドの **直前**（`private` 直下の `def normalize(item)` とは別の箇所、`extract_isbn` の前）に以下のメソッドを追加する：

```ruby
    # Google Books は thumbnail URL を http:// で返すことが多いが、
    # 本番は HTTPS 配信のため Mixed Content でブロックされる。
    # プロトコルのみ https:// に置換する（Google Books は同一パスを HTTPS でも配信している）
    def normalize_cover_image_url(url)
      url&.sub(%r{\Ahttp://}, 'https://')
    end
```

- [ ] **Step 1-4: テストを走らせて全パスを確認する**

```bash
docker compose exec backend bundle exec rspec spec/services/external_apis/google_books_adapter_spec.rb
```

期待される結果: **全テストパス**（追加した3件を含むファイル内全件）

- [ ] **Step 1-5: RuboCop チェック**

```bash
docker compose exec backend bundle exec rubocop app/services/external_apis/google_books_adapter.rb spec/services/external_apis/google_books_adapter_spec.rb
```

期待される結果: `no offenses detected`

- [ ] **Step 1-6: コミット**

```bash
git add backend/app/services/external_apis/google_books_adapter.rb backend/spec/services/external_apis/google_books_adapter_spec.rb
git commit -m "$(cat <<'EOF'
fix(backend): Google Books の thumbnail URL を https に正規化

Google Books API が返す http:// の thumbnail URL は本番の HTTPS ページで
Mixed Content としてブロックされるため、Adapter 層で https:// に置換する。
冪等性（既に https:// の URL はそのまま）と nil 安全性のテストを追加。

Refs #155
EOF
)"
```

---

## Task 2: WorkSearchService のキャッシュバージョンを bump する

**Files:**
- Modify: `backend/app/services/work_search_service.rb:10`

### なぜ bump が必要か

`WorkSearchService` は検索結果を 12 時間キャッシュしている。Task 1 で Adapter を修正しても、バージョンを変えずに古いキャッシュが残ったままだと、検索結果 API が最大 12 時間、古い http:// URL を返し続けてしまう。バージョン文字列を変えることで旧キャッシュキーを実質的に破棄する。

- [ ] **Step 2-1: `CACHE_VERSION` 定数を v4 → v5 に変更する**

`backend/app/services/work_search_service.rb` の 8〜10 行目:

Before:
```ruby
  CACHE_TTL = 12.hours
  # 実装変更時にインクリメントしてキャッシュを無効化する
  # v4: シリーズ親説明流用の境界文字判定を追加（normalize 空白保持 + ratio 廃止）
  CACHE_VERSION = 'v4'
```

After:
```ruby
  CACHE_TTL = 12.hours
  # 実装変更時にインクリメントしてキャッシュを無効化する
  # v4: シリーズ親説明流用の境界文字判定を追加（normalize 空白保持 + ratio 廃止）
  # v5: Google Books thumbnail URL を https:// に正規化（Mixed Content 対策 #155）
  CACHE_VERSION = 'v5'
```

- [ ] **Step 2-2: 既存の WorkSearchService テストが壊れていないことを確認する**

```bash
docker compose exec backend bundle exec rspec spec/services/work_search_service_spec.rb
```

期待される結果: **全テストパス**（CACHE_VERSION の変更はキャッシュキーの prefix を変えるだけで、ロジックには影響しない）

- [ ] **Step 2-3: RuboCop チェック**

```bash
docker compose exec backend bundle exec rubocop app/services/work_search_service.rb
```

期待される結果: `no offenses detected`

- [ ] **Step 2-4: コミット**

```bash
git add backend/app/services/work_search_service.rb
git commit -m "$(cat <<'EOF'
fix(backend): 検索結果キャッシュを v5 に bump

Google Books URL 正規化（#155）を反映するため、12時間有効な検索結果
キャッシュを無効化する。未バンプだと修正後も最大 12 時間、古い http://
URL が返り続けてしまう。

Refs #155
EOF
)"
```

---

## Task 3: 既存 DB レコードをバックフィルするマイグレーションを作成する

**Files:**
- Create: `backend/db/migrate/<timestamp>_normalize_google_books_cover_urls.rb`
- Auto: `backend/db/schema.rb`（`rails db:migrate` により更新）

### なぜ必要か

Task 1 は「これから登録される本」の URL のみ修正する。既に DB に保存されている **履歴レコード**（`http://books.google.com/...` 形式）は引き続き壊れたままのため、別途 UPDATE する必要がある。

- [ ] **Step 3-1: マイグレーションファイルを生成する**

```bash
docker compose exec backend bundle exec rails generate migration NormalizeGoogleBooksCoverUrls
```

期待される結果: `backend/db/migrate/<timestamp>_normalize_google_books_cover_urls.rb` が作成される

- [ ] **Step 3-2: マイグレーションの中身を書く**

生成されたファイルを以下の内容に書き換える（`class NormalizeGoogleBooksCoverUrls` のクラス名は自動生成のものをそのまま使う）：

```ruby
# frozen_string_literal: true

# 本番で保存済みの Google Books thumbnail URL を http:// → https:// に一括更新する。
# Google Books API が返す thumbnail URL は http:// 形式が多く、
# HTTPS ページで Mixed Content としてブロックされる問題への対処（#155）。
# 新規登録分は GoogleBooksAdapter 側で正規化されるが、履歴データは本マイグレーションで修正する。
class NormalizeGoogleBooksCoverUrls < ActiveRecord::Migration[8.1]
  def up
    # WHERE 句で books.google.com 固定に絞り、無関係ドメインを誤って書き換えないようにする
    execute <<~SQL.squish
      UPDATE works
      SET cover_image_url = REPLACE(
        cover_image_url,
        'http://books.google.com/',
        'https://books.google.com/'
      )
      WHERE cover_image_url LIKE 'http://books.google.com/%'
    SQL
  end

  def down
    execute <<~SQL.squish
      UPDATE works
      SET cover_image_url = REPLACE(
        cover_image_url,
        'https://books.google.com/',
        'http://books.google.com/'
      )
      WHERE cover_image_url LIKE 'https://books.google.com/%'
    SQL
  end
end
```

- [ ] **Step 3-3: 開発DB にテストデータを仕込む**

```bash
docker compose exec backend bundle exec rails runner '
Work.create!(
  title: "Mixed Contentテスト本",
  media_type: :book,
  cover_image_url: "http://books.google.com/books/content?id=TEST001&img=1",
  external_api_id: "TEST001",
  external_api_source: "google_books"
)
'
```

期待される結果: レコードが1件作成される（エラーが出ないこと）

- [ ] **Step 3-4: マイグレーションを実行する**

```bash
docker compose exec backend bundle exec rails db:migrate
```

期待される結果: マイグレーションが実行され、`== NormalizeGoogleBooksCoverUrls: migrated` のメッセージが出る

- [ ] **Step 3-5: テストレコードが https:// に更新されたことを確認する**

```bash
docker compose exec backend bundle exec rails runner '
w = Work.find_by(external_api_id: "TEST001")
puts "URL: #{w.cover_image_url}"
raise "期待: https:// 始まり、実際: #{w.cover_image_url}" unless w.cover_image_url.start_with?("https://books.google.com/")
puts "OK: https:// に正規化された"
'
```

期待される結果: `OK: https:// に正規化された`

- [ ] **Step 3-6: ロールバックを試して down が正しく動くことを確認する**

```bash
docker compose exec backend bundle exec rails db:rollback STEP=1
```

```bash
docker compose exec backend bundle exec rails runner '
w = Work.find_by(external_api_id: "TEST001")
puts "URL: #{w.cover_image_url}"
raise "期待: http:// 始まり、実際: #{w.cover_image_url}" unless w.cover_image_url.start_with?("http://books.google.com/")
puts "OK: http:// に巻き戻った"
'
```

期待される結果: `OK: http:// に巻き戻った`

- [ ] **Step 3-7: 再度マイグレーションを適用して最終状態にする**

```bash
docker compose exec backend bundle exec rails db:migrate
```

これで開発DB は最新状態（https:// 正規化済み）に戻る。

- [ ] **Step 3-8: テストデータを削除する**

```bash
docker compose exec backend bundle exec rails runner '
Work.where(external_api_id: "TEST001").destroy_all
puts "テストデータ削除完了"
'
```

期待される結果: `テストデータ削除完了`

- [ ] **Step 3-9: `db/schema.rb` の更新を確認する**

```bash
git diff backend/db/schema.rb
```

期待される差分: `ActiveRecord::Schema[8.1].define(version: <new_timestamp>)` のバージョン番号が更新されていること。テーブル構造の変更はなし（データ変更のみなので）。

- [ ] **Step 3-10: バックエンドの全テスト・リンターを一度通す**

```bash
docker compose exec backend bundle exec rspec && docker compose exec backend bundle exec rubocop
```

期待される結果: **全テストパス + lint クリア**

- [ ] **Step 3-11: コミット**

```bash
git add backend/db/migrate/ backend/db/schema.rb
git commit -m "$(cat <<'EOF'
fix(backend): 既存の Google Books カバー画像 URL を https に backfill

works テーブル内の http://books.google.com/ 始まりの cover_image_url を
一括で https://books.google.com/ に更新するデータマイグレーションを追加。
WHERE 句でドメインを厳密に絞り、他の URL を誤って書き換えない。
up/down 両対応で可逆。

Refs #155
EOF
)"
```

---

## Self-Review（プラン完成後の再チェック）

### 1. Spec カバレッジ

| Spec の要件 | カバーするタスク |
|---|---|
| §3.1 Adapter 層で URL 正規化 | Task 1 |
| §3.2 データバックフィル（up/down） | Task 3 |
| §3.3 `CACHE_VERSION` bump | Task 2 |
| §4.1 正規化テスト（3ケース） | Task 1 Step 1-1 |
| §4.3 dev DB 往復確認 | Task 3 Step 3-3〜3-7 |
| §5 リスク2（WHERE句で厳密絞り込み） | Task 3 Step 3-2 |
| §6 ロールバック計画 | Task 3 Step 3-6 で実地確認 |

→ 全要件がタスクに対応している。

### 2. Placeholder / 曖昧表現スキャン

- 「TBD」「TODO」「後で」等の placeholder はなし
- 各 step にコード本体 / コマンド本体 / 期待出力が書かれている
- 代名詞や「上記」参照は避け、各 step が単独で読めるようにした

### 3. 型・命名の一貫性

- ヘルパーメソッド名: `normalize_cover_image_url`（Task 1 の実装とテスト計画で一致）
- マイグレーション名: `NormalizeGoogleBooksCoverUrls`（ファイル名・クラス名・コミットメッセージで一致）
- 定数名: `CACHE_VERSION`（既存のまま。値のみ変更）

### 4. 実行順序の妥当性

Task 1 → Task 2 → Task 3 の順で進める。理由:
- Task 1 が本件の「根本修正」。先にこれをやって各レベルでの動作を確認する
- Task 2 はコード 1 行変更で副作用ゼロ。1 の直後にまとめて片付ける
- Task 3 は dev DB を触るので最後。失敗してもロールバックで復旧可能

各タスクは独立した commit になるので、不具合が出た場合は `git revert` で部分的に戻せる。

---

## 完了条件（全タスク終了時点）

- [ ] 全 RSpec テスト PASS
- [ ] RuboCop `no offenses`
- [ ] dev DB で マイグレーション up/down 往復確認済み
- [ ] ブランチ `fix/google-books-mixed-content-issue-155` に 3 コミット積み上がっている
  - `fix(backend): Google Books の thumbnail URL を https に正規化`
  - `fix(backend): 検索結果キャッシュを v5 に bump`
  - `fix(backend): 既存の Google Books カバー画像 URL を https に backfill`
