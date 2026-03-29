import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { SearchProgress } from './SearchProgress'

describe('SearchProgress', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初期表示で「作品を検索しています...」が表示される', () => {
    render(<SearchProgress />)
    expect(screen.getByText('作品を検索しています...')).toBeInTheDocument()
  })

  it('1秒後に「詳細情報を取得しています...」に切り替わる', () => {
    vi.useFakeTimers()
    render(<SearchProgress />)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText('詳細情報を取得しています...')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('2.5秒後に「結果をまとめています...」に切り替わる', () => {
    vi.useFakeTimers()
    render(<SearchProgress />)

    act(() => {
      vi.advanceTimersByTime(2500)
    })

    expect(screen.getByText('結果をまとめています...')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('プログレスバーがレンダリングされる', () => {
    render(<SearchProgress />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
