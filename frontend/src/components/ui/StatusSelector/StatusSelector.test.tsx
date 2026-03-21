import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusSelector } from './StatusSelector'

describe('StatusSelector', () => {
  it('全ステータスが日本語ラベルで表示される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '視聴中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴完了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '中断' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '一時停止' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴予定' })).toBeInTheDocument()
  })

  it('現在の値がアクティブ表示される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} />)
    const button = screen.getByRole('button', { name: '視聴中' })
    expect(button.className).toContain('active')
  })

  it('ボタンクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<StatusSelector value="watching" onChange={handleChange} />)
    await user.click(screen.getByRole('button', { name: '視聴完了' }))
    expect(handleChange).toHaveBeenCalledWith('completed')
  })
})
