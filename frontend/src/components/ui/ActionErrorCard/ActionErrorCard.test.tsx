import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ActionErrorCard } from './ActionErrorCard'

describe('ActionErrorCard', () => {
  it('タイトルとメッセージが表示される', () => {
    render(<ActionErrorCard title="エラータイトル" message="エラーの説明文" />)

    expect(screen.getByText('エラータイトル')).toBeInTheDocument()
    expect(screen.getByText('エラーの説明文')).toBeInTheDocument()
  })

  it('actionLabelを渡すとボタンが表示される', () => {
    render(
      <ActionErrorCard
        title="タイトル"
        message="メッセージ"
        actionLabel="アクションボタン"
        onAction={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'アクションボタン' })).toBeInTheDocument()
  })

  it('actionLabelを渡さないとボタンが表示されない', () => {
    render(<ActionErrorCard title="タイトル" message="メッセージ" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('ボタンクリックでonActionが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleAction = vi.fn()

    render(
      <ActionErrorCard
        title="タイトル"
        message="メッセージ"
        actionLabel="クリック"
        onAction={handleAction}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'クリック' }))
    expect(handleAction).toHaveBeenCalledTimes(1)
  })
})
