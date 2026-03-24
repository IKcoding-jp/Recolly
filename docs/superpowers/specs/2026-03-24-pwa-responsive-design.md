# PWA化 + スマホレスポンシブ対応 設計書

## 概要

フェーズ1（MVP）完了後、フェーズ2に入る前に全ページのスマホレスポンシブ対応とPWA化を行う。既存の機能は全て維持し、レイアウトのみ変更する。

## スコープ

1. **スマホレスポンシブ対応** — 全ページをモバイルでも使いやすいレイアウトに
2. **PWA化（スタンダード）** — ホーム画面追加 + アプリシェルキャッシュ + カスタムオフライン画面

### スコープ外

- 機能の追加・削除
- APIレスポンスのオフラインキャッシュ
- プッシュ通知

## ブレークポイント

3段階のレスポンシブ対応を行う。

| 名称 | 幅 | ナビゲーション |
|------|-----|---------------|
| スマホ | 〜768px | ボトムタブバー |
| タブレット | 769〜1024px | ヘッダーナビ（縮小版） |
| PC | 1025px〜 | ヘッダーナビ（現状維持） |

ブレークポイントは `tokens.css` にCSS変数として定義する。

```css
:root {
  --breakpoint-tablet: 769px;
  --breakpoint-desktop: 1025px;
}
```

注: CSS変数はメディアクエリ内で直接使用できないため、値の一元管理用として定義する。メディアクエリでは数値をリテラルで記述する。

## 共通レイアウト

### ナビゲーション

#### スマホ（〜768px）

- ヘッダー: ロゴのみ表示。ナビリンクとユーザーメニューは非表示
- ボトムタブバー: 画面下部に固定表示（`position: fixed; bottom: 0`）
- タブ構成: ホーム / 検索 / ライブラリ / 設定（4タブ）
- アクティブタブはフォントウェイトと色で強調
- コンテンツ領域にはボトムタブ分の `padding-bottom` を追加

#### タブレット（769〜1024px）

- ヘッダーナビを維持。以下を縮小して重なりを防止:
  - ナビリンクの gap: 1.5rem → 1rem
  - ナビリンクの font-size: 1rem → 0.875rem
  - letter-spacing: 1.5px → 1px

#### PC（1025px〜）

- 現状維持。変更なし。

### 新規コンポーネント: BottomTabBar

- `components/ui/BottomTabBar/` に配置
- React Router の `useLocation` でアクティブタブを判定
- 768px以下でのみ表示（CSSメディアクエリで制御）
- NavBar側は768px以下でナビリンク・ユーザーメニューを非表示にする

## ページ別レイアウト

### ダッシュボード

| 項目 | PC/タブレット | スマホ |
|------|-------------|-------|
| コンテナ max-width | 800px | 100%（padding: 0 1rem） |
| WatchingListItem カバー | 40x56px | 32x45px |
| アクションボタン幅 | 72px | 縮小（パディング調整） |
| padding | 2rem | 1rem |

構造変更なし。サイズ・余白の縮小のみ。

### 検索ページ

| 項目 | PC/タブレット | スマホ |
|------|-------------|-------|
| コンテナ max-width | 800px | 100%（padding: 0 1rem） |
| 検索フォーム | 横並び（input + button） | 横並び維持 |
| ジャンルフィルタ | flex-wrap | 横スクロール（`overflow-x: auto; flex-wrap: nowrap`） |
| WorkCard カバー | 80x120px | 48x68px |
| padding | 2rem | 1rem |

### ライブラリページ

| 項目 | PC/タブレット | スマホ |
|------|-------------|-------|
| コンテナ max-width | 600px | 100%（padding: 0 1rem） |
| フィルタ配置 | 縦並び（各1行） | 2列（ステータス+メディア）+ 1列（ソート） |
| RecordListItem カバー | 50x70px | 36x50px |
| padding | 2rem 1rem | 1rem |

### 作品詳細ページ

| 項目 | PC/タブレット | スマホ |
|------|-------------|-------|
| コンテナ max-width | 800px | 100%（padding: 0 1rem） |
| レイアウト | 横2段組（sidebar 180px + main） | 1カラム |
| カバー配置 | サイドバー左 | 中央配置（max-width: 200px） |
| 日付フィールド | 横並び | 縦並び |

既存の `@media (max-width: 640px)` メディアクエリを768pxに統一する。

### ログイン / サインアップ / OAuthユーザー名設定 / メール設定ページ

| 項目 | PC/タブレット | スマホ |
|------|-------------|-------|
| カード max-width | 400px | 100% |
| padding | 2rem | 1.5rem |

対象ページ: LoginPage, SignUpPage, OauthUsernamePage, EmailPromptPage

全て `authForm.module.css` を共有するフルページ中央配置のフォーム画面。既に `width: 100%; max-width: 400px` でレスポンシブ対応済み。padding微調整のみ。ナビバー・ボトムタブは非表示（認証フロー画面のため）。

### アカウント設定ページ

| 項目 | PC/タブレット | スマホ |
|------|-------------|-------|
| コンテナ max-width | 600px | 100%（padding: 0 1rem） |
| プロバイダー行 | 横並び（ラベル + ボタン） | 横並び維持（テキスト縮小） |

### モーダル（RecordModal）

既に `width: 90%; max-width: 400px; max-height: 90vh` でモバイル対応済み。変更なし。

