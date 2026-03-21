import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgressControl } from './ProgressControl'

describe('ProgressControl', () => {
  it('現在の話数と総話数が表示される', () => {
    render(<ProgressControl current={5} total={24} onChange={() => {}} />)
    expect(screen.getByText('5 / 24話')).toBeInTheDocument()
  })

  it('総話数が null の場合は現在の話数のみ表示', () => {
    render(<ProgressControl current={3} total={null} onChange={() => {}} />)
    expect(screen.getByText('3話')).toBeInTheDocument()
  })

  it('+1 ボタンで onChange が current + 1 で呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<ProgressControl current={5} total={24} onChange={handleChange} />)
    await user.click(screen.getByRole('button', { name: '+1' }))
    expect(handleChange).toHaveBeenCalledWith(6)
  })

  it('-1 ボタンで onChange が current - 1 で呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<ProgressControl current={5} total={24} onChange={handleChange} showFullControls />)
    await user.click(screen.getByRole('button', { name: '-1' }))
    expect(handleChange).toHaveBeenCalledWith(4)
  })

  it('current が 0 のとき -1 ボタンは無効', () => {
    render(<ProgressControl current={0} total={24} onChange={() => {}} showFullControls />)
    expect(screen.getByRole('button', { name: '-1' })).toBeDisabled()
  })

  it('current が total のとき +1 ボタンは無効', () => {
    render(<ProgressControl current={24} total={24} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '+1' })).toBeDisabled()
  })

  it('showFullControls=false のとき -1 ボタンと数字入力は非表示', () => {
    render(<ProgressControl current={5} total={24} onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: '-1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('showFullControls=true のとき数字入力が表示される', () => {
    render(<ProgressControl current={5} total={24} onChange={() => {}} showFullControls />)
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('プログレスバーが正しい割合で表示される', () => {
    const { container } = render(<ProgressControl current={12} total={24} onChange={() => {}} />)
    const bar = container.querySelector('[class*="fill"]')
    expect(bar).toHaveStyle({ width: '50%' })
  })
})
