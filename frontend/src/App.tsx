import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute'
import { NavBar } from './components/ui/NavBar/NavBar'
import { BottomTabBar } from './components/ui/BottomTabBar/BottomTabBar'
import { UpdatePrompt } from './components/ui/UpdatePrompt/UpdatePrompt'
import appStyles from './App.module.css'
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
        <UpdatePrompt
          needRefresh={needRefresh}
          onRefresh={() => void updateServiceWorker(true)}
          onClose={() => setNeedRefresh(false)}
        />
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
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
