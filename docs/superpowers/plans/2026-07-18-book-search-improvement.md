# 本検索改善（高解像度化・漫画除外・ラノベ帰属整理）実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本の検索結果からGoogle Books由来の漫画単巻を除外し、ジャケットを400px幅に高解像度化し、ジャンル表記を「漫画・ラノベ」に変更する。

**Architecture:** バックエンドは `GoogleBooksAdapter` の検索絞り込みとURL正規化のみを変更（追加API呼び出しなし）。フロントエンドはUIラベル定義の文字列変更のみ（内部値 `manga` は不変、DB・API仕様に影響なし）。検索キャッシュはバージョン更新で無効化。

**Tech Stack:** Ruby on Rails 8 / RSpec + WebMock、React 19 + TypeScript / Vitest

**スペック:** `docs/superpowers/specs/2026-07-18-book-search-improvement-design.md`
**Issue:** #220
**ブランチ:** `feat/book-search-improvement`（作成済み）

## Global Constraints

- 除外対象カテゴリの文字列は `Comics & Graphic Novels`（完全一致・categoriesが配列で含む場合）
- 高解像度化パラメータは `fife=w400`（w800は帯域過剰のため不可）
- ジャンル表記は「漫画・ラノベ」（中黒区切り）。ランディングページ（`HeroSection.tsx` / `SolutionSection.tsx`）は「漫画」のまま変更しない
- `media_type` の内部値 `'manga'` は一切変更しない
- マジックナンバー禁止（カテゴリ名・fifeパラメータは定数化）
- コメントは「なぜ」を日本語で書く
- テスト実行: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec <path>` / `docker compose run --rm frontend npm test -- run <path>`
- リンター: `docker compose run --rm backend bundle exec rubocop` / `docker compose run --rm frontend npm run lint`

---

### Task 1: GoogleBooksAdapter — 漫画（Comics & Graphic Novels）の除外

**Files:**
- Modify: `backend/app/services/external_apis/google_books_adapter.rb`
- Test: `backend/spec/services/external_apis/google_books_adapter_spec.rb`

**Interfaces:**
- Consumes: 既存の `#search(query, media_type:)` と `japanese_or_unspecified?` フィルタ
- Produces: `search` の戻り値から `categories` に `Comics & Graphic Novels` を含むitemが消える。プライベートメソッド `comic?(item)` を追加

- [ ] **Step 1: 失敗するテストを書く**

`google_books_adapter_spec.rb` の `describe '#search'` 内（「言語フィルタ」describeの後）に追加:

```ruby
    describe '漫画の除外' do
      # 漫画はAniList由来の「漫画・ラノベ」ジャンルでシリーズ単位に管理するため、
      # Google Booksの単巻レコード（Comics & Graphic Novels）は本の検索から除外する
      def build_item(id:, title:, categories: nil)
        volume_info = { 'title' => title }
        volume_info['categories'] = categories if categories
        { 'id' => id, 'volumeInfo' => volume_info }
      end

      it 'categories に Comics & Graphic Novels を含む結果は除外する' do
        stub_books_response([
                              build_item(id: 'm1', title: '恋するワンピース 1',
                                         categories: ['Comics & Graphic Novels']),
                              build_item(id: 'b1', title: 'ワンピースの縫い方')
                            ])
        titles = adapter.search('ワンピース').map(&:title)
        expect(titles).not_to include('恋するワンピース 1')
        expect(titles).to include('ワンピースの縫い方')
      end

      it 'categories が漫画以外の結果は返す' do
        stub_books_response([build_item(id: 'n1', title: 'ソードアート・オンライン1',
                                        categories: ['Young Adult Fiction'])])
        expect(adapter.search('ソードアート・オンライン').map(&:title))
          .to include('ソードアート・オンライン1')
      end

      it 'categories が無い結果は除外しない' do
        stub_books_response([build_item(id: 'b2', title: '分類なしの本')])
        expect(adapter.search('分類なしの本').map(&:title)).to include('分類なしの本')
      end
    end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/external_apis/google_books_adapter_spec.rb -e "漫画の除外"`
