import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute'
import { NavBar } from './components/ui/NavBar/NavBar'
import { BottomTabBar } from './components/ui/BottomTabBar/BottomTabBar'
import { UpdatePrompt } from './components/ui/UpdatePrompt/UpdatePrompt'
import appStyles from './App.module.css'

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

// 認証済みならダッシュボードへ、未認証ならログインページへ
function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <div className={appStyles.loading}>読み込み中...</div>

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
}

// /mypageから/users/:idへのリダイレクト（後方互換性）
function MyPageRedirect() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <div className={appStyles.loading}>読み込み中...</div>
  if (!user) return <Navigate to="/login" replace />

  return <Navigate to={`/users/${user.id}`} replace />
}

// 認証済みページ共通レイアウト（NavBar + コンテンツ）
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()

  if (!user) return <div className={appStyles.loading}>読み込み中...</div>

  return (
    <>
      <NavBar user={user} onLogout={() => void logout()} />
      <div className={appStyles.authenticatedContent}>{children}</div>
      <BottomTabBar />
    </>
  )
}

// 未認証でも閲覧可能なページ用レイアウト（ログイン中はNavBar表示、未ログインは簡易ナビ）
function OptionalAuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth()

  if (isLoading) return <div className={appStyles.loading}>読み込み中...</div>

  if (user) {
    return (
      <>
        <NavBar user={user} onLogout={() => void logout()} />
        <div className={appStyles.authenticatedContent}>{children}</div>
        <BottomTabBar />
      </>
    )
  }

  return (
    <>
      <nav className={appStyles.publicNav}>
        <Link to="/login" className={appStyles.logo}>
          Recolly
        </Link>
        <Link to="/login" className={appStyles.loginLink}>
          ログイン
        </Link>
      </nav>
      <div className={appStyles.authenticatedContent}>{children}</div>
    </>
  )
}

function App() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <BrowserRouter>
      <AuthProvider>
        <AnimatePresence>
          {needRefresh && (
            <UpdatePrompt
              onRefresh={() => void updateServiceWorker(true)}
              onClose={() => setNeedRefresh(false)}
            />
          )}
        </AnimatePresence>
        <Suspense fallback={<div className={appStyles.loading}>読み込み中...</div>}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/password/new" element={<PasswordNewPage />} />
            <Route path="/password/edit" element={<PasswordEditPage />} />
            <Route path="/auth/complete" element={<OauthUsernamePage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <HomePage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/mypage" element={<MyPageRedirect />} />
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <SearchPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/library"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <LibraryPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/works/:id"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <WorkDetailPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/recommendations"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <RecommendationsPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/auth/email-setup"
              element={
                <ProtectedRoute>
                  <EmailPromptPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <AccountSettingsPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/community"
              element={
                <OptionalAuthLayout>
                  <CommunityPage />
                </OptionalAuthLayout>
              }
            />
            <Route
              path="/discussions/:id"
              element={
                <OptionalAuthLayout>
                  <DiscussionDetailPage />
                </OptionalAuthLayout>
              }
            />
            <Route
              path="/users/:id"
              element={
                <OptionalAuthLayout>
                  <UserProfilePage />
                </OptionalAuthLayout>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
