# 検索品質改善 仕様書

**日付:** 2026-04-12
**スコープ:** 全ジャンル横断の検索品質改善
**関連Issue:** （作成予定）

## 背景

Recollyの作品検索は複数の外部API（Google Books, AniList, TMDB, IGDB）を横断して作品を検索するが、実測データで以下の問題が確認された。

### 実測データ（全ジャンル24タイトル、計339件）

| ジャンル | 件数 | 画像なし率 | 説明文なし率 |
|---|---|---|---|
| アニメ | 33 | 0% | 45% |
| 映画 | 13 | 0% | 46% |
| ドラマ | 15 | 0% | 47% |
| 本 | 121 | **20%** | 46% |
| 漫画 | 114 | 0% | **63%** |
| ゲーム | 43 | 0% | **63%** |
| **全体** | **339** | **7%** | **54%** |

### 確認された3つの問題

1. **前の検索結果が残る可能性** — フロントエンドで新しい検索時に古い結果がクリアされない。API遅延中に別の検索が走ると古いレスポンスが新しい結果を上書きする危険がある。
2. **本の画像が20%欠損** — Google Books APIが画像を持っていないケース。他のジャンルは0%で、本だけの問題。
3. **全ジャンルで説明文が54%欠損** — 既存のWikipedia補完ロジックに欠陥があり、十分に機能していない。

### 既存Wikipedia補完の4つの欠陥（コード調査結果）

1. **本（Google Books）にはそもそもWikipedia補完が無い** — `enrich_anilist_descriptions` はAniList結果のみ対象。
2. **ゲーム（IGDB）のWikipedia補完は一部の結果にしか効かない** — Wikipedia経由で見つけた結果のみ日本語説明が付き、直接IGDBで見つけた結果は英語のままで後から削除される。
3. **アニメ・漫画（AniList）のWikipedia補完がタイトル完全一致を要求** — `WikipediaClient#fetch_extract` はWikipedia APIの `titles=` パラメータで完全一致を求めるため、ローマ字タイトルや副題付きタイトルではマッチしない。
4. **`remove_english_descriptions` が破壊的** — 日本語補完に失敗した英語説明を無条件に nil に書き換え、結果として説明欄が空になる。

## ゴール

実装後に同じ測定を再実行し、以下の改善を達成する。

| 指標 | 現状 | 目標 |
|---|---|---|
| 全体の説明なし率 | 54% | 25%以下 |
| 本の画像なし率 | 20% | 10%以下 |
| 漫画・ゲームの説明なし率 | 63% | 30%以下 |
| 連続検索時の結果混ざり | 発生可能性あり | 発生しない |

## 採用アプローチ

**アプローチC-2: 既存Wikipedia補完ロジックの修正 + openBD併用**

比較した他のアプローチ:
- C-1（補完ロジック修正のみ）— 本の画像欠損問題が残る
- C-3（楽天ブックスAPI も追加）— 実装コストが大きく、C-2の効果を見てから判断すべき

## 設計

### 全体アーキテクチャ

```
[フロントエンド]
SearchPage.tsx
  └─ 新しい検索時に結果を即時クリア + AbortControllerで古いリクエストをキャンセル

[バックエンド]
WorkSearchService
  ├─ 【修正】enrich_anilist_descriptions → enrich_missing_descriptions
  │          全ソースの結果を対象に
  ├─ 【削除】remove_english_descriptions
  │          enrich_missing_descriptions 内で穏当に処理
  ├─ 【新規】enrich_books_via_openbd
  │          本の画像・説明欠損をopenBDで補完
  └─ 【修正】sort_by_popularity → sort_by_quality_and_popularity
             画像・説明がある結果を上位に

WikipediaClient
  └─ 【新規】search_and_fetch_extract
              検索→取得の2段階で日本語説明を取得

新規: OpenbdClient
  └─ ISBNから書誌データ（画像・内容紹介）を取得

GoogleBooksAdapter
  └─ 【修正】normalize で ISBN を metadata に含める
```

### 変更するファイル

**既存ファイル改修:**
- `frontend/src/pages/SearchPage/SearchPage.tsx`
- `frontend/src/lib/worksApi.ts`（`signal` オプション追加）
- `backend/app/services/work_search_service.rb`
- `backend/app/services/external_apis/wikipedia_client.rb`
- `backend/app/services/external_apis/google_books_adapter.rb`

**新規ファイル:**
- `backend/app/services/external_apis/openbd_client.rb`
- `backend/spec/services/external_apis/openbd_client_spec.rb`
- 必要に応じて既存 spec の追加テスト

### フロントエンド修正（問題① 対応）

#### 方針

1. 新しい検索を開始する時、即座に `setResults([])` で古い結果をクリアする
2. `AbortController` で古い検索リクエストをキャンセルする
3. レスポンスを受け取った際、そのリクエストが中断済みなら結果を反映しない

#### `SearchPage.tsx` の変更イメージ

