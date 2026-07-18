# 本検索の改善（ジャケット高解像度化・漫画除外・ラノベの帰属整理）設計

日付: 2026-07-18
ステータス: 承認済み

## 背景・課題

1. **本のジャケット解像度が低い**
   Google Books APIの `imageLinks.thumbnail` は幅128pxの低解像度画像を返す。
   ジャケット主体の検索グリッド（PR #210〜）では粗さが目立つ。

2. **本の検索結果に漫画が1巻ずつ混ざる**
   「ワンピース」で本を検索すると「恋するワンピース 1」「恋するワンピース 5」…と
   漫画の単巻がバラバラに表示される。漫画はAniList由来の「漫画」ジャンルで
   シリーズ単位に管理しており、本ジャンルに出すべきではない。

3. **ラノベ（ライトノベル）の帰属が曖昧**
   ラノベはGoogle Books（本）とAniList（漫画）の両方に存在する。
   どちらのジャンルで管理するかの方針が未定義だった。

## 実データ調査の結果（2026-07-18実施）

### Google Books API

- 漫画には `categories: ["Comics & Graphic Novels"]` が付与される
  （「恋するワンピース」「SAOコミック版」「転スラ漫画版」等で確認）
- ラノベは `["Young Adult Fiction"]` 等の分類で、漫画とは区別されている
  （SAO・転スラの小説版で確認）
- 一部の書籍は `categories` 欠損（`null`）
- サムネイルURLは `fife` パラメータで高解像度化できる:

| URLパラメータ | 実測サイズ |
|---|---|
| `zoom=1&edge=curl`（現状） | 128×174px |
| `zoom=1&fife=w400` | 400×543px |
| `zoom=1&fife=w800` | 800×1086px |

### AniList API

- `type: MANGA` にはラノベ（`format: NOVEL`）も含まれる
- ラノベはシリーズ単位で1エントリ・`volumes`（総巻数）を持つ
  （例: 転スラ小説版 = 1件・volumes: 23）。連載中は漫画同様 `volumes: null`
- Google Booksは1巻ずつ別レコードでシリーズ巻数管理が構造的に不可能

## 決定事項

### 1. ラノベは「漫画」ジャンル側で管理し、ジャンル表記を「漫画・ラノベ」に変更

- 理由: AniListならシリーズ単位1エントリ＋巻数管理ができる。Google Booksでは不可能
- AniListアダプターは変更しない（`format: NOVEL` を引き続き含める。現状の動作）
- 内部値 `media_type: 'manga'` は変更しない（DB・APIに影響なし）。UIラベルのみ変更

### 2. 本の検索から漫画を除外する

- `categories` に `Comics & Graphic Novels` を含む結果を除外
- `categories` 欠損の漫画は一部すり抜けるが、普通の本を誤って消すリスクがほぼないことを優先

### 3. 本のジャケットを高解像度化する

- サムネイルURLに `&fife=w400` を付与し、`&edge=curl`（ページめくれ装飾）を削除
- w400を選ぶ理由: カード幅200px前後 × 高精細ディスプレイ2倍で400pxあれば十分。
  w800は1枚300KB超になり検索結果40件では過剰
- URL書き換えのみで追加API呼び出しなし

## 変更内容

### バックエンド

**`backend/app/services/external_apis/google_books_adapter.rb`**

1. `search` の絞り込みに漫画除外を追加:
   `categories` に `Comics & Graphic Novels` を含むitemを除外する
2. `normalize_cover_image_url` を拡張:
   - `edge=curl` パラメータを削除
   - `fife=w400` パラメータを付与
   - 既存のhttp→https変換は維持

**`backend/app/services/work_search_service.rb`**

- `CACHE_VERSION` を `v10` → `v11` に更新（検索結果の構造変更のため）

### フロントエンド（UIラベルのみ）

「漫画」→「漫画・ラノベ」に変更する箇所（アプリ内の機能面ラベルすべて）:

- `frontend/src/lib/mediaTypeUtils.ts`（ジャンルラベル定義 2箇所）
- `frontend/src/pages/SearchPage/genreFilters.ts`（検索フィルタ）
- `frontend/src/pages/RecommendationsPage/MediaTabBar.tsx`（おすすめタブ）
- `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`（詳細ページ）
- `frontend/src/components/WorkCard/WorkCard.tsx`（カードのジャンルバッジ）
- `frontend/src/components/StatsSummary/statsLabels.ts`（統計）
- `frontend/src/components/MediaTypeFilter/mediaTypeOptions.ts`（ライブラリフィルタ）
- `frontend/src/components/ManualWorkForm/ManualWorkForm.tsx`（手動登録フォーム）
- 上記に対応するテストの期待値

**変更しない箇所**: ランディングページの紹介文・ジャンルピル
（「アニメ、映画、ドラマ、本、漫画、ゲーム」）は短さ優先で「漫画」のまま残す。

## 許容するトレードオフ

- **ラノベは「本」検索にも1巻ずつ出続ける**:
  「Young Adult Fiction」は普通のYA小説も含むため、ラノベだけを確実に除外する手段がない。
  本ジャンルで1冊ずつ記録したいユーザーには有用なため許容する
- **categories欠損の漫画のすり抜け**: 誤爆ゼロを優先した設計上の割り切り
- **fife=w400が元画像より大きい場合**: サーバー側で拡大されるため多少ぼやけるが、
  現状の128px固定より悪化することはない

## テスト方針（TDD）

- `google_books_adapter_spec.rb`:
  - `Comics & Graphic Novels` を含むitemが除外される
  - `categories` がnilのitemは除外されない
  - サムネイルURLに `fife=w400` が付与され `edge=curl` が除去される
  - URLがnilの場合にエラーにならない
- フロントエンド: ラベル変更に伴う既存テストの期待値更新

## 影響範囲

- 検索キャッシュはv11切り替えで自然に無効化（デプロイ後、初回検索が遅くなるのは既知挙動）
- DBスキーマ・API仕様の変更なし
- 既存の記録済み作品への影響なし（表示ラベルのみ変わる）
