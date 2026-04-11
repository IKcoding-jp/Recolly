# 作品詳細ページ UI リデザイン仕様書

## 概要

作品詳細ページ（`/works/:id`）のUI改善。現状の問題点（情報の詰まりすぎ、感想欄の見づらさ、セクション間の区切りの弱さ）を解決し、整理された見やすいレイアウトに変更する。

## 背景

現状の問題点：
1. **情報が詰まりすぎ**: ステータス・評価・進捗・感想・ディスカッション等が全て同じ重みで縦に並び、目が迷う
2. **感想欄のスタイルが見づらい**: ボトムラインのみのテキストエリアが、入力欄なのか表示エリアなのか分かりにくい
3. **セクション間の区切りが弱い**: 各セクションの境界が曖昧で、まとまりが分かりにくい

## デザイン決定事項

### 1. レイアウト: タブ分割方式

ヘッダー（カバー画像 + タイトル + ステータス + 評価）は固定で、コンテンツを3つのタブに分割する。

| タブ | 含まれる要素 |
|------|------------|
| **概要** | 進捗、再視聴回数、日付（開始・完了）、タグ、あらすじ、記録削除ボタン |
| **感想** | 作品の感想（入力+保存）、話数ごとの感想（一覧+新規投稿） |
| **コミュニティ** | ディスカッション（フィルター+投稿ボタン+一覧） |

**タブのスタイル:**
- フォントサイズ: 13px、font-weight: 600
- 非アクティブ: color `#999`
- アクティブ: color `#2c2c2c`、border-bottom `2px solid #2c2c2c`
- タブ行のborder-bottom: `2px solid #e8e8e0`
- タブ下の余白: `28px`

### 2. ヘッダーエリア（全タブ共通・上部固定）

上から順に:
1. カバー画像（左）+ 右側コンテンツエリア
2. タイトル（`font-size: 24px`、`font-family: Fraunces`）
3. メタ情報（メディアタイプ・話数、`font-size: 12px`、`color: #6b6b6b`）
4. ステータスセレクター（現状と同じタブ形式）
5. 評価セクション

### 3. 評価スライダー

**レイアウト:**
- 「評価」ラベル（左）とスコア表示（右）が同じ行に配置
- その下にスライダーバーをフル幅で配置
- スライダーの下に1〜10の目盛りと数字を表示

**スコア表示:**
- 数字: `font-size: 32px`、`font-weight: 700`、**ジャンルカラー**
- `/10`: `font-size: 14px`、`color: #6b6b6b`

**スライダーバー:**
- 高さ: `6px`、`border-radius: 3px`
- 背景（トラック）: `#e8e8e0`
- 塗り（フィル）: **ジャンルカラー**（例: アニメ `#3d5a80`）
- つまみ: `16px`丸、**ジャンルカラー**、`box-shadow: 0 1px 3px rgba(0,0,0,0.2)`

**操作方式: ステップ方式（1点刻み）**
- スムーズではなく、1〜10の整数値にスナップする
- ドラッグまたはクリックで最も近い目盛りに吸着

**目盛り:**
- 1〜10の各位置に目盛り線を表示
- 通常目盛り: `width: 1px`、`height: 6px`、`color: #d0d0c8`
- 強調目盛り（1, 5, 10）: `height: 8px`、`color: #b0b0a8`
- 数字ラベル: `font-size: 9px`、`color: #999`

**ジャンルカラー対応表:**

| ジャンル | カラー |
|---------|--------|
| アニメ | `#3d5a80` |
| 映画 | `#5e548e` |
| ドラマ | `#9f86c0` |
| 本 | `#c4956a` |
| 漫画 | `#e07a5f` |
| ゲーム | `#6b9080` |

### 4. 概要タブ

**進捗コントロール（インライン操作）:**
- `-` ボタン、数値表示（`24 / 24話`）、`+` ボタン、数値入力フィールドを横一列に配置
- ボタン: `28x28px`、`border: 1.5px solid #e0e0d0`、`border-radius: 4px`
- 数値入力: `width: 40px`、`height: 28px`
- **プログレスバーは表示しない**

**再視聴回数コントロール:**
- `-` ボタン、数値表示（`0回`）、`+` ボタンを横一列に配置
- 進捗と同じボタンスタイル

