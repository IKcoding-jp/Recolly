import { render, screen } from '@testing-library/react'
import { SectionTitle } from './SectionTitle'

describe('SectionTitle', () => {
  it('childrenが表示される', () => {
    render(<SectionTitle>セクション</SectionTitle>)
    expect(screen.getByText('セクション')).toBeInTheDocument()
  })

  it('h2タグでレンダリングされる', () => {
    render(<SectionTitle>セクション</SectionTitle>)
    const el = screen.getByText('セクション')
    expect(el.tagName).toBe('H2')
  })

  it('デフォルトのCSSクラスが適用される', () => {
    render(<SectionTitle>セクション</SectionTitle>)
    const el = screen.getByText('セクション')
    expect(el.className).toContain('sectionTitle')
  })

  it('追加のclassNameが結合される', () => {
    render(<SectionTitle className="extra">セクション</SectionTitle>)
    const el = screen.getByText('セクション')
    expect(el.className).toContain('extra')
  })
})
