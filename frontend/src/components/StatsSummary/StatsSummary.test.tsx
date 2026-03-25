import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatsSummary } from './StatsSummary'
import type { Statistics } from '../../lib/types'

const mockStats: Statistics = {
  by_genre: { anime: 10, movie: 5, drama: 0, book: 3, manga: 7, game: 2 },
  by_status: { watching: 5, completed: 15, on_hold: 1, dropped: 2, plan_to_watch: 4 },
  monthly_completions: [
    { month: '2025-10', count: 1 },
    { month: '2025-11', count: 2 },
    { month: '2025-12', count: 3 },
    { month: '2026-01', count: 6 },
    { month: '2026-02', count: 4 },
    { month: '2026-03', count: 5 },
  ],
  totals: { episodes_watched: 120, volumes_read: 45 },
}

describe('StatsSummary', () => {
  it('総記録数を表示する', () => {
    render(<StatsSummary statistics={mockStats} />)
    expect(screen.getByText('27')).toBeInTheDocument()
  })

  it('総視聴話数を表示する', () => {
    render(<StatsSummary statistics={mockStats} />)
    expect(screen.getByText('120')).toBeInTheDocument()
  })

  it('総読了巻数を表示する', () => {
    render(<StatsSummary statistics={mockStats} />)
    expect(screen.getByText('45')).toBeInTheDocument()
  })

  it('今月完了数を表示する', () => {
    render(<StatsSummary statistics={mockStats} />)
    expect(screen.getByText('今月完了')).toBeInTheDocument()
  })

  it('ジャンル名を表示する', () => {
    render(<StatsSummary statistics={mockStats} />)
    expect(screen.getByText('アニメ')).toBeInTheDocument()
    expect(screen.getByText('映画')).toBeInTheDocument()
    expect(screen.getByText('漫画')).toBeInTheDocument()
  })

  it('ステータス名を表示する', () => {
    render(<StatsSummary statistics={mockStats} />)
    expect(screen.getByText('完了')).toBeInTheDocument()
    expect(screen.getByText('視聴中')).toBeInTheDocument()
    expect(screen.getByText('予定')).toBeInTheDocument()
  })

  it('月別完了チャートの月ラベルを表示する', () => {
    render(<StatsSummary statistics={mockStats} />)
    expect(screen.getByText('3月')).toBeInTheDocument()
    expect(screen.getByText('10月')).toBeInTheDocument()
  })

  it('月別完了データがない場合はチャートを表示しない', () => {
    const emptyStats: Statistics = {
      ...mockStats,
      monthly_completions: [],
    }
    render(<StatsSummary statistics={emptyStats} />)
    expect(screen.queryByText('月別完了数')).not.toBeInTheDocument()
  })
})
