import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusFilter } from './StatusFilter'

describe('StatusFilter', () => {
  it('mediaType 未指定時は汎用ラベルで表示される', () => {
    render(<StatusFilter value={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'すべて' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '進行中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '完了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '一時停止' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '中断' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '予定' })).toBeInTheDocument()
  })

  it('anime 指定時は映像系ラベルで表示される', () => {
    render(<StatusFilter value={null} onChange={() => {}} mediaType="anime" />)
    expect(screen.getByRole('button', { name: '視聴中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴完了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴予定' })).toBeInTheDocument()
  })

  it('book 指定時は読み物系ラベルで表示される', () => {
    render(<StatusFilter value={null} onChange={() => {}} mediaType="book" />)
    expect(screen.getByRole('button', { name: '読書中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '読了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '読書予定' })).toBeInTheDocument()
  })

  it('value が null のとき「すべて」がアクティブ', () => {
    render(<StatusFilter value={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'すべて' }).className).toContain('active')
  })

  it('value が watching のとき対応ラベルがアクティブ', () => {
    render(<StatusFilter value="watching" onChange={() => {}} mediaType="anime" />)
    expect(screen.getByRole('button', { name: '視聴中' }).className).toContain('active')
  })

  it('ステータスボタンクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<StatusFilter value={null} onChange={handleChange} mediaType="anime" />)
    await user.click(screen.getByRole('button', { name: '視聴中' }))
    expect(handleChange).toHaveBeenCalledWith('watching')
  })

  it('「すべて」クリックで null が渡される', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<StatusFilter value="watching" onChange={handleChange} />)
    await user.click(screen.getByRole('button', { name: 'すべて' }))
    expect(handleChange).toHaveBeenCalledWith(null)
  })
})
