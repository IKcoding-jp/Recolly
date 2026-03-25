import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { RewatchControl } from './RewatchControl'

describe('RewatchControl', () => {
  it('再視聴回数を表示する', () => {
    render(<RewatchControl count={2} onChange={vi.fn()} />)
    expect(screen.getByText('2回')).toBeInTheDocument()
  })

  it('+ボタンでonChangeが呼ばれる', async () => {
    const onChange = vi.fn()
    render(<RewatchControl count={1} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: '+' }))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('-ボタンでonChangeが呼ばれる', async () => {
    const onChange = vi.fn()
    render(<RewatchControl count={3} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: '-' }))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('-ボタンで0未満にはならない', () => {
    render(<RewatchControl count={0} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '-' })).toBeDisabled()
  })

  it('0回の場合も正しく表示する', () => {
    render(<RewatchControl count={0} onChange={vi.fn()} />)
    expect(screen.getByText('0回')).toBeInTheDocument()
  })
})
