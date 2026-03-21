import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordDeleteDialog } from './RecordDeleteDialog'

describe('RecordDeleteDialog', () => {
  const defaultProps = {
    isOpen: true,
    workTitle: '進撃の巨人',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isLoading: false,
  }

  it('確認メッセージが表示される', () => {
    render(<RecordDeleteDialog {...defaultProps} />)
    expect(screen.getByText(/進撃の巨人/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '記録を削除' })).toBeInTheDocument()
  })

  it('削除ボタンでonConfirmが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleConfirm = vi.fn()
    render(<RecordDeleteDialog {...defaultProps} onConfirm={handleConfirm} />)
    await user.click(screen.getByRole('button', { name: '削除する' }))
    expect(handleConfirm).toHaveBeenCalled()
  })

  it('キャンセルボタンでonCancelが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleCancel = vi.fn()
    render(<RecordDeleteDialog {...defaultProps} onCancel={handleCancel} />)
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(handleCancel).toHaveBeenCalled()
  })

  it('isOpen=false のとき何も表示しない', () => {
    const { container } = render(<RecordDeleteDialog {...defaultProps} isOpen={false} />)
    expect(container.innerHTML).toBe('')
  })
})
