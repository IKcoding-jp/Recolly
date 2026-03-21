import { render, screen } from '@testing-library/react'
import { Divider } from './Divider'

describe('Divider', () => {
  it('hr要素がレンダリングされる', () => {
    render(<Divider />)
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('デフォルトのCSSクラスが適用される', () => {
    render(<Divider />)
    const hr = screen.getByRole('separator')
    expect(hr.className).toContain('divider')
  })

  it('追加のclassNameが結合される', () => {
    render(<Divider className="extra" />)
    const hr = screen.getByRole('separator')
    expect(hr.className).toContain('extra')
  })
})