**日付表示:**
- ラベル + 値のシンプルな表示（操作UIなし）

**データ行レイアウト:**
- 進捗・再視聴回数・開始日・完了日を `display: flex`、`gap: 32px`、`flex-wrap: wrap` で横並び

**タグ:**
- 現状と同じピルスタイルの `+ タグを追加`

**あらすじ:**
- セクションタイトル（`font-size: 14px`、`font-weight: 700`）+ テキスト表示

**記録削除ボタン:**
- **右寄せ**（`justify-content: flex-end`）
- `border-top: 1px solid #e8e8e0`で上部に区切り線
- `margin-top: 48px`で十分な余白
- ボタンスタイル: 白背景、赤テキスト、赤ボーダー

### 5. 感想タブ

**作品の感想:**
- セクションタイトル + テキストエリア + 保存ボタン（右寄せ）
- テキストエリア: **枠線（アウトライン）スタイル**
  - `border: 2px solid #e0e0d0`、`border-radius: 4px`
  - `padding: 12px`、`min-height: 80px`
  - フォーカス時: `border-color: #2c2c2c`
- 保存ボタン: 黒背景、白テキスト、右寄せ

**話数ごとの感想カード:**
- **枠線（アウトライン）スタイル**
  - `border: 2px solid #e0e0d0`、`border-radius: 4px`、`padding: 16px`
- ヘッダー: 左に「第N話」+日付、**右に「編集」「削除」ボタン**
  - `display: flex`、`justify-content: space-between`
- 本文: `font-size: 14px`、`line-height: 1.8`
- カード間余白: `12px`

**新規投稿フォーム:**
- 上部に `border-top: 1px solid #e8e8e0` + `padding-top: 24px` で区切り
- 話数入力（第 [input] 話）+ テキストエリア + 保存ボタン（右寄せ）

### 6. コミュニティタブ

- ヘッダー行: 左に「ディスカッション」タイトル、右にフィルタードロップダウン + 投稿ボタン
- 空状態: 破線枠（`border: 1px dashed #e0e0d0`）+ 中央テキスト

### 7. レスポンシブ対応

ブレークポイント: `max-width: 768px`

- ヘッダー: `flex-direction: column`、カバー画像とテキストが縦積み
- ステータスタブ: `flex-wrap: wrap`、中央揃え
- データ行: `gap: 16px` に縮小
- ページパディング: `32px` → `16px`

## 変更対象ファイル

### フロントエンド

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx` | タブ分割レイアウトの実装 |
| `frontend/src/pages/WorkDetailPage/WorkDetailPage.module.css` | レイアウト・タブスタイルの変更 |
| `frontend/src/components/ui/RatingSlider/RatingSlider.tsx` | ステップ方式・目盛り・ジャンル色対応 |
| `frontend/src/components/ui/RatingSlider/RatingSlider.module.css` | スライダースタイルの変更 |
| `frontend/src/components/ReviewSection/ReviewSection.module.css` | 枠線スタイルへ変更 |
| `frontend/src/components/EpisodeReviewSection/EpisodeReviewSection.module.css` | 枠線スタイル・編集削除の右寄せ |
| `frontend/src/components/EpisodeReviewSection/EpisodeReviewSection.tsx` | 編集削除ボタンの配置変更 |
| `frontend/src/components/ui/ProgressControl/ProgressControl.tsx` | プログレスバー削除 |
| `frontend/src/components/ui/ProgressControl/ProgressControl.module.css` | プログレスバー関連スタイル削除 |
| `frontend/src/styles/tokens.css` | 必要に応じてトークン追加 |

### バックエンド

変更なし（UIのみの変更）

## テスト方針

- 各タブの切り替えが正しく動作すること
- 評価スライダーが1点刻みでスナップすること
- ジャンルごとに正しいカラーが適用されること
- レスポンシブ（768px以下）で正しくレイアウトが変わること
- 既存機能（ステータス変更、評価保存、感想投稿、タグ追加等）が引き続き正常に動作すること

## モックアップ

完成モック: `.superpowers/brainstorm/544-1775864705/content/final-mockup-v3.html`
