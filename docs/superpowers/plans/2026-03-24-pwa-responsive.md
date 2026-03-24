# PWA化 + スマホレスポンシブ対応 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全ページをスマホ・タブレット・PCの3段階レスポンシブ対応にし、PWA（アプリシェルキャッシュ + オフライン画面）を実装する。

**Architecture:** 既存のCSS Modules + CSS変数の設計を維持し、各コンポーネントの`.module.css`にメディアクエリを追加する。新規コンポーネントはBottomTabBar（モバイルナビ）とUpdatePrompt（SW更新通知）の2つ。PWAはvite-plugin-pwaで実装し、アプリシェルのプリキャッシュとカスタムオフライン画面を提供する。

**Tech Stack:** React 19, TypeScript, CSS Modules, vite-plugin-pwa (Workbox), react-router-dom v7

**Spec:** `docs/superpowers/specs/2026-03-24-pwa-responsive-design.md`

---

## ファイル構成

### 新規作成

| ファイル | 責務 |
|---------|------|
| `frontend/src/components/ui/BottomTabBar/BottomTabBar.tsx` | モバイル用ボトムタブバーコンポーネント |
| `frontend/src/components/ui/BottomTabBar/BottomTabBar.module.css` | ボトムタブバーのスタイル（768px以下で表示） |
| `frontend/src/components/ui/BottomTabBar/BottomTabBar.test.tsx` | ボトムタブバーのテスト |
| `frontend/src/components/ui/UpdatePrompt/UpdatePrompt.tsx` | SW更新通知トーストコンポーネント |
| `frontend/src/components/ui/UpdatePrompt/UpdatePrompt.module.css` | 更新通知のスタイル |
| `frontend/src/components/ui/UpdatePrompt/UpdatePrompt.test.tsx` | 更新通知のテスト |
| `frontend/public/offline.html` | カスタムオフラインページ |
| `frontend/public/icons/icon-192x192.png` | PWAアイコン 192x192 |
| `frontend/public/icons/icon-512x512.png` | PWAアイコン 512x512 |
| `frontend/public/icons/apple-touch-icon-180x180.png` | iOS用アイコン |
| `frontend/src/App.module.css` | AuthenticatedLayoutのスマホ余白スタイル |

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/styles/tokens.css` | ブレークポイント変数追加 |
| `frontend/src/components/ui/NavBar/NavBar.tsx` | スマホ時リンク非表示のクラス追加は不要（CSS制御） |
| `frontend/src/components/ui/NavBar/NavBar.module.css` | タブレット縮小 + スマホ時リンク非表示 |
| `frontend/src/App.tsx` | BottomTabBar + UpdatePrompt 組み込み |
| `frontend/src/pages/DashboardPage/DashboardPage.module.css` | スマホ用メディアクエリ追加 |
| `frontend/src/pages/SearchPage/SearchPage.module.css` | スマホ用メディアクエリ追加 |
| `frontend/src/pages/LibraryPage/LibraryPage.module.css` | スマホ用メディアクエリ追加 |
| `frontend/src/pages/WorkDetailPage/WorkDetailPage.module.css` | ブレークポイント640px→768pxに統一 |
| `frontend/src/styles/authForm.module.css` | スマホ用padding微調整 |
| `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.module.css` | スマホ用メディアクエリ追加 |
| `frontend/src/components/WorkCard/WorkCard.module.css` | スマホ用カバーサイズ縮小 |
| `frontend/src/components/RecordListItem/RecordListItem.module.css` | スマホ用カバーサイズ縮小 |
| `frontend/src/components/WatchingListItem/WatchingListItem.module.css` | スマホ用サイズ縮小 |
| `frontend/vite.config.ts` | vite-plugin-pwa設定追加 |
| `frontend/package.json` | vite-plugin-pwa依存追加 |
| `frontend/index.html` | theme-color, apple-touch-icon追加 |

---

## Task 1: デザイントークンにブレークポイント変数を追加

**Files:**
- Modify: `frontend/src/styles/tokens.css`

- [ ] **Step 1: tokens.cssにブレークポイント変数を追加**

`tokens.css`の`:root`ブロック末尾（`--transition-normal`の下）に追加:

```css
  /* --- ブレークポイント --- */
  /* メディアクエリではCSS変数を直接使用できないため、値の一元管理用として定義。 */
  /* メディアクエリでは数値リテラルで記述すること: */
  /*   スマホ: max-width: 768px */
  /*   タブレット: max-width: 1024px */
  --breakpoint-tablet: 769px;
  --breakpoint-desktop: 1025px;