Expected: FAIL（`恋するワンピース 1` が結果に含まれてしまう）

- [ ] **Step 3: 最小実装**

`google_books_adapter.rb` を変更。定数追加と `search` の絞り込み、`comic?` の追加:

```ruby
    BASE_URL = 'https://www.googleapis.com'
    # Google Booksが漫画に付与する分類タグ。漫画はAniList由来の
    # 「漫画・ラノベ」ジャンルでシリーズ単位に管理するため本の検索から除外する
    COMIC_CATEGORY = 'Comics & Graphic Novels'
```

`search` メソッド内:

```ruby
      items = response.body['items'] || []
      items.select { |item| japanese_or_unspecified?(item) }
           .reject { |item| comic?(item) }
           .map { |item| normalize(item) }
```

`japanese_or_unspecified?` の直後にプライベートメソッド追加:

```ruby
    # categories に漫画分類が含まれるか。categories欠損の漫画は一部すり抜けるが、
    # 普通の本を誤って除外しないこと（誤爆ゼロ）を優先する設計
    def comic?(item)
      categories = item.dig('volumeInfo', 'categories') || []
      categories.include?(COMIC_CATEGORY)
    end
```

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/external_apis/google_books_adapter_spec.rb`
Expected: 全PASS（既存テスト含む）

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/external_apis/google_books_adapter.rb backend/spec/services/external_apis/google_books_adapter_spec.rb
git commit -m "feat: 本の検索結果からGoogle Books由来の漫画を除外"
```

---

### Task 2: GoogleBooksAdapter — ジャケットURLの高解像度化（fife=w400）

**Files:**
- Modify: `backend/app/services/external_apis/google_books_adapter.rb`（`normalize_cover_image_url`）
- Test: `backend/spec/services/external_apis/google_books_adapter_spec.rb`（既存「カバー画像URLの正規化」describe）

**Interfaces:**
- Consumes: Task 1 適用済みの `google_books_adapter.rb`
- Produces: `normalize_cover_image_url(url)` が `edge=curl` を除去し末尾に `fife=w400` を付与したURLを返す（nil入力はnilのまま）

- [ ] **Step 1: 失敗するテストを書く（既存テストの期待値更新＋新規2件）**

既存describe「カバー画像URLの正規化」の期待値を更新し、新規テストを追加。describe全体を以下に置き換える:

```ruby
    describe 'カバー画像URLの正規化' do
      # Google Books API は thumbnail URL を http:// で返すことが多く、
      # HTTPS ページで Mixed Content としてブロックされるため https:// に正規化する。
      # また素のthumbnailは128px幅しかないため fife=w400 で400px幅を要求する
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
        expect(book.cover_image_url)
          .to eq('https://books.google.com/books/content?id=abc123&img=1&fife=w400')
      end

      it '既に https:// の thumbnail URL はプロトコルを変えない' do
        stub_books_response([build_book_item(
          thumbnail: 'https://books.google.com/books/content?id=abc123'
        )])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url)
          .to eq('https://books.google.com/books/content?id=abc123&fife=w400')
      end

      it '低解像度画像用の edge=curl パラメータを除去する' do
        stub_books_response([build_book_item(
          thumbnail: 'http://books.google.com/books/content?id=abc123&zoom=1&edge=curl&source=gbs_api'
        )])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url)
          .to eq('https://books.google.com/books/content?id=abc123&zoom=1&source=gbs_api&fife=w400')
      end

      it 'fife=w400 を付与して高解像度画像を要求する' do
        stub_books_response([build_book_item(
          thumbnail: 'http://books.google.com/books/content?id=abc123&zoom=1'
        )])
        book = adapter.search('テスト本').first
        expect(book.cover_image_url).to include('fife=w400')
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

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/external_apis/google_books_adapter_spec.rb -e "カバー画像URLの正規化"`
Expected: FAIL（fife=w400 が付与されていない）

- [ ] **Step 3: 最小実装**

`google_books_adapter.rb` に定数を追加し、`normalize_cover_image_url` を置き換える:

