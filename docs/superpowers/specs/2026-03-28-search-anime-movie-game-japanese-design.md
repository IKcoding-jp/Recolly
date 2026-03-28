# 検索改善: アニメ映画分類 + ゲーム日本語検索

## 概要

作品検索の2つの問題を解決する:
1. アニメ映画（千と千尋の神隠し等）が「アニメ」に分類される → 「映画」にすべき
2. ゲームが日本語で検索できない・英語タイトルで表示される → Wikipedia JP APIで日本語化

## 背景

- AniListは全アニメーション作品を`type: ANIME`で返すが、`format`フィールドでTV/MOVIE/OVA等を区別できる
- IGDBは海外のゲームDBのため、タイトル・説明が英語。日本語の`alternative_names`が登録されているゲームは少ない
- 日本語対応のゲーム専門APIは存在しない。日本語Wikipedia APIが最も有力な補完ソース

## 変更1: アニメ映画を「映画」に分類

### 仕様

AniListのGraphQLクエリに`format`フィールドを追加する。

| AniList format | Recolly media_type |
|---|---|
| MOVIE | movie |
| TV, TV_SHORT, OVA, ONA, SPECIAL, MUSIC | anime |
| MANGA, ONE_SHOT, NOVEL | manga |

### 変更ファイル

- `backend/app/services/external_apis/anilist_adapter.rb`
  - GraphQLクエリに`format`を追加
  - `normalize`メソッドで`format == 'MOVIE'`の場合`media_type: 'movie'`に変換

### 日本語説明の補完

アニメ映画（movie）もTVアニメ（anime）も同様にTMDBから日本語説明を取得する。`enrich_anilist_descriptions`の対象は`external_api_source == 'anilist'`なので、media_typeが変わっても補完は継続する。

### テスト

- `format: MOVIE`のアニメ → `media_type: 'movie'`になること
- `format: TV`のアニメ → `media_type: 'anime'`のままであること
- アニメ映画の日本語説明補完が引き続き動作すること

## 変更2: ゲーム検索にWikipedia日本語APIを追加

### 概要

日本語クエリでのゲーム検索を改善するため、日本語Wikipedia APIを補完ソースとして追加する。

### Wikipedia APIの仕様

- エンドポイント: `https://ja.wikipedia.org/w/api.php`
- 認証: 不要（User-Agentヘッダー推奨）
- レート制限: 100リクエスト/秒（非常に寛大）
- 料金: 無料

### 検索フロー

```
ユーザー「カービィ」で検索（media_type: game）
    ↓
① IGDB検索（現行: search + alternative_names）
    → 英語タイトルのゲーム + 一部日本語名あり
    ↓
② Wikipedia JP検索（新規: 日本語クエリの場合のみ）
    → 「星のカービィ」関連記事を発見
    → 各記事から日本語タイトル + 日本語説明（冒頭部分）を取得
    ↓
③ Wikipedia結果の各タイトルでIGDB再検索
    → IGDBにあるゲームだけ採用（カバー画像・プラットフォーム情報を確保）
    ↓
④ ①と③の結果をマージ（IGDB ID で重複除去）
    → ③の結果は日本語タイトル・日本語説明で表示
    → ①の結果はIGDBのタイトル（日本語alt_nameがあればそれ）で表示
```

### Wikipedia APIコール詳細

**記事検索:**
```
GET https://ja.wikipedia.org/w/api.php
  ?action=query
  &list=search
  &srsearch=カービィ
  &srlimit=10
  &format=json
```

**記事概要取得:**
```
GET https://ja.wikipedia.org/w/api.php
  ?action=query
  &titles=星のカービィ_スーパーデラックス
  &prop=extracts|pageimages
  &exintro=true        （冒頭部分のみ）
  &explaintext=true    （プレーンテキスト）
  &format=json
```

### 新規アダプター: WikipediaGameAdapter

`ExternalApis::WikipediaGameAdapter`を新規作成する。

**責務:**
- 日本語Wikipediaでゲーム記事を検索
- 記事タイトル（日本語ゲーム名）と概要（日本語説明）を返す
- 返す型は`SearchResult`ではなく、中間データ（タイトル + 説明のペア）

**このアダプターはBaseAdapterを継承しない。** 理由: Wikipediaはゲーム情報の補完ソースであり、単独で検索結果を返すべきではない（カバー画像やプラットフォーム情報がないため）。IGDBと組み合わせて初めて完全な結果になる。

### IgdbAdapterの変更

`search`メソッドを拡張し、日本語クエリの場合にWikipedia補完を行う:

1. 現行のsearch_japanese（search + pattern）を実行
2. WikipediaGameAdapterで日本語タイトル候補を取得
3. 各候補のタイトルでIGDB `search`を再検索
4. 結果をマージ（IGDB IDで重複除去）
5. Wikipedia経由で見つかったゲームには日本語タイトル・説明をセット

### ゲーム日本語説明の扱い

Wikipedia経由で見つかったゲームには、Wikipedia記事の冒頭（intro）を日本語説明として使う。IGDB単独で見つかったゲームには日本語説明がない（英語のまま）。

### 変更ファイル

- `backend/app/services/external_apis/wikipedia_game_adapter.rb`（新規）
- `backend/app/services/external_apis/igdb_adapter.rb`（Wikipedia補完ロジック追加）

### テスト

- 日本語クエリでWikipedia検索が呼ばれること
- Wikipedia結果のタイトルでIGDB再検索が行われること
- IGDBにマッチしたゲームのみ結果に含まれること（Wikipedia単独の結果は含まない）
- 重複除去が正しく動作すること
- 英語クエリではWikipedia検索が呼ばれないこと
- Wikipedia APIエラー時にIGDB検索結果だけで正常に動作すること

## 変更3: 英語検索ヒントの表示

### 仕様

フロントエンドで、以下の条件をすべて満たすとき英語検索ヒントを表示する:
- ゲーム（`media_type: 'game'`）で検索、または全ジャンル検索
- 検索結果のうちゲームが3件以下
- 検索クエリに日本語文字が含まれる

### 表示メッセージ

> 「海外ゲームは英語タイトルでも検索してみてください」

### 変更ファイル

- `frontend/src/pages/SearchPage/SearchPage.tsx`

### テスト

- ゲーム検索結果が3件以下 + 日本語クエリ → ヒント表示
- ゲーム検索結果が4件以上 → ヒント非表示
- 英語クエリ → ヒント非表示

## スコープ外

- Wikipedia単独の検索結果の表示（IGDBにないゲームはWikipediaからも表示しない）
- ゲーム説明の翻訳API連携
- Nintendo eShop等の非公式API連携
