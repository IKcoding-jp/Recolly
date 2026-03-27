# ホーム画面修正 — 設計スペック

## 背景

PR #53でダッシュボードをマイページに移動した際、ホーム画面に「おかえりなさい」グリーティング + クイックアクションカードを新規追加した。しかし、元の要件は「はじめましょう」画面（DashboardEmptyState）をホーム画面に残し、進行中の作品があればそれを表示するレイアウトだった。

## 変更内容

### HomePage（`/`）

PR #53で追加した要素（グリーティング、クイックアクションカード）を削除し、以下のロジックに置き換える:

| 条件 | 表示内容 |
|------|---------|
| 進行中の作品なし | `DashboardEmptyState`（はじめましょう画面） |
| 進行中の作品あり | 進行中リスト（`WatchingListItem`） |

- `EmailPromptBanner` は引き続き表示
- `useDashboard` フックで進行中データを取得
- ローディング・エラー状態もハンドリングする

### MyPage（`/mypage`）

- 統計情報（`StatsSummary`）のみ残す
- 進行中リスト・`DashboardEmptyState` を削除

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/pages/HomePage/HomePage.tsx` | PR #53のコードを削除 → `useDashboard` + 条件分岐を実装 |
| `frontend/src/pages/HomePage/HomePage.module.css` | PR #53のスタイルを削除 → 進行中リスト用スタイルに置き換え |
| `frontend/src/pages/MyPage/MyPage.tsx` | 進行中リスト・DashboardEmptyState を削除、統計のみに |
| `frontend/src/pages/MyPage/MyPage.test.tsx` | テストを統計のみに合わせて修正 |

### 変更しないもの

- `DashboardEmptyState` コンポーネント自体（そのまま再利用）
- `useDashboard` フック（そのまま再利用）
- `WatchingListItem` コンポーネント（そのまま再利用）
- `App.tsx` のルーティング（`/mypage` ルートは維持）
- NavBar・UserMenuのマイページリンク（維持）
