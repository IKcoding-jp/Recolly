import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormInput } from './FormInput'

describe('FormInput', () => {
  it('ラベルが表示される', () => {
    render(<FormInput label="メールアドレス" value="" onChange={() => {}} />)
    expect(screen.getByText('メールアドレス')).toBeInTheDocument()
  })

  it('入力値が反映される', () => {
    render(<FormInput label="メール" value="test@example.com" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('test@example.com')
  })

  it('onChangeが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<FormInput label="メール" value="" onChange={handleChange} />)
    await user.type(screen.getByRole('textbox'), 'a')
    expect(handleChange).toHaveBeenCalled()
  })

  it('placeholderが表示される', () => {
    render(<FormInput label="メール" value="" onChange={() => {}} placeholder="入力してください" />)
    expect(screen.getByPlaceholderText('入力してください')).toBeInTheDocument()
  })

  it('エラーメッセージが表示される', () => {
    render(<FormInput label="メール" value="" onChange={() => {}} error="必須項目です" />)
    expect(screen.getByText('必須項目です')).toBeInTheDocument()
  })

  it('required属性が設定される', () => {
    render(<FormInput label="メール" value="" onChange={() => {}} required />)
    expect(screen.getByRole('textbox')).toBeRequired()
  })

  it('type属性が設定される', () => {
    render(<FormInput label="パスワード" value="" onChange={() => {}} type="password" />)
    const input = document.querySelector('input[type="password"]')
    expect(input).toBeInTheDocument()
  })

  it('autoComplete属性が設定される', () => {
    render(<FormInput label="メール" value="" onChange={() => {}} autoComplete="email" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('autocomplete', 'email')
  })
})
