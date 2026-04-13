import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PrivacyPage } from './PrivacyPage'

describe('PrivacyPage', () => {
  it('タイトルが表示される', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /プライバシーポリシー/ })).toBeInTheDocument()
  })

  it('PostHog を使用していることを明記している', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )
    expect(screen.getAllByText(/PostHog/).length).toBeGreaterThan(0)
  })

  it('PII を送信しない方針を明記している (パスワード or 感想本文)', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )
    // 送信しない情報リストに PII が含まれているか
    expect(screen.getByText(/パスワード/)).toBeInTheDocument()
    expect(screen.getByText(/感想本文/)).toBeInTheDocument()
  })

  it('オプトアウト方法について言及している', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )
    expect(screen.getAllByText(/オプトアウト|計測を拒否|拒否したい/).length).toBeGreaterThan(0)
  })
})
