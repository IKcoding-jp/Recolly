import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { LandingPage } from './LandingPage'

// IntersectionObserver のスタブ（JSDOM には存在しない）
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(function (this: IntersectionObserver) {
      this.observe = vi.fn()
      this.unobserve = vi.fn()
      this.disconnect = vi.fn()
      this.takeRecords = vi.fn()
      this.root = null
      this.rootMargin = ''
      this.thresholds = []
      return this
    }),
  )
})

describe('LandingPage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )
  }

  it('ヒーロー見出しが表示される', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/観たもの、読んだもの/)
  })

  it('全セクションのラベル番号が表示される (01-07)', () => {
    renderPage()
    // 01-04 は section label と feature num の両方で使われるので少なくとも 1 個あることだけ確認
    // 05-07 は section label のみ
    expect(screen.getAllByText('01').length).toBeGreaterThan(0)
    expect(screen.getAllByText('02').length).toBeGreaterThan(0)
    expect(screen.getAllByText('03').length).toBeGreaterThan(0)
    expect(screen.getAllByText('04').length).toBeGreaterThan(0)
    expect(screen.getAllByText('05').length).toBeGreaterThan(0)
    expect(screen.getAllByText('06').length).toBeGreaterThan(0)
    expect(screen.getAllByText('07').length).toBeGreaterThan(0)
  })

  it('ヒーロー CTA と最終 CTA から /signup にリンクしている', () => {
    renderPage()
    const signupLinks = screen.getAllByRole('link', { name: /無料で始める/ })
    // ナビ + ヒーロー + 最終 CTA の少なくとも 3 個
    expect(signupLinks.length).toBeGreaterThanOrEqual(3)
    signupLinks.forEach((link) => expect(link).toHaveAttribute('href', '/signup'))
  })

  it('ナビに /login へのリンクがある', () => {
    renderPage()
    const loginLinks = screen.getAllByRole('link', { name: /ログイン/ })
    expect(loginLinks.some((link) => link.getAttribute('href') === '/login')).toBe(true)
  })

  it('Footer (contentinfo) が表示され、プライバシーポリシーへのリンクを含む', () => {
    renderPage()
    const footer = screen.getByRole('contentinfo')
    expect(footer).toBeInTheDocument()
    const privacyLink = screen.getByRole('link', { name: /プライバシーポリシー/ })
    expect(privacyLink).toHaveAttribute('href', '/privacy')
  })

  it('Netflix / Kindle / Steam に言及している (ProblemSection と CreatorNoteSection)', () => {
    renderPage()
    // Problem と Creator の両方で言及するため複数マッチする
    const matches = screen.getAllByText(
      (content) =>
        content.includes('Netflix') && content.includes('Kindle') && content.includes('Steam'),
    )
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('永久無料の宣言を含む', () => {
    renderPage()
    expect(
      screen.getByRole('heading', {
        name: /基本機能は、これから先も無料で使えます/,
      }),
    ).toBeInTheDocument()
  })
})
