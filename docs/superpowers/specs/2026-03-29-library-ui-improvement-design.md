# マイライブラリ UI/UX改善 — スペック

## 概要

マイライブラリページのフィルタUIと記録追加モーダルのレイアウトを改善し、直感的で整ったUIにする。

## 変更1: ライブラリページのフィルタUI

### 現状

- ステータス・ジャンル・並び替えの3種類のフィルタがピルボタン（丸いボタン）として縦に3段並んでいる
- 画面の約40%をフィルタが占有し、コンテンツ（作品リスト）が下に押し出される
- モバイルではフィルタが折りたたまれ「絞り込み」ボタンで展開する仕組み

### 変更後

- 3つのフィルタをすべて**ドロップダウン（セレクトボックス）**に変更
- 3つのセレクトボックスを**横1行に並べる**
- モバイルでも折りたたみ不要で**そのまま表示**

### 仕様詳細

#### レイアウト

```
[ステータス ▼] [ジャンル ▼] [並び替え ▼]
```

- 3つのドロップダウンをflexboxで横並び（`display: flex; gap: 8px;`）
- 各ドロップダウンは`flex: 1`で均等幅
- ページタイトル「マイライブラリ」の直下に配置

#### ドロップダウンの実装

- HTMLネイティブの`<select>`要素を使用（アクセシビリティ標準対応、実装がシンプル）
- 枠線: `1px solid var(--color-border-light)`
- 背景: `var(--color-bg-white)`
- フォントサイズ: `var(--font-size-meta)` 相当
- パディング: `6px 12px`
- 角丸なし（四角ボックス）
- ブラウザデフォルトのドロップダウン矢印を使用（CSSで`appearance`調整は必要に応じて）

#### 選択肢

ステータス:
- すべて（デフォルト）
- 視聴中 / 視聴完了 / 一時停止 / 中断 / 視聴予定
- ※メディアタイプによりラベルが変わる（既存の`getStatusOptions`を使用）

ジャンル:
- 全ジャンル（デフォルト）
- アニメ / 映画 / ドラマ / 本 / 漫画 / ゲーム

並び替え:
- 更新日順（デフォルト） / 評価順 / タイトル順

#### 削除する機能

- モバイルのフィルタ折りたたみ機能（filterSummary, showFilters状態）
- StatusFilterコンポーネント（ピルボタン版）
- MediaTypeFilterコンポーネント（ピルボタン版）
- SortSelectorコンポーネント（ピルボタン版）

#### レスポンシブ

- PC/モバイル共通で同じ横並びレイアウト
- モバイルでもドロップダウン3つが1行に収まる（各セレクトボックスはテキストが短いため）

#### 状態管理

- 既存のURLパラメータベースの状態管理（`useSearchParams`）はそのまま維持
- フィルタ変更時の自動ページリセットもそのまま維持

## 変更2: 記録追加モーダルのレイアウト改善

### 現状

- モーダルの中身が全体的に右寄りで整っていない
- ステータスのピルボタンが折り返して不揃い
- 評価ボタン10個が横一列で窮屈
- アクションボタンが右寄せ（`justify-content: flex-end`）で左側にスペースが偏る

### 変更後

- カード風デザインで各セクションを区切り、グリッドで均等配置

### 仕様詳細

#### タイトル・メタ情報

- `text-align: center` で中央揃え
- タイトル: `font-size: 18px`（現在の`var(--font-size-h4)`相当）
- メタ情報（メディアタイプラベル）: タイトル直下に表示

#### ステータスセクション

- グレー背景のカード（`background: #f8f8f8; border-radius: 8px; padding: 14px;`）で囲む
- CSSグリッド3列で均等配置（`display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;`）
- ステータスボタンのスタイル: 角丸6px（ピルではなく角丸四角）、中央揃えテキスト、白背景
- 選択中: 黒背景 + 白文字（既存のアクティブスタイルと同じ）

#### 評価セクション

- グレー背景のカード（ステータスと同じスタイル）で囲む
- CSSグリッド5列×2行で均等配置（`display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;`）
- 各ボタン: `height: 36px`、白背景、角丸4px
- 選択中: 黒背景 + 白文字（既存のアクティブスタイルと同じ）

#### デフォルトステータス

- 現在: `plan_to_watch`（視聴予定）
- 変更後: `watching`（視聴中 / 読書中 / プレイ中）
- 全メディアタイプ共通で「〜中」をデフォルトにする

#### アクションボタン

- フル幅・縦並び（`flex-direction: column`）
- 「記録する」ボタン（primary）が上
- 「キャンセル」ボタン（secondary）が下
- 各ボタン: `width: 100%; padding: 12px;`

#### モーダル全体

- パディング: `28px`（現在の`var(--spacing-xl)`から微調整）
- 各セクション間の余白を均一化（カード間: `12px`、最後のカード〜ボタン間: `20px`）

## 影響範囲

### フロントエンド

変更するファイル:
- `frontend/src/pages/LibraryPage/LibraryPage.tsx` — フィルタUIをドロップダウンに変更
- `frontend/src/pages/LibraryPage/useLibrary.ts` — フィルタ状態管理（変更少）
- `frontend/src/components/RecordModal/RecordModal.tsx` — レイアウト改善 + デフォルトステータス変更
- `frontend/src/components/RecordModal/RecordModal.module.css` — スタイル変更
- `frontend/src/components/ui/StatusSelector/StatusSelector.tsx` — グリッドレイアウト対応
- `frontend/src/components/ui/StatusSelector/StatusSelector.module.css` — スタイル変更
- `frontend/src/components/ui/RatingInput/RatingInput.tsx` — グリッドレイアウト対応
- `frontend/src/components/ui/RatingInput/RatingInput.module.css` — スタイル変更

削除候補:
- `frontend/src/components/StatusFilter/` — ドロップダウンに置き換えるため不要になる可能性
- `frontend/src/components/MediaTypeFilter/` — 同上
- `frontend/src/components/SortSelector/` — 同上

### バックエンド

変更なし。

## テスト方針

- LibraryPageのフィルタ操作テスト（ドロップダウン選択→URLパラメータ変更→リスト更新）
- RecordModalのレイアウトテスト（各要素の表示、デフォルトステータスがwatchingであること）
- モバイル表示の確認（ドロップダウンが1行に収まること）
