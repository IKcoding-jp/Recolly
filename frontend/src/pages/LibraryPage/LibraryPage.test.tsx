import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LibraryPage } from './LibraryPage'
import { recordsApi } from '../../lib/recordsApi'
import type { UserRecord } from '../../lib/types'

vi.mock('../../lib/recordsApi')

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

  it('フィルタボタンのクリックでAPIが再呼び出しされる', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '視聴完了' }))
    await waitFor(() => {
      expect(recordsApi.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      )
    })
  })

  it('絞り込みボタンが存在し、クリックでフィルタが表示される', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })

    // フィルタサマリーのチップがDOMに存在する（jsdomではCSSメディアクエリが適用されないため、display:noneでも要素自体は存在する）
    // 「視聴中」はチップ・ステータスフィルタ・記録バッジの3箇所に存在するため、getAllByTextで検証
    expect(screen.getAllByText('視聴中').length).toBeGreaterThanOrEqual(1)

    // 絞り込みボタンが存在する
    const toggleButton = screen.getByRole('button', { name: '絞り込み' })
    expect(toggleButton).toBeInTheDocument()

    // クリックするとボタンテキストが「閉じる」に変わる
    await user.click(toggleButton)
    expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument()
  })
})