```ruby
    # 検索グリッドのカード幅200px前後 × 高精細ディスプレイ(2倍)を想定した画像幅。
    # 素のthumbnailは128px幅で粗く、w800は1枚300KB超と過剰なためw400とする
    COVER_IMAGE_SIZE_PARAM = 'fife=w400'
```

```ruby
    # Google Books は thumbnail URL を http:// で返すことが多いが、
    # 本番は HTTPS 配信のため Mixed Content でブロックされる。https:// に置換した上で、
    # 低解像度画像にしか付かない edge=curl（ページめくれ装飾）を除去し、
    # fife パラメータで高解像度画像を要求する（Google Booksの画像サーバーが対応）
    def normalize_cover_image_url(url)
      return nil if url.nil?

      cleaned = url.sub(%r{\Ahttp://}, 'https://').gsub(/&edge=curl|edge=curl&/, '')
      separator = cleaned.include?('?') ? '&' : '?'
      "#{cleaned}#{separator}#{COVER_IMAGE_SIZE_PARAM}"
    end
```

- [ ] **Step 4: テストが通ることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/external_apis/google_books_adapter_spec.rb`
Expected: 全PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/external_apis/google_books_adapter.rb backend/spec/services/external_apis/google_books_adapter_spec.rb
git commit -m "feat: 本のジャケットをfife=w400で高解像度化"
```

---

### Task 3: 検索キャッシュバージョンを v11 に更新

**Files:**
- Modify: `backend/app/services/work_search_service.rb:8-9`
- Test: `backend/spec/services/work_search_service_spec.rb:338-339`

**Interfaces:**
- Consumes: なし（定数変更のみ）
- Produces: `WorkSearchService::CACHE_VERSION == 'v11'`（旧キャッシュの自然無効化）

- [ ] **Step 1: テストの期待値を先に更新して失敗を確認**

`work_search_service_spec.rb:338-339` を以下に変更:

```ruby
    it 'キャッシュバージョンがv11である（本検索の漫画除外・高解像度化で旧キャッシュを無効化）' do
      expect(WorkSearchService::CACHE_VERSION).to eq('v11')
```

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/work_search_service_spec.rb -e "キャッシュバージョン"`
Expected: FAIL（実体はv10のまま）

- [ ] **Step 2: 実装**

`work_search_service.rb:8-9` を以下に変更:

```ruby
  # v11: 本検索の漫画除外とジャケット高解像度化（v10以前の履歴はgit参照）
  CACHE_VERSION = 'v11'
```

- [ ] **Step 3: テストが通ることを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/work_search_service_spec.rb`
Expected: 全PASS

- [ ] **Step 4: バックエンド全体のリンターとテスト**

Run: `docker compose run --rm backend bundle exec rubocop`
Expected: no offenses
Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec`
Expected: 全PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/work_search_service.rb backend/spec/services/work_search_service_spec.rb
git commit -m "chore: 検索キャッシュバージョンをv11に更新"
```

---

### Task 4: フロントエンド — ジャンル表記を「漫画・ラノベ」に変更

**Files:**
- Modify: `frontend/src/lib/mediaTypeUtils.ts:36,148`
- Modify: `frontend/src/pages/SearchPage/genreFilters.ts:12`
- Modify: `frontend/src/pages/RecommendationsPage/MediaTabBar.tsx:10`
- Modify: `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx:30`
- Modify: `frontend/src/components/WorkCard/WorkCard.tsx:16`
- Modify: `frontend/src/components/StatsSummary/statsLabels.ts:7`
- Modify: `frontend/src/components/MediaTypeFilter/mediaTypeOptions.ts:10`
- Modify: `frontend/src/components/ManualWorkForm/ManualWorkForm.tsx:26`
- Modify: `frontend/src/components/DashboardEmptyState/DashboardEmptyState.tsx:13`
- Test: `frontend/src/lib/mediaTypeUtils.test.ts:69-70`
- Test: `frontend/src/components/StatsSummary/StatsSummary.test.tsx:45`
- Test: `frontend/src/components/DashboardEmptyState/DashboardEmptyState.test.tsx:26`
- Test: `frontend/src/components/MediaTypeFilter/MediaTypeFilter.test.tsx:13`

