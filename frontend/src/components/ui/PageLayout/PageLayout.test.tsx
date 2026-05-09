import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PageLayout } from './PageLayout'

describe('PageLayout', () => {
  it('子要素を描画する', () => {
    render(
      <PageLayout>
        <p>テストコンテンツ</p>
      </PageLayout>,
    )
    expect(screen.getByText('テストコンテンツ')).toBeInTheDocument()
  })

  it('追加のclassNameを受け取れる', () => {
    const { container } = render(
      <PageLayout className="custom-class">
        <p>コンテンツ</p>
      </PageLayout>,
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('divタグとしてレンダリングされる', () => {
    const { container } = render(
      <PageLayout>
        <p>コンテンツ</p>
      </PageLayout>,
    )
    expect(container.firstChild?.nodeName).toBe('DIV')
  })
})
