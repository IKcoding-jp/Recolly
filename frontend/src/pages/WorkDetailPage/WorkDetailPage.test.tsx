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

vi.mock('../../lib/episodeReviewsApi', () => ({
  episodeReviewsApi: {
    getAll: vi.fn().mockResolvedValue({ episode_reviews: [] }),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('../../lib/tagsApi', () => ({
  tagsApi: {
    getAll: vi.fn().mockResolvedValue({ tags: [] }),
    addToRecord: vi.fn(),
    removeFromRecord: vi.fn(),
    deleteTag: vi.fn(),
  },
}))

import { recordsApi } from '../../lib/recordsApi'

const mockRecord = {
  id: 1,
  status: 'watching' as const,
  rating: 7,
  current_episode: 32,
  rewatch_count: 0,
  review_text: null as string | null,
  visibility: 'private_record' as const,
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

  it('評価ボタンがアクティブ状態で表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      const button7 = screen.getByRole('button', { name: '7' })
      expect(button7.className).toContain('active')
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

  it('再視聴回数が表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('0回')).toBeInTheDocument()
    })
  })

  it('感想セクションが表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByPlaceholderText('作品の感想を書く...')).toBeInTheDocument()
    })
  })

  it('アニメの場合は話数ごとの感想セクションが表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByPlaceholderText('この話の感想を書く...')).toBeInTheDocument()
    })
  })

  it('映画の場合は話数ごとの感想セクションが非表示', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({
      records: [{ ...mockRecord, work: { ...mockRecord.work, media_type: 'movie' as const } }],
    })
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })
    expect(screen.queryByPlaceholderText('この話の感想を書く...')).not.toBeInTheDocument()
  })

  it('アニメの場合は進捗セクションが表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('進捗')).toBeInTheDocument()
    })
  })

  it('映画の場合は進捗セクションが非表示', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({
      records: [
        {
          ...mockRecord,
          work: { ...mockRecord.work, media_type: 'movie' as const, total_episodes: null },
        },
      ],
    })
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })
    expect(screen.queryByText('進捗')).not.toBeInTheDocument()
  })

  it('ゲームの場合は進捗セクションが非表示', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({
      records: [
        {
          ...mockRecord,
          work: { ...mockRecord.work, media_type: 'game' as const, total_episodes: null },
        },
      ],
    })
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })
    expect(screen.queryByText('進捗')).not.toBeInTheDocument()
  })

  it('アニメの場合は「再視聴回数」ラベルが表示される', async () => {
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('再視聴回数')).toBeInTheDocument()
    })
  })

  it('ゲームの場合は「リプレイ回数」ラベルが表示される', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({
      records: [
        {
          ...mockRecord,
          work: { ...mockRecord.work, media_type: 'game' as const, total_episodes: null },
        },
      ],
    })
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('リプレイ回数')).toBeInTheDocument()
    })
  })

  it('本の場合は「再読回数」ラベルが表示される', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({
      records: [
        {
          ...mockRecord,
          work: { ...mockRecord.work, media_type: 'book' as const, total_episodes: null },
        },
      ],
    })
    renderWithRouter('1')
    await waitFor(() => {
      expect(screen.getByText('再読回数')).toBeInTheDocument()
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