## PWA設定

### ツール

`vite-plugin-pwa` を使用する（Workboxベース）。

### manifest.json

vite-plugin-pwa の設定から自動生成する。

```json
{
  "name": "Recolly",
  "short_name": "Recolly",
  "description": "物語性のあるメディアをジャンル横断で記録・分析・共有",
  "theme_color": "#fafaf8",
  "background_color": "#fafaf8",
  "display": "standalone",
  "start_url": "/",
  "scope": "/",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### アイコン

- 192x192 と 512x512 のPNGアイコンを生成
- 既存の `favicon.svg` をベースにする
- `public/icons/` に配置
- apple-touch-icon（180x180）も生成

### Service Worker

- **戦略**: アプリシェル（HTML/CSS/JS/フォント）をプリキャッシュ
- **APIリクエスト**: キャッシュしない（Network Only）
- **Google Fonts**: Runtime Caching で CacheFirst 戦略を適用
- **登録方式**: `registerType: 'prompt'`（新バージョンがある場合にリロードを促す）

### オフライン画面

ネットワーク未接続時に表示するカスタムオフラインページを作成する。

- Recollyロゴ
- 「インターネットに接続されていません」メッセージ
- 「再読み込み」ボタン
- `public/offline.html` として配置

### index.html への追加

```html
<meta name="theme-color" content="#fafaf8" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png" />
```

### 更新通知

新しいService Workerが利用可能な場合、画面下部にトースト通知を表示する。

- メッセージ: 「新しいバージョンがあります」
- ボタン: 「更新する」
- クリックでページリロード

## 技術的な注意事項

### CSS設計

- 既存のCSS Modules + CSS変数の方針を維持する
- 新しいCSSライブラリは導入しない（ADR-0006準拠）
- メディアクエリはモバイルファースト（`min-width`）ではなく、デスクトップファースト（`max-width`）で記述する（既存コードとの一貫性）

### ボトムタブバーの表示制御

- 認証フロー画面（Login, SignUp, OauthUsername, EmailPrompt, AuthCallback）では非表示
- 認証済みのメイン画面（Dashboard, Search, Library, WorkDetail, AccountSettings）では表示
- `App.tsx` のルーティング構造で制御。現在の `AuthenticatedLayout` の中にBottomTabBarを配置することで、認証済み画面のみに表示される

### ナビゲーション導線の差異

- **PC/タブレット**: 設定はヘッダーのUserMenu（ドロップダウン）から遷移
- **スマホ**: 設定はボトムタブバーの「設定」タブから直接遷移
- NavBarの無効ナビ項目（コミュニティ、おすすめ、マイページ）はスマホのボトムタブには含めない。将来有効化された際に追加を検討する

### 更新通知トーストの位置

- **PC/タブレット**: 画面下部中央に表示
- **スマホ**: ボトムタブバーの上に表示（タブと重ならないよう `bottom` 位置を調整）

### テスト

- BottomTabBar コンポーネントのユニットテスト
- NavBar のレスポンシブ表示切替テスト
- 各ページのレスポンシブレイアウトは手動確認（Playwright MCP）

## 対象ファイル

### 新規作成

- `frontend/src/components/ui/BottomTabBar/BottomTabBar.tsx`
- `frontend/src/components/ui/BottomTabBar/BottomTabBar.module.css`
- `frontend/src/components/ui/BottomTabBar/BottomTabBar.test.tsx`
- `frontend/src/components/ui/UpdatePrompt/UpdatePrompt.tsx` — SW更新通知トースト
- `frontend/src/components/ui/UpdatePrompt/UpdatePrompt.module.css`
- `frontend/src/components/ui/UpdatePrompt/UpdatePrompt.test.tsx`
- `public/icons/icon-192x192.png`
- `public/icons/icon-512x512.png`
- `public/icons/apple-touch-icon-180x180.png`
- `public/offline.html`

### 変更

- `frontend/vite.config.ts` — vite-plugin-pwa 設定追加
- `frontend/package.json` — vite-plugin-pwa 依存追加
- `frontend/index.html` — theme-color, apple-touch-icon 追加
- `frontend/src/styles/tokens.css` — ブレークポイント変数追加
- `frontend/src/components/ui/NavBar/NavBar.module.css` — レスポンシブ対応
- `frontend/src/components/ui/NavBar/NavBar.tsx` — スマホ時のリンク非表示
- `frontend/src/App.tsx` — BottomTabBar + UpdatePrompt（SW登録・更新通知）組み込み
- `frontend/src/pages/DashboardPage/DashboardPage.module.css` — レスポンシブ対応
- `frontend/src/pages/SearchPage/SearchPage.module.css` — レスポンシブ対応
- `frontend/src/pages/LibraryPage/LibraryPage.module.css` — レスポンシブ対応
- `frontend/src/pages/WorkDetailPage/WorkDetailPage.module.css` — ブレークポイント統一
- `frontend/src/styles/authForm.module.css` — padding微調整
- `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.module.css` — レスポンシブ対応
- `frontend/src/components/WorkCard/WorkCard.module.css` — カバーサイズ縮小
- `frontend/src/components/RecordListItem/RecordListItem.module.css` — カバーサイズ縮小
- `frontend/src/components/WatchingListItem/WatchingListItem.module.css` — サイズ縮小
