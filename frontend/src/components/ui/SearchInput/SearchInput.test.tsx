import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchInput } from './SearchInput'

describe('SearchInput', () => {
  it('value を input に表示する', () => {
    render(<SearchInput value="進撃" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('進撃')
  })

  it('入力時に onChange が新しい値で呼ばれる', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()
    render(<SearchInput value="" onChange={handleChange} />)

    await user.type(screen.getByRole('textbox'), '鬼')

    expect(handleChange).toHaveBeenCalledWith('鬼')
  })

  it('value が空でないときクリアボタンを表示する', () => {
    render(<SearchInput value="進撃" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /クリア/ })).toBeInTheDocument()
  })

  it('value が空のときクリアボタンを表示しない', () => {
    render(<SearchInput value="" onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: /クリア/ })).not.toBeInTheDocument()
  })

  it('クリアボタンで onChange が空文字で呼ばれる', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()
    render(<SearchInput value="進撃" onChange={handleChange} />)

    await user.click(screen.getByRole('button', { name: /クリア/ }))

    expect(handleChange).toHaveBeenCalledWith('')
  })

  it('aria-label を input に付与する', () => {
    render(<SearchInput value="" onChange={() => {}} aria-label="ライブラリ内検索" />)
    expect(screen.getByRole('textbox', { name: 'ライブラリ内検索' })).toBeInTheDocument()
  })

  it('placeholder を input に表示する', () => {
    render(<SearchInput value="" onChange={() => {}} placeholder="タイトルで検索..." />)
    expect(screen.getByPlaceholderText('タイトルで検索...')).toBeInTheDocument()
  })
})
