import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GenreDropdown } from './GenreDropdown'
import { GENRE_FILTERS } from './genreFilters'

describe('GenreDropdown', () => {
  it('全ジャンルオプションが表示される', () => {
    render(<GenreDropdown value="all" onChange={vi.fn()} />)
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()

    // 全オプションが存在することを確認
    for (const filter of GENRE_FILTERS) {
      expect(screen.getByText(filter.label)).toBeInTheDocument()
    }
  })

  it('選択変更でonChangeが呼ばれる', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<GenreDropdown value="all" onChange={onChange} />)

    await user.selectOptions(screen.getByRole('combobox'), 'anime')
    expect(onChange).toHaveBeenCalledWith('anime')
  })

  it('渡されたvalueが選択状態になる', () => {
    render(<GenreDropdown value="movie" onChange={vi.fn()} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('movie')
  })
})
