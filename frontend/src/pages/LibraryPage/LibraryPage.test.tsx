import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LibraryPage } from './LibraryPage'
import { recordsApi } from '../../lib/recordsApi'
import type { UserRecord } from '../../lib/types'

vi.mock('../../lib/recordsApi')

vi.mock('../../lib/tagsApi', () => ({
  tagsApi: {
    getAll: vi.fn().mockResolvedValue({ tags: [] }),
  },
}))

const mockRecord: UserRecord = {
  id: 1,
  work_id: 10,
  status: 'watching',
  rating: 8,
  current_episode: 12,
  rewatch_count: 0,
  started_at: '2026-01-15',
  completed_at: null,
  created_at: '2026-01-15T10:00:00Z',
  work: {
    id: 10,
    title: '進撃の巨人',
    media_type: 'anime',
    description: null,
    cover_image_url: null,
    total_episodes: 24,
    external_api_id: null,
    external_api_source: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
}

function renderPage(initialEntries = ['/library?status=watching']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LibraryPage />
    </MemoryRouter>,
  )
}

describe('LibraryPage', () => {
  beforeEach(() => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({
      records: [mockRecord],
      meta: { current_page: 1, total_pages: 1, total_count: 1, per_page: 20 },
    })
  })

  it('記録一覧が表示される', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })
  })

  it('マイライブラリのタイトルが表示される', () => {
    renderPage()
    expect(screen.getByText('マイライブラリ')).toBeInTheDocument()
  })

  it('デフォルトで status=watching でAPIを呼ぶ', async () => {
    renderPage()
    await waitFor(() => {
      expect(recordsApi.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'watching' }),
      )
    })
  })

  it('記録0件でフィルタ中のメッセージが表示される', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({
      records: [],
      meta: { current_page: 1, total_pages: 0, total_count: 0, per_page: 20 },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('条件に一致する記録がありません')).toBeInTheDocument()
    })
  })

  it('ステータスドロップダウンが表示される', () => {
    renderPage()
    const statusSelect = screen.getByLabelText('ステータス')
    expect(statusSelect).toBeInTheDocument()
    expect(statusSelect.tagName).toBe('SELECT')
  })

  it('ジャンルドロップダウンが表示される', () => {
    renderPage()
    const mediaTypeSelect = screen.getByLabelText('ジャンル')
    expect(mediaTypeSelect).toBeInTheDocument()
    expect(mediaTypeSelect.tagName).toBe('SELECT')
  })

  it('並び替えドロップダウンが表示される', () => {
    renderPage()
    const sortSelect = screen.getByLabelText('並び替え')
    expect(sortSelect).toBeInTheDocument()
    expect(sortSelect.tagName).toBe('SELECT')
  })

  it('ステータス変更でAPIが再呼び出しされる', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })
    const statusSelect = screen.getByLabelText('ステータス')
    await user.selectOptions(statusSelect, 'completed')
    await waitFor(() => {
      expect(recordsApi.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      )
    })
  })
})
