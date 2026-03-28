# 検索機能テスト結果の追加修正 — 設計スペック

Issue: #61（追加修正）

## 概要

Playwright自動テスト（30件）で発見された4つの追加問題を修正する。

## 問題A: ジャンルフィルタが効かない

### 現状

「アニメ」フィルタを選んでもAniListが漫画・映画を返し、そのまま表示される。「映画」フィルタでもドラマが混入する。

### 解決策

`WorkSearchService#search` で、`media_type` が指定されている場合、アダプターの結果を**そのmedia_typeと一致するものだけにフィルタリング**する。

```ruby
results = adapters.flat_map { |adapter| adapter.safe_search(query) }
results = results.select { |r| r.media_type == media_type } if media_type.present?
```

### 変更対象

- `WorkSearchService#search` — media_typeフィルタ追加

## 問題B: 本の検索精度が低い

### 現状

Google Books APIが関連度の低い結果を大量に返す。「三体」で無関係な本ばかり、「ハリーポッター」で主要作品が出ない。

### 解決策

Google Booksの結果に対して、**検索キーワードがタイトルに含まれている結果だけ残す**フィルタを追加する。大文字小文字を区別しない部分一致で判定する。

Google Booksのみに適用し、他のAPI（TMDB, AniList, IGDB）には適用しない。

### 変更対象

- `GoogleBooksAdapter#search` — タイトルフィルタ追加（またはWorkSearchService側で適用）

## 問題C: TMDB説明文の誤マッチ

### 現状

`TmdbAdapter#fetch_japanese_description` が、同名の別作品（例: 「Attack on Titan」のSF映画）を誤ってマッチさせ、間違った説明文を返す。

### 解決策

TMDB検索結果から movie/tv を抽出した後、**`original_language: "ja"` の結果を優先**する。日本語原語の結果がなければ最初のmovie/tvにフォールバック。

```ruby
candidates = results.select { |item| %w[movie tv].include?(item['media_type']) }
match = candidates.find { |item| item['original_language'] == 'ja' } || candidates.first
```

### 変更対象

- `TmdbAdapter#fetch_japanese_description` — original_language優先ロジック追加

## 問題D: 英語説明文の非表示

### 現状

TMDB → Wikipedia で日本語説明が見つからない場合、AniListの英語説明がそのまま表示される。

### 解決策

`enrich_anilist_descriptions` の最後に、**説明文が英語のままの結果は説明文をnilにする**処理を追加。

英語判定: 文字列の半分以上がASCII文字なら英語と判定する。

```ruby
def english_text?(text)
  return false if text.blank?

  ascii_ratio = text.count("\x20-\x7E").to_f / text.length
  ascii_ratio > 0.5
end
```

### 変更対象

- `WorkSearchService#enrich_anilist_descriptions` — 英語説明除去処理を追加

## テスト方針

### 問題Aのテスト

- `media_type: 'anime'` で検索した結果に漫画・映画が含まれないこと
- `media_type` 未指定の場合は全ジャンルの結果が返ること

### 問題Bのテスト

- Google Booksの結果がタイトルにクエリを含むもののみにフィルタされること
- クエリがタイトルに含まれない結果が除外されること

### 問題Cのテスト

- 同名の日本語作品と外国作品がある場合、日本語原語の説明文が返ること
- 日本語原語の結果がない場合は最初のマッチにフォールバックすること

### 問題Dのテスト

- 日本語説明が見つからなかった結果の説明文がnilになること
- 日本語説明が見つかった結果は変更されないこと

## スコープ外

- AniList APIのGraphQLクエリにtype指定を追加する（API側フィルタ）
- Google Books API以外の書籍APIへの切り替え
- ゲーム（IGDB）の英語説明文の日本語化（これはIGDB自体が英語データのため）
