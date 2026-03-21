import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useLibrary } from './useLibrary'
import { recordsApi } from '../../lib/recordsApi'

vi.mock('../../lib/recordsApi')

const mockResponse = {
  records: [],
  meta: { current_page: 1, total_pages: 1, total_count: 0, per_page: 20 },
}

function wrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  }
}

describe('useLibrary', () => {
  beforeEach(() => {
    vi.mocked(recordsApi.getAll).mockResolvedValue(mockResponse)
  })

  it('初回アクセス（パラメータなし）で status=watching がデフォルト', async () => {
    renderHook(() => useLibrary(), { wrapper: wrapper(['/library']) })
    await waitFor(() => {
      expect(recordsApi.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'watching' }),
      )
    })
  })

  it('URLに status=completed がある場合はそれを使用', async () => {
    renderHook(() => useLibrary(), { wrapper: wrapper(['/library?status=completed']) })
    await waitFor(() => {
      expect(recordsApi.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      )
    })
  })

  it('status=all の場合はフィルタなしでAPIを呼ぶ', async () => {
    renderHook(() => useLibrary(), { wrapper: wrapper(['/library?status=all']) })
    await waitFor(() => {
      expect(recordsApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }))
    })
  })

  it('status=all のとき status は null を返す', () => {
    const { result } = renderHook(() => useLibrary(), {
      wrapper: wrapper(['/library?status=all']),
    })
    expect(result.current.status).toBeNull()
  })

  it('ページネーションパラメータを送信する', async () => {
    renderHook(() => useLibrary(), { wrapper: wrapper(['/library?status=watching']) })
    await waitFor(() => {
      expect(recordsApi.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, perPage: 20 }),
      )
    })
  })
})
