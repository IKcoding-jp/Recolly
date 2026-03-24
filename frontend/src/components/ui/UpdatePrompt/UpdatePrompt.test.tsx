import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdatePrompt } from './UpdatePrompt'

describe('UpdatePrompt', () => {
  it('needRefreshがtrueのとき更新通知を表示する', () => {
    render(<UpdatePrompt needRefresh={true} onRefresh={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('新しいバージョンがあります')).toBeInTheDocument()
    expect(screen.getByText('更新する')).toBeInTheDocument()
  })

  it('needRefreshがfalseのとき何も表示しない', () => {
    const { container } = render(
      <UpdatePrompt needRefresh={false} onRefresh={vi.fn()} onClose={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('更新するボタンをクリックするとonRefreshが呼ばれる', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    render(<UpdatePrompt needRefresh={true} onRefresh={onRefresh} onClose={vi.fn()} />)
    await user.click(screen.getByText('更新する'))
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('閉じるボタンをクリックするとonCloseが呼ばれる', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<UpdatePrompt needRefresh={true} onRefresh={vi.fn()} onClose={onClose} />)
    await user.click(screen.getByLabelText('閉じる'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
