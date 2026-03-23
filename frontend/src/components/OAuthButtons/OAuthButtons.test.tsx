import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OAuthButtons } from './OAuthButtons'

vi.mock('../../lib/api', () => ({
  csrfApi: {
    getToken: vi.fn().mockResolvedValue({ token: 'test-csrf-token' }),
  },
}))

describe('OAuthButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Google OAuthボタンを表示する', async () => {
    render(<OAuthButtons />)
    await waitFor(() => {
      expect(screen.getByText('Googleでログイン')).toBeInTheDocument()
    })
  })

  it('区切り線「または」を表示する', async () => {
    render(<OAuthButtons />)
    await waitFor(() => {
      expect(screen.getByText('または')).toBeInTheDocument()
    })
  })
})