```

- [ ] **Step 2: コミット**

```bash
git add frontend/src/styles/tokens.css
git commit -m "feat: デザイントークンにブレークポイント変数を追加"
```

---

## Task 2: BottomTabBarコンポーネント（TDD）

**Files:**
- Create: `frontend/src/components/ui/BottomTabBar/BottomTabBar.test.tsx`
- Create: `frontend/src/components/ui/BottomTabBar/BottomTabBar.tsx`
- Create: `frontend/src/components/ui/BottomTabBar/BottomTabBar.module.css`

- [ ] **Step 1: テストファイルを作成**

```tsx
// frontend/src/components/ui/BottomTabBar/BottomTabBar.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomTabBar } from './BottomTabBar'

function renderWithRouter(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomTabBar />
    </MemoryRouter>,
  )
}

describe('BottomTabBar', () => {
  it('4つのタブを表示する', () => {
    renderWithRouter()
    expect(screen.getByText('ホーム')).toBeInTheDocument()
    expect(screen.getByText('検索')).toBeInTheDocument()
    expect(screen.getByText('ライブラリ')).toBeInTheDocument()
    expect(screen.getByText('設定')).toBeInTheDocument()
  })

  it('各タブが正しいリンク先を持つ', () => {
    renderWithRouter()
    expect(screen.getByText('ホーム').closest('a')).toHaveAttribute('href', '/dashboard')
    expect(screen.getByText('検索').closest('a')).toHaveAttribute('href', '/search')
    expect(screen.getByText('ライブラリ').closest('a')).toHaveAttribute('href', '/library')
    expect(screen.getByText('設定').closest('a')).toHaveAttribute('href', '/settings')
  })

  it('現在のパスに対応するタブがアクティブになる', () => {
    renderWithRouter('/search')
    const searchTab = screen.getByText('検索').closest('a')
    expect(searchTab?.className).toMatch(/active/)
  })

  it('ダッシュボードパスでホームタブがアクティブになる', () => {
    renderWithRouter('/dashboard')
    const homeTab = screen.getByText('ホーム').closest('a')
    expect(homeTab?.className).toMatch(/active/)
  })

  it('/settings/xxxのようなサブパスで設定タブがアクティブになる', () => {
    renderWithRouter('/settings/account')
    const settingsTab = screen.getByText('設定').closest('a')
    expect(settingsTab?.className).toMatch(/active/)
  })

  it('/works/:idではどのタブもアクティブにならない', () => {
    renderWithRouter('/works/123')
    const tabs = screen.getAllByRole('link')
    tabs.forEach((tab) => {
      expect(tab.className).not.toMatch(/active/)
    })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd frontend && npx vitest run src/components/ui/BottomTabBar/BottomTabBar.test.tsx
```

Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: コンポーネントを実装**

```tsx
// frontend/src/components/ui/BottomTabBar/BottomTabBar.tsx
import { Link, useLocation } from 'react-router-dom'
import styles from './BottomTabBar.module.css'

type TabItem = {
  label: string
  path: string
  icon: string
}

const TAB_ITEMS: TabItem[] = [
  { label: 'ホーム', path: '/dashboard', icon: '🏠' },
  { label: '検索', path: '/search', icon: '🔍' },
  { label: 'ライブラリ', path: '/library', icon: '📚' },
  { label: '設定', path: '/settings', icon: '⚙️' },
]

export function BottomTabBar() {
  const { pathname } = useLocation()

  // startsWith で判定し、/works/123 等のサブパスでも親タブをアクティブにする。
  // どのタブにもマッチしないパス（例: /works/:id）では全タブ非アクティブになる。
  const isActive = (tabPath: string) => pathname === tabPath || pathname.startsWith(tabPath + '/')

  return (
    <nav className={styles.tabBar}>
      {TAB_ITEMS.map((tab) => (
        <Link
          key={tab.path}
          to={tab.path}
          className={isActive(tab.path) ? styles.active : styles.tab}
        >
          <span className={styles.icon}>{tab.icon}</span>
          <span className={styles.label}>{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4: CSSを作成**

```css
/* frontend/src/components/ui/BottomTabBar/BottomTabBar.module.css */

/* PC・タブレットでは非表示 */
.tabBar {
  display: none;
}

@media (max-width: 768px) {
  .tabBar {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--color-bg-white);
    border-top: var(--border-width) solid var(--color-border);
    padding: var(--spacing-sm) 0 calc(var(--spacing-sm) + env(safe-area-inset-bottom));
    z-index: 50;
  }

  .tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-decoration: none;
    color: var(--color-text-muted);
    font-family: var(--font-body);
    transition: color var(--transition-fast);
  }

  .active {
    composes: tab;
    color: var(--color-text);
  }

  .icon {
    font-size: 1.25rem;
  }

  .label {
    font-size: var(--font-size-meta);
    font-weight: var(--font-weight-bold);
  }
}
```

- [ ] **Step 5: テストが通ることを確認**

```bash
cd frontend && npx vitest run src/components/ui/BottomTabBar/BottomTabBar.test.tsx
```

Expected: PASS（6 tests）

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ui/BottomTabBar/
git commit -m "feat: BottomTabBarコンポーネントを追加"
```

---

## Task 3: NavBarのレスポンシブ対応

**Files:**
- Modify: `frontend/src/components/ui/NavBar/NavBar.module.css`

NavBar.tsxの変更は不要。CSSのメディアクエリだけでリンク・ユーザーメニューの非表示を制御する。

- [ ] **Step 1: NavBar.module.cssにメディアクエリを追加**

ファイル末尾に追加:

```css
/* タブレット: ナビリンクを縮小 */
@media (max-width: 1024px) {
  .links {
    gap: var(--spacing-md);
  }

  .link {
    font-size: var(--font-size-label);
    letter-spacing: 1px;
  }
}

/* スマホ: リンクとユーザーメニューを非表示（BottomTabBarに移行） */
@media (max-width: 768px) {
  .right {
    display: none;
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add frontend/src/components/ui/NavBar/NavBar.module.css
git commit -m "feat: NavBarのタブレット縮小+スマホ非表示対応"
```

---

## Task 4: App.tsxにBottomTabBarを組み込み

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: App.module.cssを作成**

AuthenticatedLayout用のCSS Modulesファイルを作成する（プロジェクト規約に従いグローバルCSSではなくCSS Modulesを使用）:

```css
/* frontend/src/App.module.css */

/* ボトムタブバー分の余白（スマホのみ） */
@media (max-width: 768px) {
  .authenticatedContent {
    padding-bottom: 64px;
  }
}
```

- [ ] **Step 2: AuthenticatedLayoutにBottomTabBarを追加**

`App.tsx`で`BottomTabBar`と`App.module.css`をimportし、`AuthenticatedLayout`内の`{children}`の後に配置。既存のBrowserRouter→AuthProviderの親子関係は変更しない:

```tsx
// import追加（既存のimportの近くに）
import { BottomTabBar } from './components/ui/BottomTabBar/BottomTabBar'
import appStyles from './App.module.css'

// AuthenticatedLayout内を変更
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <>
      <NavBar user={user} onLogout={() => void logout()} />
      <div className={appStyles.authenticatedContent}>
        {children}
      </div>
      <BottomTabBar />
    </>
  )
}
```

- [ ] **Step 3: 開発サーバーで動作確認**

Docker環境で `docker compose up` 後、ブラウザの開発者ツールでモバイル表示（375px幅）に切り替え:
- BottomTabBarが下部に表示されること
- NavBarのリンクが非表示になりロゴのみ表示されること
- タブをクリックしてページ遷移できること
- ログインページではBottomTabBarが表示されないこと

- [ ] **Step 4: コミット**

```bash
git add frontend/src/App.tsx frontend/src/App.module.css
git commit -m "feat: AuthenticatedLayoutにBottomTabBarを組み込み"
```

---

## Task 5: ダッシュボードページのレスポンシブ対応

**Files:**
- Modify: `frontend/src/pages/DashboardPage/DashboardPage.module.css`
- Modify: `frontend/src/components/WatchingListItem/WatchingListItem.module.css`

- [ ] **Step 1: DashboardPage.module.cssにメディアクエリを追加**

ファイル末尾に追加:

```css
@media (max-width: 768px) {
  .container {
    max-width: 100%;
    padding: 0 var(--spacing-md);
    margin: var(--spacing-md) auto;
  }
}
```

- [ ] **Step 2: WatchingListItem.module.cssにメディアクエリを追加**

ファイル末尾に追加:

```css
@media (max-width: 768px) {
  .row {
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .cover {
    width: 32px;
    height: 45px;
  }

  .coverPlaceholder {
    width: 32px;
    height: 45px;
  }

  .actionButton {
    width: auto;
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--font-size-label);
  }
}
```

- [ ] **Step 3: 動作確認**

ブラウザのモバイル表示（375px幅）でダッシュボードページを確認:
- コンテナが画面幅いっぱいに表示されること
- カバー画像が小さくなっていること
- アクションボタンが収まっていること

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/DashboardPage/DashboardPage.module.css frontend/src/components/WatchingListItem/WatchingListItem.module.css
git commit -m "feat: ダッシュボードページのスマホレスポンシブ対応"
```

---

## Task 6: 検索ページのレスポンシブ対応

**Files:**
- Modify: `frontend/src/pages/SearchPage/SearchPage.module.css`
- Modify: `frontend/src/components/WorkCard/WorkCard.module.css`

- [ ] **Step 1: SearchPage.module.cssにメディアクエリを追加**

ファイル末尾に追加:

```css
@media (max-width: 768px) {
  .page {
    padding: var(--spacing-md);
  }

  .container {
    max-width: 100%;
  }

  .filters {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .filters::-webkit-scrollbar {
    display: none;
  }
}
```

- [ ] **Step 2: WorkCard.module.cssにメディアクエリを追加**

ファイル末尾に追加:

```css
@media (max-width: 768px) {
  .coverWrapper {
    width: 48px;
    height: 68px;
  }
}
```

- [ ] **Step 3: 動作確認**

ブラウザのモバイル表示（375px幅）で検索ページを確認:
- ジャンルフィルタが横スクロールになっていること
- WorkCardのカバー画像が小さくなっていること
- 検索フォームが画面幅に収まっていること

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/SearchPage/SearchPage.module.css frontend/src/components/WorkCard/WorkCard.module.css
git commit -m "feat: 検索ページのスマホレスポンシブ対応"
```

---

## Task 7: ライブラリページのレスポンシブ対応

**Files:**
- Modify: `frontend/src/pages/LibraryPage/LibraryPage.module.css`
- Modify: `frontend/src/components/RecordListItem/RecordListItem.module.css`

- [ ] **Step 1: LibraryPage.module.cssにメディアクエリを追加**

ファイル末尾に追加:

```css
@media (max-width: 768px) {
  .page {
    max-width: 100%;
    padding: var(--spacing-md);
  }

  .filters {
    flex-direction: row;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .filters > *:nth-child(-n+2) {
    flex: 1;
    min-width: 0;
  }
}
```

注: StatusFilterとMediaTypeFilterが最初の2要素で横並び、SortSelectorが3番目で独立行になる。

- [ ] **Step 2: RecordListItem.module.cssにメディアクエリを追加**

ファイル末尾に追加:

```css
@media (max-width: 768px) {
  .coverWrapper {
    width: 36px;
    height: 50px;
  }

  .title {
    font-size: var(--font-size-label);
  }
}
```

- [ ] **Step 3: 動作確認**

ブラウザのモバイル表示（375px幅）でライブラリページを確認:
- フィルタが2列+1列に配置されていること
- RecordListItemのカバー画像が小さくなっていること
- ページネーションが画面幅に収まっていること

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/LibraryPage/LibraryPage.module.css frontend/src/components/RecordListItem/RecordListItem.module.css
git commit -m "feat: ライブラリページのスマホレスポンシブ対応"
```

---

## Task 8: 作品詳細ページのブレークポイント統一

**Files:**
- Modify: `frontend/src/pages/WorkDetailPage/WorkDetailPage.module.css`

- [ ] **Step 1: 既存の640pxメディアクエリを削除し、768pxの統合版に置き換え**

既存の `@media (max-width: 640px)` ブロックを丸ごと削除し、以下の統合版に置き換える（コンテナのmax-width解除も追加）:

```css
@media (max-width: 768px) {
  .page {
    padding: var(--spacing-md);
  }

  .container {
    max-width: 100%;
  }

  .layout {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    max-width: 200px;
    margin: 0 auto;
  }

  .dates {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
}
```

- [ ] **Step 2: 動作確認**

ブラウザのモバイル表示（375px幅）で作品詳細ページを確認:
- カバー画像が中央に配置されること
- 1カラムレイアウトになっていること
- 日付フィールドが縦並びになっていること

- [ ] **Step 3: コミット**

```bash
git add frontend/src/pages/WorkDetailPage/WorkDetailPage.module.css
git commit -m "feat: 作品詳細ページのブレークポイントを768pxに統一"
```

---

## Task 9: 認証ページのレスポンシブ微調整

**Files:**
- Modify: `frontend/src/styles/authForm.module.css`

- [ ] **Step 1: authForm.module.cssにメディアクエリを追加**

ファイル末尾に追加:

```css
@media (max-width: 768px) {
  .card {
    padding: var(--spacing-lg);
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add frontend/src/styles/authForm.module.css
git commit -m "feat: 認証ページのスマホ用padding微調整"
```

---

## Task 10: アカウント設定ページのレスポンシブ対応

**Files:**
- Modify: `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.module.css`

- [ ] **Step 1: AccountSettingsPage.module.cssにメディアクエリを追加**

ファイル末尾に追加:

```css
@media (max-width: 768px) {
  .page {
    max-width: 100%;
    padding: 0 var(--spacing-md);
  }

  .providerRow {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--font-size-label);
  }
}
```

- [ ] **Step 2: 動作確認**

ブラウザのモバイル表示（375px幅）で設定ページを確認:
- コンテナが全幅に広がっていること
- プロバイダー行が画面幅に収まっていること

- [ ] **Step 3: コミット**

```bash
git add frontend/src/pages/AccountSettingsPage/AccountSettingsPage.module.css
git commit -m "feat: アカウント設定ページのスマホレスポンシブ対応"
```

---

## Task 11: PWA — vite-plugin-pwaのセットアップ

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`

**参照ドキュメント:** vite-plugin-pwaのドキュメント（context7 MCPで取得すること）

- [ ] **Step 1: vite-plugin-pwaをインストール**

```bash
cd frontend && npm install -D vite-plugin-pwa
```

- [ ] **Step 2: vite.config.tsにPWA設定を追加**

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png', 'offline.html'],
      manifest: {
        name: 'Recolly',
        short_name: 'Recolly',
        description: '物語性のあるメディアをジャンル横断で記録・分析・共有',
        theme_color: '#fafaf8',
        background_color: '#fafaf8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://backend:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
```

- [ ] **Step 3: ビルドが通ることを確認**

```bash
cd frontend && npx tsc -b && npx vite build
```

Expected: ビルド成功。SW関連ファイルが`dist/`に生成される。

- [ ] **Step 4: コミット**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts
git commit -m "feat: vite-plugin-pwaをセットアップ"
```

---

## Task 12: PWA — アイコンとindex.html更新

**Files:**
- Create: `frontend/public/icons/icon-192x192.png`
- Create: `frontend/public/icons/icon-512x512.png`
- Create: `frontend/public/icons/apple-touch-icon-180x180.png`
- Modify: `frontend/index.html`

- [ ] **Step 1: アイコンディレクトリを作成し、SVGからPNGを生成**

既存の`frontend/public/favicon.svg`をベースにPNGアイコンを生成する。

方法A（sharpがある場合）:
```bash
cd frontend && node -e "
const sharp = require('sharp');
const sizes = [[192,192,'icon-192x192.png'],[512,512,'icon-512x512.png'],[180,180,'apple-touch-icon-180x180.png']];
sizes.forEach(([w,h,name]) => sharp('public/favicon.svg').resize(w,h).png().toFile('public/icons/'+name).then(()=>console.log(name+' created')));
"
```

方法B（sharpがない場合）: Inkscape、ImageMagick、またはオンラインツールで手動変換。`public/icons/` ディレクトリに3ファイルを配置。

- [ ] **Step 2: index.htmlにPWA用メタタグを追加**

`<head>`内の`<title>Recolly</title>`の直前に追加:

```html
    <meta name="theme-color" content="#fafaf8" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png" />
```

- [ ] **Step 3: コミット**

```bash
git add frontend/public/icons/ frontend/index.html
git commit -m "feat: PWAアイコンとメタタグを追加"
```

---

## Task 13: PWA — カスタムオフラインページ

**Files:**
- Create: `frontend/public/offline.html`

- [ ] **Step 1: offline.htmlを作成**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#fafaf8" />
  <title>Recolly — オフライン</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Zen Kaku Gothic New', sans-serif;
      background: #fafaf8;
      color: #2c2c2c;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    .logo {
      font-family: 'Fraunces', serif;
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
    }
    .message {
      font-size: 1rem;
      color: #6b6b6b;
      margin-bottom: 2rem;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      padding: 0.75rem 2rem;
      background: #2c2c2c;
      color: #ffffff;
      border: none;
      font-size: 1rem;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: opacity 150ms ease;
    }
    .button:hover { opacity: 0.8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Recolly</div>
    <p class="message">インターネットに接続されていません。<br>接続を確認してもう一度お試しください。</p>
    <button class="button" onclick="window.location.reload()">再読み込み</button>
  </div>
</body>
</html>
```

- [ ] **Step 2: コミット**

```bash
git add frontend/public/offline.html
git commit -m "feat: カスタムオフラインページを追加"
```

---

## Task 14: UpdatePromptコンポーネント（TDD）

**Files:**
- Create: `frontend/src/components/ui/UpdatePrompt/UpdatePrompt.test.tsx`
- Create: `frontend/src/components/ui/UpdatePrompt/UpdatePrompt.tsx`
- Create: `frontend/src/components/ui/UpdatePrompt/UpdatePrompt.module.css`
- Modify: `frontend/src/App.tsx`

**参照ドキュメント:** vite-plugin-pwaの`useRegisterSW` API（context7 MCPで取得すること）

- [ ] **Step 1: テストファイルを作成**

```tsx
// frontend/src/components/ui/UpdatePrompt/UpdatePrompt.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdatePrompt } from './UpdatePrompt'

describe('UpdatePrompt', () => {
  it('needRefreshがtrueのとき更新通知を表示する', () => {
    render(<UpdatePrompt needRefresh={true} onRefresh={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('新しいバージョンがあります')).toBeInTheDocument()
    expect(screen.getByText('更新する')).toBeInTheDocument()
  })

  it('needRefreshがfalseのとき何も表示しない', () => {
    const { container } = render(
      <UpdatePrompt needRefresh={false} onRefresh={vi.fn()} onClose={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('更新するボタンをクリックするとonRefreshが呼ばれる', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    render(<UpdatePrompt needRefresh={true} onRefresh={onRefresh} onClose={vi.fn()} />)
    await user.click(screen.getByText('更新する'))
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('閉じるボタンをクリックするとonCloseが呼ばれる', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<UpdatePrompt needRefresh={true} onRefresh={vi.fn()} onClose={onClose} />)
    await user.click(screen.getByLabelText('閉じる'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd frontend && npx vitest run src/components/ui/UpdatePrompt/UpdatePrompt.test.tsx
```

Expected: FAIL

- [ ] **Step 3: コンポーネントを実装**

```tsx
// frontend/src/components/ui/UpdatePrompt/UpdatePrompt.tsx
import styles from './UpdatePrompt.module.css'

type UpdatePromptProps = {
  needRefresh: boolean
  onRefresh: () => void
  onClose: () => void
}

export function UpdatePrompt({ needRefresh, onRefresh, onClose }: UpdatePromptProps) {
  if (!needRefresh) return null

  return (
    <div className={styles.toast}>
      <span className={styles.message}>新しいバージョンがあります</span>
      <button className={styles.refreshButton} onClick={onRefresh}>
        更新する
      </button>
      <button className={styles.closeButton} onClick={onClose} aria-label="閉じる">
        ✕
      </button>
    </div>
  )
}
```

- [ ] **Step 4: CSSを作成**

```css
/* frontend/src/components/ui/UpdatePrompt/UpdatePrompt.module.css */
.toast {
  position: fixed;
  bottom: var(--spacing-xl);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  background: var(--color-text);
  color: var(--color-bg-white);
  padding: var(--spacing-sm) var(--spacing-lg);
  z-index: 60;
  font-family: var(--font-body);
  border: var(--border-width) solid var(--color-border);
}

.message {
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-medium);
}

.refreshButton {
  background: var(--color-bg-white);
  color: var(--color-text);
  border: none;
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-bold);
  font-family: inherit;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.refreshButton:hover {
  opacity: 0.8;
}

.closeButton {
  background: none;
  border: none;
  color: var(--color-bg-white);
  font-size: var(--font-size-body);
  cursor: pointer;
  padding: var(--spacing-xs);
  line-height: 1;
}

/* スマホ: ボトムタブバーの上に配置 */
@media (max-width: 768px) {
  .toast {
    bottom: calc(64px + var(--spacing-md));
    left: var(--spacing-md);
    right: var(--spacing-md);
    transform: none;
  }
}
```

- [ ] **Step 5: テストが通ることを確認**

```bash
cd frontend && npx vitest run src/components/ui/UpdatePrompt/UpdatePrompt.test.tsx
```

Expected: PASS（4 tests）

- [ ] **Step 6: App.tsxにSW登録とUpdatePromptを組み込み**

`App.tsx`にimportを追加し、`App`コンポーネント内で`useRegisterSW`を使用する。**既存のBrowserRouter→AuthProviderの親子関係は変更しない**。`UpdatePrompt`を`Routes`の兄弟要素として配置:

```tsx
// import追加（既存のimportの近くに）
import { useRegisterSW } from 'virtual:pwa-register/react'
import { UpdatePrompt } from './components/ui/UpdatePrompt/UpdatePrompt'

// Appコンポーネント内にuseRegisterSWを追加。
// 既存の構造（BrowserRouter > AuthProvider > Routes）は維持する。
function App() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <BrowserRouter>
      <AuthProvider>
        <UpdatePrompt
          needRefresh={needRefresh}
          onRefresh={() => void updateServiceWorker(true)}
          onClose={() => setNeedRefresh(false)}
        />
        <Routes>
          {/* 既存のルート定義はそのまま維持 */}
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
```

注: `useRegisterSW`はReact ContextやRouterに依存しないため、Appコンポーネント直下で安全に使用できる。

- [ ] **Step 6.5: TypeScript型定義を追加**

`frontend/tsconfig.app.json`の`compilerOptions.types`配列に`vite-plugin-pwa/react`を追加する:

```json
{
  "compilerOptions": {
    "types": ["vite/client", "vitest/globals", "vite-plugin-pwa/react"]
  }
}
```

これがないと`virtual:pwa-register/react`のimportでTypeScriptエラーになる。

- [ ] **Step 7: コミット**

```bash
git add frontend/src/components/ui/UpdatePrompt/ frontend/src/App.tsx frontend/tsconfig.app.json
git commit -m "feat: SW更新通知コンポーネントを追加"
```

---

## Task 15: 全テスト実行 + 動作確認

**Files:** なし（確認のみ）

- [ ] **Step 1: 全テストを実行**

```bash
cd frontend && npx vitest run
```

Expected: 全テストPASS

- [ ] **Step 2: リントチェック**

```bash
cd frontend && npm run lint && npm run format:check
```

Expected: エラーなし

- [ ] **Step 3: ビルド確認**

```bash
cd frontend && npx tsc -b && npx vite build
```

Expected: ビルド成功。`dist/`にSW関連ファイルが含まれる。

- [ ] **Step 4: 全ページの手動動作確認（Playwright MCPまたはブラウザ開発者ツール）**

以下を3つの幅で確認:
- **375px**（スマホ）: BottomTabBar表示、NavBarリンク非表示、各ページのレイアウト
- **768px**（タブレット縦）: BottomTabBar非表示、NavBarリンク縮小表示
- **1280px**（PC）: 変更なし、現状通り

確認ページ一覧:
1. ダッシュボード — リスト表示、アクションボタン
2. 検索 — フォーム、フィルタ横スクロール、検索結果
3. ライブラリ — フィルタ配置、リスト、ページネーション
4. 作品詳細 — 1カラム化、カバー中央
5. ログイン — フォーム中央配置、BottomTabBarなし
6. 設定 — プロバイダー行の配置

- [ ] **Step 5: 問題があれば修正してコミット**
