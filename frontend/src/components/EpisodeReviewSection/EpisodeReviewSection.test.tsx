import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EpisodeReviewSection } from './EpisodeReviewSection'

vi.mock('../../hooks/useEpisodeReviews', () => ({
  useEpisodeReviews: () => ({
    reviews: [
      {
        id: 1,
        record_id: 1,
        episode_number: 1,
        body: '1話の感想',
        visibility: 'private_record',
        created_at: '2026-03-25T00:00:00Z',
        updated_at: '2026-03-25T00:00:00Z',
      },
      {
        id: 2,
        record_id: 1,
        episode_number: 2,
        body: '2話の感想',
        visibility: 'private_record',
        created_at: '2026-03-25T00:00:00Z',
        updated_at: '2026-03-25T00:00:00Z',
      },
    ],
    isLoading: false,
    createReview: vi.fn(),
    updateReview: vi.fn(),
    deleteReview: vi.fn(),
  }),
}))

describe('EpisodeReviewSection', () => {
  it('話数感想一覧を表示する', () => {
    render(<EpisodeReviewSection recordId={1} currentEpisode={5} />)
    expect(screen.getByText('第1話')).toBeInTheDocument()
    expect(screen.getByText('第2話')).toBeInTheDocument()
  })

  it('感想入力フォームを表示する', () => {
    render(<EpisodeReviewSection recordId={1} currentEpisode={5} />)
    expect(screen.getByPlaceholderText('この話数の感想を書く...')).toBeInTheDocument()
  })

  it('感想の本文を表示する', () => {
    render(<EpisodeReviewSection recordId={1} currentEpisode={5} />)
    expect(screen.getByText('1話の感想')).toBeInTheDocument()
    expect(screen.getByText('2話の感想')).toBeInTheDocument()
  })

  it('デフォルトの話数が設定される', () => {
    render(<EpisodeReviewSection recordId={1} currentEpisode={5} />)
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.value).toBe('5')
  })
})
