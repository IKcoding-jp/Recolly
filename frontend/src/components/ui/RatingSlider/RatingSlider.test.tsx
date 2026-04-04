import { render, screen, fireEvent } from '@testing-library/react'
import { RatingSlider } from './RatingSlider'

describe('RatingSlider', () => {
  it('スライダーが表示される', () => {
    render(<RatingSlider value={0} onChange={() => {}} />)
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })

  it('現在の値が大きく表示される', () => {
    render(<RatingSlider value={8} onChange={() => {}} />)
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('最大値が表示される', () => {
    render(<RatingSlider value={8} onChange={() => {}} />)
    expect(screen.getByText('/ 10')).toBeInTheDocument()
  })

  it('未評価時（value=0）にハイフンが表示される', () => {
    render(<RatingSlider value={0} onChange={() => {}} />)
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('スライダーのmin/max属性が正しい', () => {
    render(<RatingSlider value={5} onChange={() => {}} />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '10')
  })

  it('onChangeが呼ばれる', () => {
    const handleChange = vi.fn()
    render(<RatingSlider value={5} onChange={handleChange} />)
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '8' } })
    expect(handleChange).toHaveBeenCalledWith(8)
  })
})