**Interfaces:**
- Consumes: なし（文字列ラベルのみ。内部値 `'manga'` は不変）
- Produces: アプリ内の全ジャンルラベルが「漫画・ラノベ」表記になる

**注意:** ランディングページ（`HeroSection.tsx` / `SolutionSection.tsx`）の「漫画」は変更しない。`MediaTabBar.test.tsx:34` は正規表現 `/漫画/` のため「漫画・ラノベ」にもマッチし変更不要。

- [ ] **Step 1: テストの期待値を先に更新して失敗を確認**

`mediaTypeUtils.test.ts:69-70`:

```typescript
  it('漫画は「漫画・ラノベ」を返す', () => {
    expect(getGenreLabel('manga')).toBe('漫画・ラノベ')
```

`StatsSummary.test.tsx:45`:

```typescript
    expect(screen.getByText('漫画・ラノベ')).toBeInTheDocument()
```

`DashboardEmptyState.test.tsx:26`:

```typescript
    expect(screen.getByText('漫画・ラノベ')).toBeInTheDocument()
```

`MediaTypeFilter.test.tsx:13`:

```typescript
    expect(screen.getByRole('button', { name: '漫画・ラノベ' })).toBeInTheDocument()
```

Run: `docker compose run --rm frontend npm test -- run src/lib/mediaTypeUtils.test.ts src/components/StatsSummary src/components/DashboardEmptyState src/components/MediaTypeFilter`
Expected: 上記4ファイルでFAIL

- [ ] **Step 2: ラベル実装（9ファイルの文字列変更）**

各ファイルの `'漫画'` を `'漫画・ラノベ'` に変更する。対象行:

```typescript
// mediaTypeUtils.ts:36（GENRE_LABELS）と :148（MEDIA_TYPE_LABELS）
  manga: '漫画・ラノベ',

// genreFilters.ts:12
  { value: 'manga', label: '漫画・ラノベ' },

// MediaTabBar.tsx:10
  { id: 'manga', label: '漫画・ラノベ' },

// WorkDetailPage.tsx:30
  manga: '漫画・ラノベ',

// WorkCard.tsx:16
  manga: '漫画・ラノベ',

// statsLabels.ts:7
  manga: '漫画・ラノベ',

// mediaTypeOptions.ts:10
  { value: 'manga', label: '漫画・ラノベ' },

// ManualWorkForm.tsx:26
  { value: 'manga', label: '漫画・ラノベ' },

// DashboardEmptyState.tsx:13
  { label: '漫画・ラノベ', className: styles.pillManga },
```

- [ ] **Step 3: フロントエンド全テストとリンターが通ることを確認**

Run: `docker compose run --rm frontend npm test -- run`
Expected: 全PASS（他のテストが `'漫画'` 表記に依存していれば合わせて修正）
Run: `docker compose run --rm frontend npm run lint`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add frontend/src
git commit -m "feat: ジャンル表記を「漫画・ラノベ」に変更"
```

---

### Task 5: 動作確認とブランチ完了

- [ ] **Step 1: 動作確認（ワークフローStep 5）**

AskUserQuestionで確認方法（手動 / Playwright MCP）をユーザーに確認してから実施する。確認観点:

1. 本の検索（例: 「ワンピース」）で漫画単巻が表示されないこと
2. 本のジャケットが高解像度で表示されること（拡大しても粗くないこと）
3. 検索フィルタ・ジャンルタブ等が「漫画・ラノベ」表記になっていること
4. 漫画・ラノベ検索（例: 「転生したらスライムだった件」）でラノベがシリーズ単位で出ること（現状動作の確認）

- [ ] **Step 2: ブランチ完了処理**

`superpowers:finishing-a-development-branch` スキルを発動し、`.claude/rules/pr-self-check.md` のセルフチェック後にPR作成（`.claude/rules/git-rules.md` 準拠）。
