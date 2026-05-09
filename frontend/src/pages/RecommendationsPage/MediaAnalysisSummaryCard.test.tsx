import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { MediaAnalysisSummaryCard } from './MediaAnalysisSummaryCard'

const mockProfile = {
  media_type: 'anime',
  status: 'ready' as const,
  analysis_summary: 'アニメの好み傾向テキスト',
  preference_scores: [
    { label: '感情的な深さ', score: 9.1 },
    { label: '伏線・構成力', score: 8.7 },
  ],
  top_tags: [{ name: '泣ける', count: 5 }],
  same_media_works: [],
  cross_media_works: [],
  record_count: 24,
  analyzed_at: '2026-05-09T10:00:00+09:00',
}

describe('MediaAnalysisSummaryCard', () => {
  it('分析テキストを表示する', () => {
    render(<MediaAnalysisSummaryCard profile={mockProfile} />)
    expect(screen.getByText('アニメの好み傾向テキスト')).toBeInTheDocument()
  })

  it('セクションタイトルにメディア名が含まれる', () => {
    render(<MediaAnalysisSummaryCard profile={mockProfile} />)
    expect(screen.getByText('アニメでの好み傾向')).toBeInTheDocument()
  })

  it('詳細展開ボタンをクリックするとスコアバーが表示される', async () => {
    const user = userEvent.setup()
    render(<MediaAnalysisSummaryCard profile={mockProfile} />)

    expect(screen.queryByText('感情的な深さ')).not.toBeInTheDocument()
    await user.click(screen.getByText('好み分析の詳細を見る'))
    expect(screen.getByText('感情的な深さ')).toBeInTheDocument()
  })

  it('AI分析バッジを表示する', () => {
    render(<MediaAnalysisSummaryCard profile={mockProfile} />)
    expect(screen.getByText('AI分析')).toBeInTheDocument()
  })
})
