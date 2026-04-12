# Issue #133: Route-based code splitting 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `frontend/src/App.tsx` の全ページ import を `React.lazy()` + 単一 `<Suspense>` に変更し、main bundle を 500KB 未満に削減する（現在 503.63 KB）。

**Architecture:** 全ページ（16 個）を `React.lazy` に変換し、`<Routes>` 全体を 1 つの `<Suspense>` で囲む。各ページは Vite/Rollup により自動的に別チャンクに分割される。`manualChunks` で独自グルーピングはせず、自動分割に任せる（YAGNI）。

**Tech Stack:** React 19、React Router 7、Vite 8、TypeScript

**関連:** Issue #133、PR #130 最終 Code Review M-4、ADR-0040（バンドルサイズ評価）

---

## 現状分析

```
dist/assets/index-C4iGj26p.js   503.63 kB │ gzip: 153.02 kB
```

`frontend/src/App.tsx` では以下 16 ページが全て静的 import：

- 認証系（4）: `LoginPage`, `SignUpPage`, `PasswordNewPage`, `PasswordEditPage`
- ダッシュボード系（6）: `HomePage`, `SearchPage`, `WorkDetailPage`, `LibraryPage`, `RecommendationsPage`, `AccountSettingsPage`
- パブリック系（3）: `CommunityPage`, `DiscussionDetailPage`, `UserProfilePage`
- 認証補助系（3）: `OauthUsernamePage`, `EmailPromptPage`, `MyPageRedirect`（これは inline 関数で別途）

## 設計方針

**1. 全ページを React.lazy に変換**

個別ページごとに最小の dynamic import を書く。各 Page は named export なので以下の変換が必要：

```ts
// Before:
import { LoginPage } from './pages/LoginPage/LoginPage'

// After:
const LoginPage = lazy(() =>
  import('./pages/LoginPage/LoginPage').then((m) => ({ default: m.LoginPage })),
)
```

**2. Suspense は `<Routes>` を囲む 1 箇所のみ**

各 `<Route>` に個別 Suspense を書くと冗長になるため、`<Routes>` 全体を 1 つの Suspense で囲む。fallback は既存の `appStyles.loading` クラスを再利用（デザインの一貫性）。

```tsx
<Suspense fallback={<div className={appStyles.loading}>読み込み中...</div>}>
  <Routes>...</Routes>
</Suspense>
```

**3. manualChunks は使わない**

Issue 本文では「auth / dashboard」という論理グルーピングが例示されているが、これは Rollup の `manualChunks` を使わないと実現できない。受け入れ条件は「main bundle < 500KB」「auth 用の別チャンクが生成されている」の 2 点で、**論理グルーピングは必須ではない**。Vite/Rollup が自動で作る細かいチャンク分割でも両条件を満たせるため、最小変更原則（YAGNI）で manualChunks は追加しない。

**4. MyPageRedirect は lazy 化対象外**

`App.tsx` 内の inline 関数なので、ファイル分離しない限り lazy 化できない。Issue #134 で削除予定なので触らない。

---

## Task 1: App.tsx の import を React.lazy に変換

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: React から lazy, Suspense を import**

`frontend/src/App.tsx` の 1 行目を以下に変更：

Before:
```tsx
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
```

After:
```tsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
```

- [ ] **Step 2: 全 16 ページの静的 import を lazy 化**

`frontend/src/App.tsx` の line 11〜25 の import 群（16 行）を削除し、以下の lazy 定義に置き換える：

