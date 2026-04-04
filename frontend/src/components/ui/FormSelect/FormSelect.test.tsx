import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormSelect } from './FormSelect'

const OPTIONS = [
  { value: 'all', label: 'すべて' },
  { value: 'anime', label: 'アニメ' },
  { value: 'movie', label: '映画' },
]

describe('FormSelect', () => {
  it('ラベルが表示される', () => {
    render(<FormSelect label="ジャンル" value="all" onChange={() => {}} options={OPTIONS} />)
    expect(screen.getByText('ジャンル')).toBeInTheDocument()
  })

  it('選択肢が表示される', () => {
    render(<FormSelect label="ジャンル" value="all" onChange={() => {}} options={OPTIONS} />)
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('すべて')).toBeInTheDocument()
    expect(screen.getByText('アニメ')).toBeInTheDocument()
    expect(screen.getByText('映画')).toBeInTheDocument()
  })

  it('選択値が反映される', () => {
    render(<FormSelect label="ジャンル" value="anime" onChange={() => {}} options={OPTIONS} />)
    expect(screen.getByRole('combobox')).toHaveValue('anime')
  })

  it('onChangeが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<FormSelect label="ジャンル" value="all" onChange={handleChange} options={OPTIONS} />)
    await user.selectOptions(screen.getByRole('combobox'), 'anime')
    expect(handleChange).toHaveBeenCalled()
  })

  it('エラーメッセージが表示される', () => {
    render(
      <FormSelect
        label="ジャンル"
        value="all"
        onChange={() => {}}
        options={OPTIONS}
        error="選択してください"
      />,
    )
    expect(screen.getByText('選択してください')).toBeInTheDocument()
  })

  it('ラベルなしで使用できる', () => {
    render(<FormSelect value="all" onChange={() => {}} options={OPTIONS} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
