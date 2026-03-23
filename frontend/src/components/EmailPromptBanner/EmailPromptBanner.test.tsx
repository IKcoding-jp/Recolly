import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { EmailPromptBanner } from './EmailPromptBanner'

describe('EmailPromptBanner', () => {
  it('メールアドレス設定を促すバナーを表示する', () => {
    render(
      <MemoryRouter>
        <EmailPromptBanner />
      </MemoryRouter>,
    )

    expect(
      screen.getByText(
        'メールアドレスを設定すると、パスワードリセットなどの機能が使えるようになります。',
      ),
    ).toBeInTheDocument()
  })

  it('メールアドレス設定ページへのリンクを表示する', () => {
    render(
      <MemoryRouter>
        <EmailPromptBanner />
      </MemoryRouter>,
    )

    const link = screen.getByText('メールアドレスを設定する')
    expect(link).toHaveAttribute('href', '/auth/email-setup')
  })
})
