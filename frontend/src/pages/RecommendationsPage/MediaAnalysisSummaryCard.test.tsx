import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { MediaPreferenceProfileReady } from '../../types/mediaPreferenceProfile'
import { MediaAnalysisSummaryCard } from './MediaAnalysisSummaryCard'

const mockProfile: MediaPreferenceProfileReady = {
  media_type: 'anime',
  status: 'ready',
  analysis_summary: 'アニメの好み傾向テキスト',
  same_media_works: [],
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

  it('AI分析バッジを表示する', () => {
    render(<MediaAnalysisSummaryCard profile={mockProfile} />)
    expect(screen.getByText('AI分析')).toBeInTheDocument()
  })
})
