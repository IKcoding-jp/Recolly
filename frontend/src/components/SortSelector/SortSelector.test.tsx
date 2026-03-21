import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SortSelector } from './SortSelector'

describe('SortSelector', () => {
  it('ラベルと3つのソートオプションが表示される', () => {
    render(<SortSelector value="updated_at" onChange={() => {}} />)
    expect(screen.getByText('並び替え')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '更新日' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '評価' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'タイトル' })).toBeInTheDocument()
  })

  it('現在の値がアクティブ表示される', () => {
    render(<SortSelector value="rating" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '評価' }).className).toContain('active')
  })

  it('ボタンクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<SortSelector value="updated_at" onChange={handleChange} />)
    await user.click(screen.getByRole('button', { name: 'タイトル' }))
    expect(handleChange).toHaveBeenCalledWith('title_asc')
  })
})