```tsx
const abortRef = useRef<AbortController | null>(null)

const handleSearch = async (e: FormEvent) => {
  e.preventDefault()

  // 古いリクエストがあればキャンセル
  abortRef.current?.abort()
  const controller = new AbortController()
  abortRef.current = controller

  // 画面上の古い結果を即座にクリア
  setResults([])
  setIsSearching(true)
  setError('')

  try {
    const response = await worksApi.search(query, mediaType, {
      signal: controller.signal,
    })
    // レース条件対策: 既にキャンセルされていたら反映しない
    if (controller.signal.aborted) return
    setResults(response.results)
    setHasSearched(true)
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    setError('検索に失敗しました')
  } finally {
    if (!controller.signal.aborted) {
      setIsSearching(false)
    }
  }
}
```

`handleGenreChange` にも同じ仕組みを適用する。

#### `worksApi.search` の変更

```ts
// frontend/src/lib/worksApi.ts
search(query: string, mediaType?: MediaType, options?: { signal?: AbortSignal })
```

内部で `fetch` に `signal` を渡す。

### バックエンド: Wikipedia補完の改善（問題③ 対応）

#### WikipediaClient に新メソッド追加

```ruby
# backend/app/services/external_apis/wikipedia_client.rb

# 検索APIで記事タイトルを探し、見つかった最上位記事の概要を返す
# 完全一致の fetch_extract と違い、表記揺れがあっても取得できる
def search_and_fetch_extract(query)
  return nil if query.blank?

  titles = search(query, limit: 1)
  return nil if titles.empty?

  fetch_extract(titles.first)
end
```

既存の `search` と `fetch_extract` を組み合わせるだけ。

#### WorkSearchService の補完ロジック刷新

```ruby
# backend/app/services/work_search_service.rb

CACHE_VERSION = 'v2' # キャッシュを実装変更で無効化するためのバージョン

def search(query, media_type: nil)
  cache_key = "work_search:#{CACHE_VERSION}:#{media_type || 'all'}:#{query}"

  Rails.cache.fetch(cache_key, expires_in: CACHE_TTL) do
    adapters = select_adapters(media_type)
    results = fetch_from_adapters_in_parallel(adapters, query, media_type)
    results = results.select { |r| r.media_type == media_type } if media_type.present?

    enrich_books_via_openbd(results)
    enrich_missing_descriptions(results)
    sort_by_quality_and_popularity(results)
  end
end

private

# AniListだけでなく、説明が空 or 英語の全結果を対象に補完する
def enrich_missing_descriptions(results)
  needs_enrichment = results.select do |r|
    r.description.blank? || english_text?(r.description)
  end
  return if needs_enrichment.empty?

  needs_enrichment.each_slice(ENRICHMENT_BATCH_SIZE) do |batch|
    threads = batch.map do |result|
      Thread.new { try_enrich_description(result) }
    end
    threads.each(&:join)
  end
end

# 補完の試行順:
# 1. TMDB日本語説明（映画・ドラマに特に有効）
# 2. Wikipedia search_and_fetch_extract（全メディアに有効）
# 3. 元の説明にフォールバック（英語でも nil にせずそのまま残す）
def try_enrich_description(result)
  tmdb = ExternalApis::TmdbAdapter.new
  wikipedia = ExternalApis::WikipediaClient.new

  description = fetch_japanese_description_from_tmdb(result, tmdb)
  description ||= wikipedia.search_and_fetch_extract(result.title)
  result.description = resolve_description(description, result.description)
end

# 日本語が見つかればそれを使用、見つからず元が英語ならそのまま残す
def resolve_description(japanese_desc, original_desc)
  return japanese_desc if japanese_desc.present?
  original_desc
end
```

**破壊的な `remove_english_descriptions` は廃止。** 英語でも「何もない」よりマシという判断。

### バックエンド: 本の画像・説明をopenBDで補完（問題② 対応）

#### OpenbdClient 新設

```ruby
# backend/app/services/external_apis/openbd_client.rb
module ExternalApis
  class OpenbdClient
    BASE_URL = 'https://api.openbd.jp/v1'
    USER_AGENT = 'Recolly/1.0 (https://github.com/IKcoding-jp/Recolly)'

    def fetch(isbn)
      return nil if isbn.blank?

      response = connection.get('/get', { isbn: isbn })
      data = response.body&.first
      return nil if data.nil?

      {
        cover_image_url: extract_cover_url(data),
        description: extract_description(data)
      }
    rescue Faraday::Error => e
      Rails.logger.error("[OpenbdClient] 取得エラー: #{e.message}")
      nil
    end

    private

    def extract_cover_url(data)
      data.dig('summary', 'cover').presence
    end

    def extract_description(data)
      text_contents = data.dig('onix', 'CollateralDetail', 'TextContent') || []
      intro = text_contents.find { |t| t['TextType'] == '03' }
      intro&.dig('Text').presence
    end

    def connection
      @connection ||= Faraday.new(
        url: BASE_URL, request: { open_timeout: 5, timeout: 10 }
      ) do |f|
        f.response :json
        f.headers['User-Agent'] = USER_AGENT
        f.adapter Faraday.default_adapter
      end
    end
  end
end
```

