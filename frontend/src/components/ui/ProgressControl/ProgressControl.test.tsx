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

  it('漫画の場合は「巻」を表示する', () => {
    render(<ProgressControl current={5} total={20} onChange={() => {}} mediaType="manga" />)
    expect(screen.getByText('5 / 20巻')).toBeInTheDocument()
  })

  it('漫画でtotalがnullの場合は「5巻」を表示する', () => {
    render(<ProgressControl current={5} total={null} onChange={() => {}} mediaType="manga" />)
    expect(screen.getByText('5巻')).toBeInTheDocument()
  })

  it('mediaType未指定の場合はデフォルトで「話」を表示する', () => {
    render(<ProgressControl current={5} total={24} onChange={() => {}} />)
    expect(screen.getByText('5 / 24話')).toBeInTheDocument()
  })

  describe('連載中バッジ', () => {
    it('isOngoing が true のとき「連載中」バッジを表示する', () => {
      render(
        <ProgressControl
          current={110}
          total={110}
          onChange={() => {}}
          mediaType="manga"
          isOngoing
        />,
      )
      expect(screen.getByText('連載中')).toBeInTheDocument()
    })

    it('isOngoing が false のとき「連載中」バッジを表示しない', () => {
      render(<ProgressControl current={72} total={72} onChange={() => {}} mediaType="manga" />)
      expect(screen.queryByText('連載中')).not.toBeInTheDocument()
    })
  })
})
