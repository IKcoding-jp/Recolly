import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('デザインシステムショーケースが表示される', () => {
    render(<App />)
    expect(screen.getByText('Recolly デザインシステム')).toBeInTheDocument()
  })
})
