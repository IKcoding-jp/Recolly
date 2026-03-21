import { render } from '@testing-library/react'
import { Divider } from './Divider'

describe('Divider', () => {
  it('hr要素がレンダリングされる', () => {
    const { container } = render(<Divider />)
    const hr = container.querySelector('hr')
    expect(hr).toBeInTheDocument()
  })

  it('デフォルトのCSSクラスが適用される', () => {
    const { container } = render(<Divider />)
    const hr = container.querySelector('hr')
    expect(hr?.className).toContain('divider')
  })

  it('追加のclassNameが結合される', () => {
    const { container } = render(<Divider className="extra" />)
    const hr = container.querySelector('hr')
    expect(hr?.className).toContain('extra')
  })
})
