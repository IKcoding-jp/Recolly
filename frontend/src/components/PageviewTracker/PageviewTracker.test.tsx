import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/analytics/posthog', () => ({
  capturePageview: vi.fn(),
}))

import { capturePageview } from '../../lib/analytics/posthog'
import { PageviewTracker } from './PageviewTracker'

// ナビゲーション確認用の補助コンポーネント
function TestNavigator({ to }: { to: string }) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(to)}>
      go
    </button>
  )
}

describe('PageviewTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('初回マウント時に現在のパスで capturePageview を呼ぶ', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <PageviewTracker />
      </MemoryRouter>,
    )
    expect(capturePageview).toHaveBeenCalledWith('/dashboard')
  })

  it('location 変化で新しいパスを渡して capturePageview を再度呼ぶ', async () => {
    const user = userEvent.setup()
    const { getByText } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <PageviewTracker />
        <Routes>
          <Route path="/dashboard" element={<TestNavigator to="/library" />} />
          <Route path="/library" element={<div>library</div>} />
        </Routes>
      </MemoryRouter>,
    )

    vi.mocked(capturePageview).mockClear()
    await user.click(getByText('go'))

    await waitFor(() => {
      expect(capturePageview).toHaveBeenCalledWith('/library')
    })
  })

  it('search パラメータも pathname に結合して送る', () => {
    render(
      <MemoryRouter initialEntries={['/search?q=hunter']}>
        <PageviewTracker />
      </MemoryRouter>,
    )
    expect(capturePageview).toHaveBeenCalledWith('/search?q=hunter')
  })
})