Before（削除対象 line 11-25）:
```tsx
import { LoginPage } from './pages/LoginPage/LoginPage'
import { SignUpPage } from './pages/SignUpPage/SignUpPage'
import { PasswordNewPage } from './pages/PasswordNewPage/PasswordNewPage'
import { PasswordEditPage } from './pages/PasswordEditPage/PasswordEditPage'
import { HomePage } from './pages/HomePage/HomePage'
import { SearchPage } from './pages/SearchPage/SearchPage'
import { WorkDetailPage } from './pages/WorkDetailPage/WorkDetailPage'
import { LibraryPage } from './pages/LibraryPage/LibraryPage'
import { OauthUsernamePage } from './pages/OauthUsernamePage/OauthUsernamePage'
import { EmailPromptPage } from './pages/EmailPromptPage/EmailPromptPage'
import { AccountSettingsPage } from './pages/AccountSettingsPage/AccountSettingsPage'
import { CommunityPage } from './pages/CommunityPage/CommunityPage'
import { DiscussionDetailPage } from './pages/DiscussionDetailPage/DiscussionDetailPage'
import { UserProfilePage } from './pages/UserProfilePage/UserProfilePage'
import { RecommendationsPage } from './pages/RecommendationsPage/RecommendationsPage'
```

After（同じ位置に挿入）:
```tsx
// ページコンポーネントは全て lazy-load する（code splitting）
// 初回アクセス時に現在のルートに必要なチャンクのみダウンロードされる
const LoginPage = lazy(() =>
  import('./pages/LoginPage/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const SignUpPage = lazy(() =>
  import('./pages/SignUpPage/SignUpPage').then((m) => ({ default: m.SignUpPage })),
)
const PasswordNewPage = lazy(() =>
  import('./pages/PasswordNewPage/PasswordNewPage').then((m) => ({ default: m.PasswordNewPage })),
)
const PasswordEditPage = lazy(() =>
  import('./pages/PasswordEditPage/PasswordEditPage').then((m) => ({
    default: m.PasswordEditPage,
  })),
)
const HomePage = lazy(() =>
  import('./pages/HomePage/HomePage').then((m) => ({ default: m.HomePage })),
)
const SearchPage = lazy(() =>
  import('./pages/SearchPage/SearchPage').then((m) => ({ default: m.SearchPage })),
)
const WorkDetailPage = lazy(() =>
  import('./pages/WorkDetailPage/WorkDetailPage').then((m) => ({ default: m.WorkDetailPage })),
)
const LibraryPage = lazy(() =>
  import('./pages/LibraryPage/LibraryPage').then((m) => ({ default: m.LibraryPage })),
)
const OauthUsernamePage = lazy(() =>
  import('./pages/OauthUsernamePage/OauthUsernamePage').then((m) => ({
    default: m.OauthUsernamePage,
  })),
)
const EmailPromptPage = lazy(() =>
  import('./pages/EmailPromptPage/EmailPromptPage').then((m) => ({ default: m.EmailPromptPage })),
)
const AccountSettingsPage = lazy(() =>
  import('./pages/AccountSettingsPage/AccountSettingsPage').then((m) => ({
    default: m.AccountSettingsPage,
  })),
)
const CommunityPage = lazy(() =>
  import('./pages/CommunityPage/CommunityPage').then((m) => ({ default: m.CommunityPage })),
)
const DiscussionDetailPage = lazy(() =>
  import('./pages/DiscussionDetailPage/DiscussionDetailPage').then((m) => ({
    default: m.DiscussionDetailPage,
  })),
)
const UserProfilePage = lazy(() =>
  import('./pages/UserProfilePage/UserProfilePage').then((m) => ({ default: m.UserProfilePage })),
)
const RecommendationsPage = lazy(() =>
  import('./pages/RecommendationsPage/RecommendationsPage').then((m) => ({
    default: m.RecommendationsPage,
  })),
)
```

注意：Issue 本文に 15 ページと書かれているが、実コードには 14 ページ（上記 + `OauthUsernamePage` が認証系に含まれるか判断次第）がある。正確には **14 ページを lazy 化**する（`MyPageRedirect` は inline 関数なので対象外、#134 で削除予定）。

- [ ] **Step 3: <Routes> を <Suspense> で囲む**

`frontend/src/App.tsx` line 109 の `<Routes>` と line 209 の `</Routes>` を `<Suspense fallback={...}>` で囲む。

Before:
```tsx
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          ...
        </Routes>
```

