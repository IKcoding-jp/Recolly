import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { ProtectedRoute } from './ProtectedRoute'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('ProtectedRoute', () => {
  it('ロード中は読み込み中テキストを表示する', () => {
    // fetchを未解決のまま保留してisLoading状態を維持
    mockFetch.mockReturnValueOnce(new Promise(() => {}))

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>保護されたコンテンツ</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    expect(screen.queryByText('保護されたコンテンツ')).not.toBeInTheDocument()
  })

  it('認証済みユーザーはページを表示できる', async () => {
    // セッション確認: 認証済み
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: { id: 1, username: 'test', email: 'test@example.com' } }),
    })

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>保護されたコンテンツ</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>ログインページ</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('保護されたコンテンツ')).toBeInTheDocument()
  })

  it('未認証ユーザーはログインページにリダイレクトされる', async () => {
    // セッション確認: 未認証
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'ログインが必要です' }),
    })

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>保護されたコンテンツ</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>ログインページ</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('ログインページ')).toBeInTheDocument()
    })
    expect(screen.queryByText('保護されたコンテンツ')).not.toBeInTheDocument()
  })
})
