import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaTypeFilter } from './MediaTypeFilter'

describe('MediaTypeFilter', () => {
  it('「全ジャンル」を含む全メディアタイプが表示される', () => {
    render(<MediaTypeFilter value={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '全ジャンル' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'アニメ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '映画' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ドラマ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '本' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '漫画・ラノベ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ゲーム' })).toBeInTheDocument()
  })

  it('value が null のとき「全ジャンル」がアクティブ', () => {
    render(<MediaTypeFilter value={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '全ジャンル' }).className).toContain('active')
  })

  it('ジャンルクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<MediaTypeFilter value={null} onChange={handleChange} />)
    await user.click(screen.getByRole('button', { name: 'アニメ' }))
    expect(handleChange).toHaveBeenCalledWith('anime')
  })

  it('「全ジャンル」クリックで null が渡される', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<MediaTypeFilter value="anime" onChange={handleChange} />)
    await user.click(screen.getByRole('button', { name: '全ジャンル' }))
    expect(handleChange).toHaveBeenCalledWith(null)
  })
})