After:
```tsx
        <Suspense fallback={<div className={appStyles.loading}>読み込み中...</div>}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            ...
          </Routes>
        </Suspense>
```

インデントは子の `<Route>` を 1 レベル深くする必要はない（Prettier が調整する）。そのまま同インデントでも動くが、Prettier が整形する可能性あり。Prettier hook が失敗したら `npx prettier --write src/App.tsx` で整形してから再コミット。

- [ ] **Step 4: コミット**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): Route-based code splitting で main bundle を分割

全 14 ページを React.lazy + <Suspense> で動的 import に変更。
Vite/Rollup が自動で各ページを別チャンクに分割するため、
初回アクセス時には現在のルートに必要なチャンクのみがダウンロードされる。

- main bundle を 500KB 未満に削減（Issue #133 受け入れ条件）
- login 画面で dashboard 系コードを読まないようになる
- Suspense fallback は既存の appStyles.loading クラスを再利用

Refs: #133"
```

---

## Task 2: 検証（build + test + lint）

**Files:**
- Verify only（コード変更なし）

- [ ] **Step 1: Vite build 実行（main bundle サイズ確認）**

Run: `cd frontend && npx vite build`

Expected:
- ビルド成功
- `dist/assets/index-*.js`（main chunk）のサイズが **500 KB 未満**
- 複数の `LoginPage-*.js`, `HomePage-*.js` 等のページチャンクが生成されている
- `Some chunks are larger than 500 kB` 警告が出ないこと

出力の tail 20 行をそのまま報告する。

- [ ] **Step 2: チャンク分割の確認**

Run: `cd frontend && ls dist/assets/*.js | wc -l`（Bash で）または Glob で `frontend/dist/assets/*.js` をリスト

Expected: 14 個以上の js チャンク（main + 各ページ + workbox）

- [ ] **Step 3: Vitest 全件パス確認**

Run: `cd frontend && npm test -- --run`

Expected: 全テストパス

**注意:** React.lazy を使うとテストで `Suspense` boundary が必要になる可能性あり。既存のテストがページコンポーネントを直接 render している場合は問題ないが、App 全体を render しているテストは Suspense 内で扱う必要がある。失敗した場合の対処は Step 5 で。

- [ ] **Step 4: ESLint 確認**

Run: `cd frontend && npm run lint`
Expected: エラー 0 件

- [ ] **Step 5: テスト失敗時の対応**

もし Vitest が `React.lazy` 関連のエラーで失敗した場合：
- 該当テストファイルで `<Suspense>` が必要か確認
- 既存のテストが個別ページを直接 import している場合は影響なし
- App 全体を render しているテストは `render(<App />)` を `render(<Suspense><App /></Suspense>)` に変更、または test 内で `waitFor` を使って lazy ロード完了を待つ

対応後に再度テスト実行。追加のコミットが必要な場合は以下のメッセージで：

```bash
git commit -m "test(frontend): React.lazy 対応のため Suspense を追加

Refs: #133"
```

---

## 完了条件（Issue #133 受け入れ条件の対応）

- [x] login/signup ページが動的 import に変更されている（Task 1）
- [x] `npx vite build` の output で main bundle が 500 KB 未満（Task 2 Step 1）
- [x] auth 用の別チャンクが生成されている（Task 2 Step 2）
- [x] 既存テスト全てパス（Task 2 Step 3）
- [ ] ブラウザで login → dashboard の遷移が正常動作（動作確認フェーズで実施）
- [ ] Suspense fallback が一瞬だけ表示される（動作確認フェーズで実施）

## 動作確認で見るべきこと

1. **/login にアクセス**: ログイン画面が表示される（初回 Suspense fallback が一瞬見えるかも）
2. **/signup への遷移**: 通常通り表示される
3. **ログイン後 /dashboard への遷移**: HomePage が表示される。初回ロード時に fallback が一瞬見える
4. **/library, /search などのタブ遷移**: 各ページの初回ロード時のみ fallback が一瞬見える
5. **2 回目以降の遷移**: チャンクがキャッシュされるので fallback は見えない
