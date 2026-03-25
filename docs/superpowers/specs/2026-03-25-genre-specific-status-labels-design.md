# ジャンル別ステータスラベル対応

## 概要

現在、全メディアタイプで「視聴中」「視聴完了」「視聴予定」と表示されているステータスラベルを、ジャンルに応じた適切な表現に変更する。

## 背景

本や漫画に「視聴完了」、ゲームに「視聴中」と表示されるのは不自然。ジャンルごとに適切な動詞を使い分ける必要がある。

## ラベル定義

### ジャンル別ラベル（3グループ）

| ステータス | 映像系 (anime/movie/drama) | 読み物系 (book/manga) | ゲーム (game) | 汎用（mediaType未指定時） |
|-----------|--------------------------|---------------------|-------------|----------------------|
| watching | 視聴中 | 読書中 | プレイ中 | 進行中 |
| completed | 視聴完了 | 読了 | プレイ完了 | 完了 |
| plan_to_watch | 視聴予定 | 読書予定 | プレイ予定 | 予定 |
| on_hold | 一時停止 | 一時停止 | 一時停止 | 一時停止 |
| dropped | 中断 | 中断 | 中断 | 中断 |

- `on_hold` と `dropped` は全ジャンル共通
- 汎用ラベルはライブラリのステータスフィルターで「全ジャンル」選択時に使用

## 変更方針

### バックエンド: 変更なし

enum値（`watching`, `completed`, `on_hold`, `dropped`, `plan_to_watch`）はそのまま維持。ラベルは純粋にフロントエンドの表示の問題。

### フロントエンド

#### 1. ユーティリティ関数の追加

`frontend/src/lib/mediaTypeUtils.ts` に `getStatusLabel(status, mediaType?)` 関数を追加する。

- `mediaType` が渡されればジャンル別ラベルを返す
- `null` / `undefined` なら汎用ラベルを返す

#### 2. ハードコードされたラベルの統一

現在ステータスラベルが3箇所にハードコードされている。すべてユーティリティ関数に置き換える。

| コンポーネント | ファイル | 変更内容 |
|-------------|--------|---------|
| StatusSelector | `frontend/src/components/ui/StatusSelector/StatusSelector.tsx` | `mediaType` prop（`MediaType` 型、optional）を追加。内部の `STATUS_OPTIONS` 定数を削除し、`getStatusLabel()` を使用 |
| StatusFilter | `frontend/src/components/StatusFilter/statusOptions.ts` | 静的配列 → `getStatusOptions(mediaType?)` 関数に変更 |
| StatusFilter | `frontend/src/components/StatusFilter/StatusFilter.tsx` | `mediaType` prop（`MediaType` 型、optional）を追加。内部で `getStatusOptions(mediaType)` を呼び出してオプション配列を生成 |
| RecordListItem | `frontend/src/components/RecordListItem/RecordListItem.tsx` | `STATUS_LABELS` 定数を削除し、`getStatusLabel()` を使用。作品の `media_type` を参照 |

#### 3. 呼び出し元の変更

| 呼び出し元 | ファイル | 変更内容 |
|----------|--------|---------|
| RecordModal | `frontend/src/components/RecordModal/RecordModal.tsx` | `mediaType` propの型を `string` → `MediaType` に変更し、StatusSelectorに渡す |
| SearchPage | `frontend/src/pages/SearchPage/SearchPage.tsx` | RecordModalに渡す `mediaType` を `getGenreLabel()` の結果ではなく `work.media_type`（`MediaType` 型）に変更。表示用ラベルは別途渡す |
| WorkDetailPage | `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx` | 作品の `media_type` を StatusSelector に渡す |
| LibraryPage | `frontend/src/pages/LibraryPage/LibraryPage.tsx` | 選択中のジャンルフィルターの値を StatusFilter に渡す。モバイル用フィルタチップのステータスラベルも `getStatusOptions(mediaType)` から取得するよう変更 |

#### 4. ジャンルフィルター切替時の振る舞い

ライブラリページでステータスフィルターを選択中にジャンルフィルターを切り替えた場合、内部値（`watching` 等）は変わらずラベルのみが切り替わる。これは意図通りの振る舞いであり、フィルター条件自体は変わらない。

## スコープ外

- ダッシュボードのセクションタイトル（既に「進行中」という汎用ラベルで表示されているため変更不要）
- 進捗の単位表記（既に `mediaTypeUtils.ts` の `hasEpisodes()` 等で対応済み）

## テスト

- `getStatusLabel()` のユニットテスト（各ジャンル × 各ステータスの組み合わせ、mediaType未指定時の汎用ラベル）
- StatusSelector / StatusFilter / RecordListItem の既存テストを更新（mediaType propの追加に対応）
