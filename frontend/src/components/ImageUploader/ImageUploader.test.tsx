import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageUploader } from './ImageUploader'

vi.mock('../../lib/imagesApi', () => ({
  imagesApi: {
    presign: vi.fn().mockResolvedValue({
      presigned_url: 'https://s3.example.com/presigned',
      s3_key: 'uploads/images/test-uuid.jpg',
    }),
    uploadToS3: vi.fn().mockResolvedValue(undefined),
  },
}))

const createMockFile = (name: string, size: number, type: string): File => {
  const file = new File(['x'.repeat(Math.min(size, 100))], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('ImageUploader', () => {
  const defaultProps = {
    onUploadComplete: vi.fn(),
    onRemove: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ドロップゾーンが表示される', () => {
    render(<ImageUploader {...defaultProps} />)
    expect(screen.getByText('ドラッグ&ドロップ')).toBeInTheDocument()
    expect(screen.getByText(/ファイルを選択/)).toBeInTheDocument()
  })

  it('不正なファイル形式でエラー表示', async () => {
    render(<ImageUploader {...defaultProps} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile('test.pdf', 1000, 'application/pdf')
    // userEvent.uploadはaccept属性でフィルタするため、fireEventで直接テストする
    fireEvent.change(input, { target: { files: [file] } })
    expect(screen.getByText(/対応していないファイル形式/)).toBeInTheDocument()
  })

  it('10MB超のファイルでエラー表示', async () => {
    render(<ImageUploader {...defaultProps} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile('big.jpg', 11 * 1024 * 1024, 'image/jpeg')
    // userEvent.uploadはaccept属性でフィルタするため、fireEventで直接テストする
    fireEvent.change(input, { target: { files: [file] } })
    expect(screen.getByText(/10MB/)).toBeInTheDocument()
  })

  it('完了後に「画像を削除」リンクが表示される', async () => {
    render(<ImageUploader {...defaultProps} />)
    const user = userEvent.setup()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile('cover.jpg', 1000, 'image/jpeg')
    await user.upload(input, file)
    await waitFor(() => {
      expect(screen.getByText('アップロード完了')).toBeInTheDocument()
    })
    expect(screen.getByText('画像を削除')).toBeInTheDocument()
  })

  it('「画像を削除」クリックでidleに戻る', async () => {
    render(<ImageUploader {...defaultProps} />)
    const user = userEvent.setup()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile('cover.jpg', 1000, 'image/jpeg')
    await user.upload(input, file)
    await waitFor(() => {
      expect(screen.getByText('画像を削除')).toBeInTheDocument()
    })
    await user.click(screen.getByText('画像を削除'))
    expect(screen.getByText('ドラッグ&ドロップ')).toBeInTheDocument()
    expect(defaultProps.onRemove).toHaveBeenCalled()
  })

  it('アップロード完了時にonUploadCompleteが呼ばれる', async () => {
    render(<ImageUploader {...defaultProps} />)
    const user = userEvent.setup()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile('cover.jpg', 1000, 'image/jpeg')
    await user.upload(input, file)
    await waitFor(() => {
      expect(defaultProps.onUploadComplete).toHaveBeenCalledWith({
        s3Key: 'uploads/images/test-uuid.jpg',
        fileName: 'cover.jpg',
        contentType: 'image/jpeg',
        fileSize: 1000,
      })
    })
  })
})
