# 検索パフォーマンス改善 設計書

## 概要

SearchPage（作品検索）の初回検索速度を改善する。体感速度（フロントエンド）と実際の処理速度（バックエンド）の両方を改善する。

## 現状の問題

### 処理フロー（すべて順番に実行）

```
1. 外部API呼び出し（順番に1つずつ）
   - TMDB: 1〜2秒
   - AniList: 0.5〜1秒
   - Google Books: 0.5〜1秒
   - IGDB: 1〜2秒
   → 合計: 3〜6秒

2. 日本語説明の補完（各作品ごとに1つずつ）
   - AniListの結果 × TMDBで日本語取得 → なければWikipedia
   - 1件あたり1〜2秒 × 最大20件
   → 合計: 最悪20〜40秒

3. ソート・フィルタ → ほぼ0秒（無視できる）
```

**初回検索の最悪ケース: 約25〜45秒**

### 体感の問題

- ローディング中はスピナー（くるくる）のみ
- 何が起きているか分からない
- 結果が出るまで画面に変化がない

## 改善内容

### 1. フロントエンド: スケルトンUI + プログレス表示

#### SearchSkeletonコンポーネント

検索中に表示するスケルトン（グレーの枠）。実際のWorkCardと同じレイアウトを再現する。

- **カード構成**: 左に画像枠(80x120px) / 中央に情報枠(ジャンル・タイトル・説明) / 右にボタン枠
- **表示枚数**: 4枚（3枚はくっきり、4枚目は半透明 opacity: 0.5）
- **アニメーション**: シマー（波打つグラデーション）。各カードの開始を0.1秒ずつずらす
- **モバイル対応**: カバー画像枠を48x68pxに縮小（既存のWorkCardと同じ）

#### SearchProgressコンポーネント

検索の進捗を表示するバー。スケルトンの上部に配置する。

- **構成**: 小さなスピナー + テキスト + プログレスバー
- **3段階のメッセージ**（タイマーベースで切り替え）:
  1. 開始〜1秒: 「作品を検索しています...」
  2. 1秒〜2.5秒: 「詳細情報を取得しています...」
  3. 2.5秒〜: 「結果をまとめています...」
- **プログレスバー**: 確定的な進捗ではなく、ゆるやかに動くインジケーター（アニメーション）
- **切り替え方法**: フロントエンドのsetTimeoutで制御。バックエンドとの連動は不要（シンプルさ優先）

#### SearchPageへの組み込み

- `isSearching === true` のとき、現在のスピナーの代わりにSearchSkeleton + SearchProgressを表示
- 既存の検索ロジック・API呼び出しの変更は不要

### 2. バックエンド: 外部API呼び出しの並列化

#### 対象コード

`WorkSearchService#search` メソッド内の以下の行:

```ruby
# 現在（順番に実行）
results = adapters.flat_map { |adapter| adapter.safe_search(query) }
```

#### 改善方法

Rubyの `Thread` を使い、複数のアダプターを同時に呼び出す:

```ruby
# 改善後（並列実行）
threads = adapters.map { |adapter| Thread.new { adapter.safe_search(query) } }
results = threads.flat_map(&:value)
```

#### 効果

- 映画検索（TMDB + AniList）: 1.3秒 → 0.8秒（速い方ではなく遅い方1つ分）
- 全ジャンル検索（4 API）: 3〜6秒 → 1〜2秒（最も遅いAPI1つ分）

#### エラーハンドリング

- 各アダプターの `safe_search` が既にエラーを捕捉して空配列を返す設計
- 1つのスレッドが失敗しても他のスレッドには影響しない
- 追加のエラーハンドリングは不要

### 3. バックエンド: 日本語説明補完の並列化

#### 対象コード

`WorkSearchService#enrich_anilist_descriptions` メソッド:

```ruby
# 現在（1件ずつ順番に処理）
anilist_results.each do |result|
  description = fetch_japanese_description_from_tmdb(result, tmdb)
  description ||= wikipedia.fetch_extract(result.title)
  result.description = resolve_description(description, result.description)
end
```

#### 改善方法

同時実行数を制限しつつ並列化する:

```ruby
# 改善後（最大5件ずつ並列処理）
anilist_results.each_slice(5) do |batch|
  threads = batch.map do |result|
    Thread.new do
      tmdb = ExternalApis::TmdbAdapter.new
      wikipedia = ExternalApis::WikipediaClient.new
      description = fetch_japanese_description_from_tmdb(result, tmdb)
      description ||= wikipedia.fetch_extract(result.title)
      result.description = resolve_description(description, result.description)
    end
  end
  threads.each(&:join)
end
```

#### 設計判断: なぜ5件ずつか

- 外部APIへの同時接続数を制限し、レート制限（API側が「リクエスト多すぎ」と拒否すること）を避ける
- 5件ずつでも20件の処理が4バッチ（約4〜8秒）→ 1件ずつの20〜40秒から大幅改善
- スレッドごとに新しいアダプターインスタンスを作成（Faradayコネクションの共有を避ける）

#### 効果

- AniList結果20件の補完: 20〜40秒 → 4〜8秒（約5倍高速化）

### 4. バックエンド: キャッシュTTL延長

#### 変更内容

```ruby
# 現在
CACHE_TTL = 30.minutes

# 改善後
CACHE_TTL = 12.hours
```

#### 理由

- 作品の基本情報（タイトル、あらすじ、カバー画像）は頻繁に変わらない
- 12時間あれば、同じ日の中で同じ検索を繰り返しても即座に返る
- 新作情報の反映は最大12時間遅れるが、Recollyの用途（記録・管理）では問題にならない

## 改善効果の見込み

| シナリオ | 現在 | 改善後 |
|---------|------|--------|
| 全ジャンル初回検索（最悪ケース） | 25〜45秒 | 5〜10秒 |
| ジャンル指定初回検索 | 3〜20秒 | 1〜5秒 |
| 2回目以降（キャッシュヒット） | 即座 | 即座（12時間有効） |
| 体感 | スピナーのみ | スケルトン + 進捗表示 |

## ファイル変更一覧

### 新規作成

| ファイル | 内容 |
|---------|------|
| `frontend/src/components/SearchSkeleton/SearchSkeleton.tsx` | スケルトンUIコンポーネント |
| `frontend/src/components/SearchSkeleton/SearchSkeleton.module.css` | スケルトンのスタイル |
| `frontend/src/components/SearchProgress/SearchProgress.tsx` | プログレス表示コンポーネント |
| `frontend/src/components/SearchProgress/SearchProgress.module.css` | プログレスのスタイル |

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/pages/SearchPage/SearchPage.tsx` | スピナーをSearchSkeleton + SearchProgressに置き換え |
| `backend/app/services/work_search_service.rb` | API並列化 + 日本語補完並列化 + キャッシュTTL延長 |

## テスト方針

### バックエンド

- `WorkSearchService` の既存テストが引き続きパスすることを確認
- 並列化後もアダプターのエラーハンドリングが正しく動作するテスト
- キャッシュTTLが12時間に変更されたことのテスト

### フロントエンド

- SearchSkeletonが正しくレンダリングされるテスト
- SearchProgressの3段階メッセージ切り替えテスト
- 検索中にスケルトンが表示され、結果取得後に消えるテスト

## スコープ外

- ライブラリページ（LibraryPage）の絞り込み速度改善
- 検索結果のページネーション
- 検索のデバウンス（現在はフォーム送信ベースなので不要）
- Server-Sent Events / WebSocketによるリアルタイム進捗連携
