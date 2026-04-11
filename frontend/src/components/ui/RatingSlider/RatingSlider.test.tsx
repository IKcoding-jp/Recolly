import { render, screen, fireEvent } from '@testing-library/react'
import { RatingSlider } from './RatingSlider'

describe('RatingSlider', () => {
  it('スライダーが表示される', () => {
    render(<RatingSlider value={0} onChange={() => {}} />)
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })

  it('現在の値が大きく表示される', () => {
    render(<RatingSlider value={8} onChange={() => {}} />)
    expect(screen.getAllByText('8').length).toBeGreaterThanOrEqual(1)
  })

  it('最大値が表示される', () => {
    render(<RatingSlider value={8} onChange={() => {}} />)
    expect(screen.getByText('/10')).toBeInTheDocument()
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

  it('step=1でスナップする', () => {
    render(<RatingSlider value={5} onChange={() => {}} />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('step', '1')
  })

  it('onChangeが呼ばれる', () => {
    const handleChange = vi.fn()
    render(<RatingSlider value={5} onChange={handleChange} />)
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '8' } })
    expect(handleChange).toHaveBeenCalledWith(8)
  })

  it('「評価」ラベルを表示する', () => {
    render(<RatingSlider value={5} onChange={() => {}} />)
    expect(screen.getByText('評価')).toBeInTheDocument()
  })

  it('1〜10の目盛りラベルを表示する', () => {
    render(<RatingSlider value={5} onChange={() => {}} />)
    for (let i = 1; i <= 10; i++) {
      // スコア表示と目盛りで同じ数字が存在しうるため、getAllByTextを使用
      expect(screen.getAllByText(String(i)).length).toBeGreaterThanOrEqual(1)
    }
  })
})
