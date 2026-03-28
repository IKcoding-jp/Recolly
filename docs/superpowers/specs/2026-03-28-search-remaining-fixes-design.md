# 検索機能の残存問題修正 — 設計スペック

Issue: #61

## 概要

検索機能の3つの残存問題を修正する：
1. Wikipedia検索でゲーム以外の記事が混入する
2. IGDB検索でリメイク版と原作版を区別できない
3. AniList経由の一部作品の説明が英語のまま表示される

## 問題1: Wikipediaゲーム記事フィルタリング強化

### 現状

`WikipediaGameAdapter#excluded_title?` がタイトル文字列のパターンマッチ（NON_GAME_PATTERNS）だけでフィルタリングしている。「金熊賞」「スタジオジブリ」「ゼルダ（人物記事）」等はパターンに引っかからず、ゲームとして表示されてしまう。

### 解決策: Wikipediaカテゴリによるホワイトリスト方式

Wikipedia APIの `prop=categories` で記事のカテゴリ一覧を取得し、ゲーム関連カテゴリを含む記事だけを通す。

#### ゲームカテゴリ判定パターン

```ruby
GAME_CATEGORY_PATTERNS = /コンピュータゲーム|ゲームソフト|ビデオゲーム|ゲーム作品|アーケードゲーム|モバイルゲーム/
```

例: 「ゼルダの伝説 ブレス オブ ザ ワイルド」→ カテゴリに「2017年のコンピュータゲーム」があるので通過。「ゼルダ」（人物記事）→ ゲームカテゴリなしで除外。

#### APIコール効率化

Wikipedia APIは複数タイトルをパイプ区切り（`titles=タイトルA|タイトルB|タイトルC`）で一括取得可能。フィルタ対象全件を1回のAPIコールで処理する。

#### フロー

```
search_titles(query)
  → Wikipedia検索で候補タイトル取得（最大10件）
  → タイトルパターンで明らかな非ゲーム記事を除外（既存ロジック維持）
  → 残ったタイトルのカテゴリを一括取得（1 APIコール）
  → ゲームカテゴリを含むタイトルだけ返す
```

### 変更対象

- `WikipediaGameAdapter` — `fetch_categories` メソッド追加、`search_titles` にカテゴリフィルタ追加

## 問題2: IGDB検索でのリメイク版・原作版区別

### 現状

`IgdbAdapter#igdb_match_from_wikipedia` が括弧内の情報を全て捨てている。

```
"Resident Evil 2 (2019 video game)" → "Resident Evil 2"
```

IGDBに「Resident Evil 2」が複数（1998年版、2019年リメイク版、バンドル版等）あっても区別できない。

### 解決策: 括弧から発売年を抽出してIGDB結果をフィルタ

括弧を除去する前に年（4桁数字）を抽出し、IGDB検索結果の `first_release_date`（UNIXタイムスタンプ）と照合する。

#### フロー

```
igdb_match_from_wikipedia(jp_title, wikipedia, existing_ids)
  → 英語タイトル取得: "Resident Evil 2 (2019 video game)"
  → 括弧から年を抽出: 2019
  → 括弧を除去: "Resident Evil 2"
  → IGDB検索
  → 年がある場合: 年が一致する非重複マッチを優先で返す
  → 年がない場合: 現状と同じ（最初の非重複マッチを返す）
```

#### 年の抽出ロジック

```ruby
# "Resident Evil 2 (2019 video game)" → 2019
year = en_title.match(/\((\d{4})\s/)?.[1]&.to_i
```

#### IGDB結果のフィルタ

```ruby
# first_release_date はUNIXタイムスタンプ（秒）
# Time.at(timestamp).year で年を取得して比較
results = search_by_keyword(sanitized).reject { |r| existing_ids.include?(r.external_api_id) }
if year
  year_match = results.find { |r| release_year(r) == year }
  year_match || results.first  # 年マッチがなければフォールバック
else
  results.first
end
```

### 変更対象

- `IgdbAdapter#igdb_match_from_wikipedia` — 年抽出 + 年フィルタロジック追加

## 問題3: AniList英語説明文の日本語化改善

