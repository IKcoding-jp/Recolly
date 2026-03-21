import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute'
import { NavBar } from './components/ui/NavBar/NavBar'
import { LoginPage } from './pages/LoginPage/LoginPage'
import { SignUpPage } from './pages/SignUpPage/SignUpPage'
import { DashboardPage } from './pages/DashboardPage/DashboardPage'
import { SearchPage } from './pages/SearchPage/SearchPage'
import { WorkDetailPage } from './pages/WorkDetailPage/WorkDetailPage'
import { LibraryPage } from './pages/LibraryPage/LibraryPage'

// 認証済みならダッシュボードへ、未認証ならログインページへ
function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
}

// 認証済みページ共通レイアウト（NavBar + コンテンツ）
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <>
      <NavBar user={user} onLogout={() => void logout()} />
      {children}
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AuthenticatedLayout>
                  <DashboardPage />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />
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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
