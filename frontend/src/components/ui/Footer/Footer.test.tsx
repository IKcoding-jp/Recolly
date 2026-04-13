import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Footer } from './Footer'

describe('Footer', () => {
  it('プライバシーポリシーへのリンクを含む', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /プライバシーポリシー/ })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/privacy')
  })

  it('Recolly のブランド表記を含む', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Recolly/)).toBeInTheDocument()
  })

  it('contentinfo ロールとして認識される (アクセシビリティ)', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })
})
