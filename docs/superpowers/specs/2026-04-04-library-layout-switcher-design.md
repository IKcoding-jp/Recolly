# ライブラリ レイアウト切り替え機能

## 概要

マイライブラリページ（`/library`）に複数のレイアウト表示モードを追加し、アイコンボタン1つで切り替えられるようにする。コレクション感と一覧性の両立が目的。

併せて、プロフィールページの作品選択モーダルの問題（画像が大きすぎる・サイズ不揃い・モーダルが小さい）も修正する。

## スコープ

### 含むもの

- マイライブラリページ（`/library`）にレイアウト切り替え機能を追加
- レイアウト3種: リスト / カード / コンパクトリスト
- レイアウト切り替えUIコンポーネント（LayoutSwitcher）
- レイアウト設定のlocalStorage永続化
- プロフィールページ作品選択モーダルの修正
- 公開ライブラリのレイアウト整備

### 含まないもの

- 公開ライブラリへのレイアウト切り替え機能追加
- バックエンドAPI変更（フロントエンドのみで完結）
- 新しいフィルター・ソート機能の追加

## レイアウト仕様

### 1. リスト表示（既存 — 変更なし）

- `RecordListItem` コンポーネントをそのまま使用
- カバー画像（50x70px）+ タイトル + ステータスバッジ + 評価 + プログレスバー + タグ
- コンテンツ最大幅: 600px

### 2. カード表示（新規 — Filmarks風）

- カバー画像 + タイトル + 評価 + ステータスバッジを縦型カードで表示
- カバー画像は `aspect-ratio: 2/3` + `object-fit: cover` でサイズ統一
- タイトルは1行表示、溢れたら `text-overflow: ellipsis`
- カバー画像がない場合はプレースホルダー表示
- コンテンツ最大幅: 1100px程度

**レスポンシブ列数:**

| 画面幅 | 列数 |
|--------|------|
| PC（1024px超） | 6列 |
| タブレット（768px〜1024px） | 4列 |
| モバイル（768px未満） | 3列 |

### 3. コンパクトリスト（新規）

- 画像なし、1行ずつ表示
- 左: タイトル、右: ステータスバッジ + 評価
- 行間は狭めに設定し、大量の作品を一気に見渡せる密度
- コンテンツ最大幅: 600px

## コンポーネント設計

### アプローチ: コンポーネント分離型

レイアウトごとに専用の表示コンポーネントを作成する。

### 新規コンポーネント・フック

| ファイル | 役割 |
|---------|------|
| `RecordCardItem/RecordCardItem.tsx` | カード表示用コンポーネント |
| `RecordCardItem/RecordCardItem.module.css` | カード表示用スタイル |
| `RecordCompactItem/RecordCompactItem.tsx` | コンパクトリスト用コンポーネント |
| `RecordCompactItem/RecordCompactItem.module.css` | コンパクトリスト用スタイル |
| `ui/LayoutSwitcher/LayoutSwitcher.tsx` | 切り替えボタンUI |
| `ui/LayoutSwitcher/LayoutSwitcher.module.css` | 切り替えボタンスタイル |
| `hooks/useLayoutPreference.ts` | localStorage管理カスタムフック |

### 既存ファイルの変更

| ファイル | 変更内容 |
|---------|---------|
| `LibraryPage.tsx` | LayoutSwitcher統合、レイアウトに応じた描画切り替え |
| `LibraryPage.module.css` | カード・コンパクト用のグリッドスタイル追加 |

### 型定義

```typescript
type LayoutType = 'list' | 'card' | 'compact'
```

## 切り替えUI（LayoutSwitcher）

### 配置

フィルターバー（ステータス・ジャンル・並び替え）の**下に独立した行**として配置。

### 構成

- 左側: 件数表示（例: 「12件の作品」）
- 右側: アイコンボタン3つ（リスト / カード / コンパクト）
- 選択中のアイコンは背景色で強調（塗りつぶし）

## データフロー

```
ユーザーがアイコンをクリック
  ↓
LayoutSwitcher が onLayoutChange コールバックを呼ぶ
  ↓
useLayoutPreference が localStorage に保存 + state を更新
  ↓
LibraryPage が現在のレイアウトに応じて描画コンポーネントを切り替え
  ↓
リスト → RecordListItem（max-width: 600px）
カード → RecordCardItem（6列グリッド・max-width: 1100px）
コンパクト → RecordCompactItem（max-width: 600px）
```

### 状態管理の方針

- レイアウト設定は `localStorage` で永続化（キー: `recolly-library-layout`）
- URLパラメータにはレイアウトを含めない（個人の表示設定のため）
- フィルター（ステータス・ジャンル・並び替え・タグ）は引き続きURLパラメータで管理

## プロフィールページ修正

### 作品選択モーダル

- モーダルサイズ拡大: 幅700px程度、高さ80vh程度
- 作品一覧をグリッド表示（4列程度）に変更
- 画像サイズ統一: `aspect-ratio: 2/3` + `object-fit: cover`
- 画像を現在の巨大表示から縮小

### 公開ライブラリ

- 既存のグリッド表示のレイアウトを整備（切り替え機能は追加しない）
- 画像サイズ・間隔の統一

## テスト方針

### フロントエンド（Vitest + React Testing Library）

- `RecordCardItem`: props に応じた表示内容の確認（タイトル・評価・ステータス・画像プレースホルダー）
- `RecordCompactItem`: props に応じた表示内容の確認
- `LayoutSwitcher`: クリック時に正しいレイアウトタイプが `onLayoutChange` で渡されること、選択中のボタンのハイライト
- `useLayoutPreference`: localStorage への読み書き、デフォルト値
- `LibraryPage`: レイアウト切り替え時に正しいコンポーネントが描画されること
