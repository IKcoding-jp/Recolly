import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusSelector } from './StatusSelector'

describe('StatusSelector', () => {
  it('mediaType 未指定時は汎用ラベルで表示される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '進行中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '完了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '一時停止' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '中断' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '予定' })).toBeInTheDocument()
  })

  it('anime 指定時は映像系ラベルで表示される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} mediaType="anime" />)
    expect(screen.getByRole('button', { name: '視聴中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴完了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴予定' })).toBeInTheDocument()
  })

  it('book 指定時は読み物系ラベルで表示される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} mediaType="book" />)
    expect(screen.getByRole('button', { name: '読書中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '読了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '読書予定' })).toBeInTheDocument()
  })

  it('game 指定時はゲーム用ラベルで表示される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} mediaType="game" />)
    expect(screen.getByRole('button', { name: 'プレイ中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'プレイ完了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'プレイ予定' })).toBeInTheDocument()
  })

  it('現在の値がアクティブ表示される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} mediaType="anime" />)
    const button = screen.getByRole('button', { name: '視聴中' })
    expect(button.className).toContain('active')
  })

  it('ボタンクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<StatusSelector value="watching" onChange={handleChange} mediaType="anime" />)
    await user.click(screen.getByRole('button', { name: '視聴完了' }))
    expect(handleChange).toHaveBeenCalledWith('completed')
  })
})
