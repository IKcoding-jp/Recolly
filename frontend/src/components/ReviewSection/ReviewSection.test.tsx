import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReviewSection } from './ReviewSection'

describe('ReviewSection', () => {
  let mockOnSave: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnSave = vi.fn().mockResolvedValue(undefined)
  })

  describe('empty モード', () => {
    it('reviewText が null の時、空状態メッセージが表示される', () => {
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      expect(screen.getByText('まだ感想が書かれていません')).toBeInTheDocument()
    })

    it('reviewText が空文字の時、空状態メッセージが表示される', () => {
      render(<ReviewSection reviewText="" onSave={mockOnSave} />)
      expect(screen.getByText('まだ感想が書かれていません')).toBeInTheDocument()
    })

    it('「感想を書く」ボタンが表示される', () => {
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      expect(screen.getByRole('button', { name: '感想を書く' })).toBeInTheDocument()
    })

    it('「感想を書く」クリックで編集モードに切り替わる', async () => {
      const user = userEvent.setup()
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '感想を書く' }))
      expect(screen.getByPlaceholderText('作品の感想を書く...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    })

    it('空状態では「編集」「保存」ボタンが表示されない', () => {
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      expect(screen.queryByRole('button', { name: '編集' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument()
    })
  })

  describe('view モード', () => {
    it('reviewText に値がある時、本文が表示される', () => {
      render(<ReviewSection reviewText="素晴らしい作品" onSave={mockOnSave} />)
      expect(screen.getByText('素晴らしい作品')).toBeInTheDocument()
    })

    it('改行を含むテキストで pre-wrap スタイルが適用される', () => {
      const text = '1行目\n2行目\n3行目'
      const { container } = render(<ReviewSection reviewText={text} onSave={mockOnSave} />)
      const textEl = container.querySelector('p')
      expect(textEl?.textContent).toBe(text)
      expect(textEl?.className).toMatch(/viewText/)
    })

    it('「編集」ボタンが表示される', () => {
      render(<ReviewSection reviewText="感想" onSave={mockOnSave} />)
      expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument()
    })

    it('「編集」クリックで編集モードに切り替わり、既存テキストが入っている', async () => {
      const user = userEvent.setup()
      render(<ReviewSection reviewText="感想" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '編集' }))
      expect(screen.getByDisplayValue('感想')).toBeInTheDocument()
    })

    it('view モードではテキストエリアが表示されない', () => {
      render(<ReviewSection reviewText="感想" onSave={mockOnSave} />)
      expect(screen.queryByPlaceholderText('作品の感想を書く...')).not.toBeInTheDocument()
    })
  })

  describe('edit モード - 保存', () => {
    it('保存ボタンをクリックすると onSave が新しいテキストで呼ばれる', async () => {
      const user = userEvent.setup()
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '感想を書く' }))
      const textarea = screen.getByPlaceholderText('作品の感想を書く...')
      await user.type(textarea, '新しい感想')
      await user.click(screen.getByRole('button', { name: '保存' }))
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('新しい感想')
      })
    })

    it('保存中は保存ボタンが「保存中...」表示で disabled になる', async () => {
      const user = userEvent.setup()
      let resolveSave: (() => void) | undefined
      mockOnSave.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveSave = resolve
          }),
      )
      render(<ReviewSection reviewText="text" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '編集' }))
      await user.click(screen.getByRole('button', { name: '保存' }))
      const savingBtn = await screen.findByRole('button', { name: '保存中...' })
      expect(savingBtn).toBeDisabled()
      resolveSave?.()
    })

    it('保存成功後、親が reviewText を更新すると view モードに戻る', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<ReviewSection reviewText="" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '感想を書く' }))
      const textarea = screen.getByPlaceholderText('作品の感想を書く...')
      await user.type(textarea, '保存後')
      await user.click(screen.getByRole('button', { name: '保存' }))
      await waitFor(() => expect(mockOnSave).toHaveBeenCalled())
      // 親が reviewText を更新したことをシミュレート
      rerender(<ReviewSection reviewText="保存後" onSave={mockOnSave} />)
      expect(screen.getByText('保存後')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText('作品の感想を書く...')).not.toBeInTheDocument()
    })
  })

  describe('edit モード - キャンセル', () => {
    it('キャンセルすると編集内容が破棄され、view モードに戻る', async () => {
      const user = userEvent.setup()
      render(<ReviewSection reviewText="元のテキスト" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '編集' }))
      const textarea = screen.getByPlaceholderText('作品の感想を書く...')
      await user.clear(textarea)
      await user.type(textarea, '変更後')
      await user.click(screen.getByRole('button', { name: 'キャンセル' }))
      expect(screen.getByText('元のテキスト')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText('作品の感想を書く...')).not.toBeInTheDocument()
    })

    it('null 状態から編集→キャンセルで empty モードに戻る', async () => {
      const user = userEvent.setup()
      render(<ReviewSection reviewText={null} onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '感想を書く' }))
      await user.click(screen.getByRole('button', { name: 'キャンセル' }))
      expect(screen.getByText('まだ感想が書かれていません')).toBeInTheDocument()
    })
  })

  describe('エラーハンドリング', () => {
    it('onSave が例外を投げた場合、エラーメッセージが表示される', async () => {
      const user = userEvent.setup()
      mockOnSave.mockRejectedValue(new Error('network error'))
      render(<ReviewSection reviewText="text" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '編集' }))
      await user.click(screen.getByRole('button', { name: '保存' }))
      expect(
        await screen.findByText('保存に失敗しました。もう一度お試しください。'),
      ).toBeInTheDocument()
    })

    it('保存失敗時は編集モードに留まり、入力内容が失われない', async () => {
      const user = userEvent.setup()
      mockOnSave.mockRejectedValue(new Error('fail'))
      render(<ReviewSection reviewText="" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '感想を書く' }))
      const textarea = screen.getByPlaceholderText('作品の感想を書く...')
      await user.type(textarea, '失敗テスト')
      await user.click(screen.getByRole('button', { name: '保存' }))
      await screen.findByText('保存に失敗しました。もう一度お試しください。')
      expect(screen.getByDisplayValue('失敗テスト')).toBeInTheDocument()
    })

    it('再試行時に前回のエラーがクリアされる', async () => {
      const user = userEvent.setup()
      mockOnSave.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(undefined)
      render(<ReviewSection reviewText="text" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '編集' }))
      await user.click(screen.getByRole('button', { name: '保存' }))
      await screen.findByText('保存に失敗しました。もう一度お試しください。')
      await user.click(screen.getByRole('button', { name: '保存' }))
      await waitFor(() => {
        expect(
          screen.queryByText('保存に失敗しました。もう一度お試しください。'),
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('親データ同期', () => {
    it('編集中に親が reviewText を更新しても draft は上書きされない', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<ReviewSection reviewText="初期" onSave={mockOnSave} />)
      await user.click(screen.getByRole('button', { name: '編集' }))
      const textarea = screen.getByPlaceholderText('作品の感想を書く...')
      await user.clear(textarea)
      await user.type(textarea, '編集中のテキスト')
      // 親が reviewText を別の値で更新（例: 別タブで保存が発生）
      rerender(<ReviewSection reviewText="他から来た値" onSave={mockOnSave} />)
      expect(screen.getByDisplayValue('編集中のテキスト')).toBeInTheDocument()
    })
  })
})
