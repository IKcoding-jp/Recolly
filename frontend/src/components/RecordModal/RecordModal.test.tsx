import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordModal } from './RecordModal'

describe('RecordModal', () => {
  const defaultProps = {
    isOpen: true,
    title: '進撃の巨人',
    mediaType: 'anime' as const,
    mediaTypeLabel: 'アニメ',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isLoading: false,
  }

  it('作品タイトルが表示される', () => {
    render(<RecordModal {...defaultProps} />)
    expect(screen.getByText('進撃の巨人を記録')).toBeInTheDocument()
  })

  it('メディアタイプラベルが表示される', () => {
    render(<RecordModal {...defaultProps} />)
    expect(screen.getByText('アニメ')).toBeInTheDocument()
  })

  it('anime 指定時は映像系ステータスラベルが表示される', () => {
    render(<RecordModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: '視聴中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴完了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴予定' })).toBeInTheDocument()
  })

  it('book 指定時は読み物系ステータスラベルが表示される', () => {
    render(<RecordModal {...defaultProps} mediaType="book" mediaTypeLabel="本" />)
    expect(screen.getByRole('button', { name: '読書中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '読了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '読書予定' })).toBeInTheDocument()
  })

  it('評価入力が表示される', () => {
    render(<RecordModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
  })

  it('記録するボタンでonConfirmが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleConfirm = vi.fn()
    render(<RecordModal {...defaultProps} onConfirm={handleConfirm} />)
    await user.click(screen.getByRole('button', { name: '記録する' }))
    expect(handleConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'plan_to_watch', rating: null }),
    )
  })

  it('キャンセルボタンでonCancelが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleCancel = vi.fn()
    render(<RecordModal {...defaultProps} onCancel={handleCancel} />)
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(handleCancel).toHaveBeenCalled()
  })

  it('isOpen=false のとき何も表示しない', () => {
    const { container } = render(<RecordModal {...defaultProps} isOpen={false} />)
    expect(container.innerHTML).toBe('')
  })
})
