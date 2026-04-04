import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormTextarea } from './FormTextarea'

describe('FormTextarea', () => {
  it('ラベルが表示される', () => {
    render(<FormTextarea label="感想" value="" onChange={() => {}} />)
    expect(screen.getByText('感想')).toBeInTheDocument()
  })

  it('入力値が反映される', () => {
    render(<FormTextarea label="感想" value="面白かった" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('面白かった')
  })

  it('onChangeが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<FormTextarea label="感想" value="" onChange={handleChange} />)
    await user.type(screen.getByRole('textbox'), 'a')
    expect(handleChange).toHaveBeenCalled()
  })

  it('placeholderが表示される', () => {
    render(<FormTextarea label="感想" value="" onChange={() => {}} placeholder="感想を書く..." />)
    expect(screen.getByPlaceholderText('感想を書く...')).toBeInTheDocument()
  })

  it('デフォルトのrowsが4である', () => {
    render(<FormTextarea label="感想" value="" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '4')
  })

  it('rowsを指定できる', () => {
    render(<FormTextarea label="感想" value="" onChange={() => {}} rows={6} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '6')
  })

  it('エラーメッセージが表示される', () => {
    render(<FormTextarea label="感想" value="" onChange={() => {}} error="入力してください" />)
    expect(screen.getByText('入力してください')).toBeInTheDocument()
  })

  it('ラベルなしで使用できる', () => {
    render(<FormTextarea value="" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
