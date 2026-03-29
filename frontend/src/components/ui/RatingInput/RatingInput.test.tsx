import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RatingInput } from './RatingInput'

describe('RatingInput', () => {
  it('1〜10のボタンが表示される', () => {
    render(<RatingInput value={null} onChange={() => {}} />)
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument()
    }
  })

  it('選択中の値がハイライトされる', () => {
    render(<RatingInput value={7} onChange={() => {}} />)
    const button = screen.getByRole('button', { name: '7' })
    expect(button.className).toContain('active')
  })

  it('ボタンクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<RatingInput value={null} onChange={handleChange} />)
    await user.click(screen.getByRole('button', { name: '8' }))
    expect(handleChange).toHaveBeenCalledWith(8)
  })

  it('同じ値をクリックすると null で onChange が呼ばれる（評価解除）', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<RatingInput value={7} onChange={handleChange} />)
    await user.click(screen.getByRole('button', { name: '7' }))
    expect(handleChange).toHaveBeenCalledWith(null)
  })

  it('値が設定されている場合、該当ボタンまでがアクティブになる', () => {
    render(<RatingInput value={7} onChange={() => {}} />)
    const button7 = screen.getByRole('button', { name: '7' })
    expect(button7.className).toContain('active')
  })
})
