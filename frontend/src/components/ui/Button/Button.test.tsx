import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('childrenが表示される', () => {
    render(<Button variant="primary">クリック</Button>)
    expect(screen.getByRole('button', { name: 'クリック' })).toBeInTheDocument()
  })

  it('primaryバリアントのCSSクラスが適用される', () => {
    render(<Button variant="primary">ボタン</Button>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('primary')
  })

  it('secondaryバリアントのCSSクラスが適用される', () => {
    render(<Button variant="secondary">ボタン</Button>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('secondary')
  })

  it('ghostバリアントのCSSクラスが適用される', () => {
    render(<Button variant="ghost">ボタン</Button>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('ghost')
  })

  it('クリック時にonClickが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(
      <Button variant="primary" onClick={handleClick}>
        ボタン
      </Button>,
    )
    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('disabled時にクリックが無効化される', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(
      <Button variant="primary" onClick={handleClick} disabled>
        ボタン
      </Button>,
    )
    await user.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('disabled時にdisabled属性が設定される', () => {
    render(
      <Button variant="primary" disabled>
        ボタン
      </Button>,
    )
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('smサイズのCSSクラスが適用される', () => {
    render(
      <Button variant="primary" size="sm">
        ボタン
      </Button>,
    )
    const button = screen.getByRole('button')
    expect(button.className).toContain('sm')
  })

  it('lgサイズのCSSクラスが適用される', () => {
    render(
      <Button variant="primary" size="lg">
        ボタン
      </Button>,
    )
    const button = screen.getByRole('button')
    expect(button.className).toContain('lg')
  })

  it('デフォルトのtype属性がbuttonである', () => {
    render(<Button variant="primary">ボタン</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('type属性を指定できる', () => {
    render(
      <Button variant="primary" type="submit">
        送信
      </Button>,
    )
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('追加のclassNameが適用される', () => {
    render(
      <Button variant="primary" className="extra">
        ボタン
      </Button>,
    )
    expect(screen.getByRole('button').className).toContain('extra')
  })
})