### 現状

`WorkSearchService#enrich_anilist_descriptions` が以下の問題を持つ：

1. TMDBの検索クエリが1パターンのみ（`title_english || title_romaji || title` で最初の1つだけ）
2. TMDBで見つからなかったらフォールバックなし

「けいおん！」の場合、英語タイトル「K-ON!」でTMDB検索→見つからない→日本語タイトル「けいおん！」での検索は試さない→英語説明のまま表示。

### 解決策: TMDB複数パターン検索 + Wikipedia補完

#### 改善①: TMDB検索を複数パターン試す

```
title_english で検索 → 見つからなければ
title_romaji で検索 → 見つからなければ
title（日本語）で検索
```

`TmdbAdapter#fetch_japanese_description` を複数クエリ対応に変更するか、`WorkSearchService` 側で複数回呼び出す。

#### 改善②: TMDBでもダメならWikipediaから日本語説明を取得

```
TMDBで日本語説明が見つからない
→ 日本語Wikipediaでタイトル検索
→ 記事の冒頭テキスト（extract）を日本語説明として使う
→ それでもダメ → 英語説明のまま（最終フォールバック）
```

#### フロー全体

```
AniList（英語説明）
  → TMDB検索（英語 → ローマ字 → 日本語の順で試す）
    → 見つかった → 日本語説明に差し替え ✓
    → 見つからない
      → Wikipedia検索 → 冒頭テキストを取得
        → 見つかった → 日本語説明に差し替え ✓
        → 見つからない → 英語説明のまま（最終フォールバック）
```

### アーキテクチャ: WikipediaClient共通モジュールの切り出し

現在の `WikipediaGameAdapter` はゲーム専用。アニメ説明文取得でもWikipediaを使うため、共通操作をモジュールとして切り出す。

```
WikipediaClient（共通モジュール）
  - wikipedia_connection（接続管理）
  - search(query)（キーワード検索）
  - fetch_extract(title)（冒頭テキスト取得）
  - fetch_categories(titles)（カテゴリ一括取得） ← 問題1で新規追加
  - fetch_english_title(title)（英語タイトル取得）

WikipediaGameAdapter
  - include WikipediaClient
  - search_titles(query)（ゲーム記事フィルタリング付き検索）
  - ゲームカテゴリ判定ロジック

WorkSearchService
  - WikipediaClient を使ってアニメ説明文をWikipediaから補完
```

### 変更対象

- 新規: `WikipediaClient` モジュール（共通Wikipedia操作を切り出し）
- 変更: `WikipediaGameAdapter` — `WikipediaClient` を include、カテゴリフィルタ追加
- 変更: `WorkSearchService#enrich_anilist_descriptions` — TMDB複数パターン検索 + Wikipedia補完追加
- 変更なし: `TmdbAdapter#fetch_japanese_description` — 既存のまま（単一クエリを受け取って検索する責務は変えない。複数パターンの試行はWorkSearchService側で制御する）

## テスト方針

### 問題1のテスト

- ゲームカテゴリを持つ記事だけが `search_titles` の結果に含まれること
- 「金熊賞」「スタジオジブリ」等のゲーム以外の記事が除外されること
- カテゴリ取得APIがエラーの場合、タイトルパターンフィルタのみにフォールバック
- 複数タイトルのカテゴリ一括取得が正しく動作すること

### 問題2のテスト

- 括弧内に年がある場合、その年のIGDBエントリが優先されること
- 括弧内に年がない場合、現状と同じ動作（最初の非重複マッチ）になること
- 年が一致するエントリがIGDB結果にない場合、フォールバックで最初のマッチを返すこと

### 問題3のテスト

- TMDBの英語タイトルで見つからなくても、ローマ字・日本語タイトルで見つかること
- TMDBで全パターン失敗時、Wikipediaから日本語説明を取得できること
- Wikipedia でも見つからない場合、英語説明がそのまま残ること
- WikipediaClient モジュールの各メソッドが正しく動作すること

## スコープ外

- フロントエンドの変更（英語検索ヒント表示等）
- 新しい外部APIの追加
- キャッシュ戦略の変更