#### GoogleBooksAdapter で ISBN を保持

```ruby
# backend/app/services/external_apis/google_books_adapter.rb

def normalize(item)
  info = item['volumeInfo'] || {}
  SearchResult.new(
    info['title'],
    'book',
    info['description'],
    info.dig('imageLinks', 'thumbnail'),
    nil,
    item['id'],
    'google_books',
    {
      authors: info['authors'],
      publisher: info['publisher'],
      published_date: info['publishedDate'],
      page_count: info['pageCount'],
      categories: info['categories'],
      isbn: extract_isbn(info),
      popularity: normalize_popularity(info['ratingsCount'])
    }.compact
  )
end

private

def extract_isbn(info)
  identifiers = info['industryIdentifiers'] || []
  isbn13 = identifiers.find { |i| i['type'] == 'ISBN_13' }
  isbn10 = identifiers.find { |i| i['type'] == 'ISBN_10' }
  isbn13&.dig('identifier') || isbn10&.dig('identifier')
end
```

#### WorkSearchService に openBD 補完を追加

```ruby
# backend/app/services/work_search_service.rb に追加

def enrich_books_via_openbd(results)
  book_results = results.select do |r|
    r.external_api_source == 'google_books' &&
      (r.cover_image_url.blank? || r.description.blank?) &&
      r.metadata[:isbn].present?
  end
  return if book_results.empty?

  openbd = ExternalApis::OpenbdClient.new
  book_results.each_slice(ENRICHMENT_BATCH_SIZE) do |batch|
    threads = batch.map do |result|
      Thread.new { enrich_single_book(result, openbd) }
    end
    threads.each(&:join)
  end
end

# 欠損している項目だけ補完する（既存データは上書きしない）
def enrich_single_book(result, openbd)
  data = openbd.fetch(result.metadata[:isbn])
  return if data.nil?

  result.cover_image_url ||= data[:cover_image_url]
  result.description ||= data[:description]
end
```

### バックエンド: 品質込みランキング

```ruby
# 品質スコア（0.0〜1.0）: 画像あり=0.5, 説明あり=0.5
def quality_score(result)
  score = 0.0
  score += 0.5 if result.cover_image_url.present?
  score += 0.5 if result.description.present?
  score
end

# 品質スコア降順 → 人気度降順
def sort_by_quality_and_popularity(results)
  results.sort_by do |r|
    [-quality_score(r), -(r.metadata[:popularity] || 0)]
  end
end
```

**フィルタはせず**、全件表示したうえで品質の高いものを上位に並べる。

## テスト戦略

TDDで進める（テスト先 → 実装）。

| レイヤー | テスト | カバー範囲 |
|---|---|---|
| ユニット | `OpenbdClient` spec | ISBN正常系/エラー系/欠損データ |
| ユニット | `WikipediaClient#search_and_fetch_extract` spec | 検索→取得の連携、検索0件の挙動 |
| 統合 | `WorkSearchService` request spec | openBD補完、Wikipedia補完の拡張、品質ソート |
| 統合 | 既存 request spec | 既存機能のregression |
| フロント | `SearchPage.test.tsx` | 新検索時の結果クリア、AbortControllerの挙動 |

外部API呼び出しは**全てWebMockでスタブ**する。

## キャッシュ戦略

`CACHE_VERSION = 'v2'` をキャッシュキーに含めることで、実装変更後に古いキャッシュを無効化する。古いキャッシュは自然に期限切れで消える。

## スコープ外

以下は今回の範囲外。必要になったら別タスクで対応する。

- 楽天ブックスAPI、Amazon PA-API の追加
- 検索結果のページング機能
- 検索履歴機能
- オートコンプリート
- 検索クエリの正規化（「ワンピース」↔「ONE PIECE」など）
- openBDをキーワード検索に使う（openBDはISBNベースのAPIで、検索機能を提供していない）
- 漫画用の新規外部API追加

## リスクと対策

| リスク | 対策 |
|---|---|
| Wikipedia補完の呼び出し数増加で検索が遅くなる | 5件ずつのバッチ並列処理（既存機構） + 12時間キャッシュ |
| openBDがダウンしている | `OpenbdClient#fetch` は例外を捕捉して nil を返す。補完失敗しても既存の結果は表示される |
| ISBNがない本（洋書・古い本）は openBD で補完できない | 現状と変わらない。欠損のままになるが、ランキングで下位に下がる |
| キャッシュ切り替えで一時的に検索が遅くなる | 初回のみ。12時間後には全キャッシュが自然に切り替わる |

## 成功判定

実装完了後、仕様書冒頭と同じ24タイトルを同じ手順で再測定し、「ゴール」の指標がすべて達成されているか確認する。
