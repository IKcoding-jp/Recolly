import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { WorkDetailPage } from './WorkDetailPage'

vi.mock('../../lib/recordsApi', () => ({
  recordsApi: {
    getAll: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

import { recordsApi } from '../../lib/recordsApi'

const mockRecord = {
  id: 1,
  status: 'watching' as const,
  rating: 7,
  current_episode: 32,
  rewatch_count: 0,
  started_at: '2026-01-15',
  completed_at: null,
  created_at: '2026-01-15T10:00:00Z',
  work_id: 1,
  work: {
    id: 1,
    title: '進撃の巨人',
    media_type: 'anime' as const,
    cover_image_url: null,
    total_episodes: 75,
    description: 'テストの説明文',
    external_api_id: null,
    external_api_source: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
}

const renderWithRouter = (workId: string) => {
  return render(
    <MemoryRouter initialEntries={[`/works/${workId}`]}>
      <Routes>
        <Route path="/works/:id" element={<WorkDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('WorkDetailPage', () => {
  beforeEach(() => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: [mockRecord] })
    vi.mocked(recordsApi.update).mockResolvedValue({ record: mockRecord })
  })

  it('作品タイトルが表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })
  })

  it('ステータスセレクターが表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '視聴中' })).toBeInTheDocument()
    })
  })

  it('評価が表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('7 / 10')).toBeInTheDocument()
    })
  })

  it('進捗が表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('32 / 75話')).toBeInTheDocument()
    })
  })

  it('あらすじが表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('テストの説明文')).toBeInTheDocument()
    })
  })

  it('記録が見つからない場合にメッセージを表示', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: [] })
    renderWithRouter('999')
    await waitFor(() => {
      expect(screen.getByText(/記録が見つかりません/)).toBeInTheDocument()
    })
  })
})
