import { render, screen } from '@testing-library/react'
import { Typography } from './Typography'

describe('Typography', () => {
  it('h1バリアントがh1タグでレンダリングされる', () => {
    render(<Typography variant="h1">見出し1</Typography>)
    const el = screen.getByText('見出し1')
    expect(el.tagName).toBe('H1')
  })

  it('h2バリアントがh2タグでレンダリングされる', () => {
    render(<Typography variant="h2">見出し2</Typography>)
    const el = screen.getByText('見出し2')
    expect(el.tagName).toBe('H2')
  })

  it('h3バリアントがh3タグでレンダリングされる', () => {
    render(<Typography variant="h3">見出し3</Typography>)
    const el = screen.getByText('見出し3')
    expect(el.tagName).toBe('H3')
  })

  it('h4バリアントがh4タグでレンダリングされる', () => {
    render(<Typography variant="h4">見出し4</Typography>)
    const el = screen.getByText('見出し4')
    expect(el.tagName).toBe('H4')
  })

  it('bodyバリアントがpタグでレンダリングされる', () => {
    render(<Typography variant="body">本文テキスト</Typography>)
    const el = screen.getByText('本文テキスト')
    expect(el.tagName).toBe('P')
  })

  it('labelバリアントがspanタグでレンダリングされる', () => {
    render(<Typography variant="label">ラベル</Typography>)
    const el = screen.getByText('ラベル')
    expect(el.tagName).toBe('SPAN')
  })

  it('metaバリアントがspanタグでレンダリングされる', () => {
    render(<Typography variant="meta">メタ情報</Typography>)
    const el = screen.getByText('メタ情報')
    expect(el.tagName).toBe('SPAN')
  })

  it('as propでHTMLタグを上書きできる', () => {
    render(
      <Typography variant="h1" as="p">
        段落として表示
      </Typography>,
    )
    const el = screen.getByText('段落として表示')
    expect(el.tagName).toBe('P')
  })

  it('追加のclassNameが適用される', () => {
    render(
      <Typography variant="body" className="custom-class">
        テスト
      </Typography>,
    )
    const el = screen.getByText('テスト')
    expect(el.className).toContain('custom-class')
  })
})
