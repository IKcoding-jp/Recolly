import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute'
import { LoginPage } from './pages/LoginPage/LoginPage'
import { SignUpPage } from './pages/SignUpPage/SignUpPage'
import { DashboardPage } from './pages/DashboardPage/DashboardPage'
import { SearchPage } from './pages/SearchPage/SearchPage'
import { WorkDetailPage } from './pages/WorkDetailPage/WorkDetailPage'

// 認証済みならダッシュボードへ、未認証ならログインページへ
function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
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
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/works/:id"
            element={
              <ProtectedRoute>
                <WorkDetailPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
