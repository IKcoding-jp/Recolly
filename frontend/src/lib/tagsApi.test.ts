import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tagsApi } from './tagsApi'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('tagsApi', () => {
  describe('getAll', () => {
    it('正常系: タグ一覧を取得', async () => {
      const data = {
        tags: [{ id: 1, name: '泣ける', user_id: 1, created_at: '2026-01-01T00:00:00Z' }],
      }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      const result = await tagsApi.getAll()
      expect(result.tags).toHaveLength(1)
      expect(result.tags[0].name).toBe('泣ける')
    })

    it('正しいエンドポイントを呼び出す', async () => {
      const data = { tags: [] }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      await tagsApi.getAll()
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/tags'), expect.any(Object))
    })
  })

  describe('addToRecord', () => {
    it('正常系: 記録にタグを追加', async () => {
      const data = {
        tag: { id: 1, name: '泣ける', user_id: 1, created_at: '2026-01-01T00:00:00Z' },
      }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      const result = await tagsApi.addToRecord(10, '泣ける')
      expect(result.tag.name).toBe('泣ける')
    })

    it('POSTメソッドで正しいエンドポイントを呼び出す', async () => {
      const data = {
        tag: { id: 1, name: 'テスト', user_id: 1, created_at: '2026-01-01T00:00:00Z' },
      }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      await tagsApi.addToRecord(10, 'テスト')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/records/10/tags'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('removeFromRecord', () => {
    it('DELETEメソッドで正しいエンドポイントを呼び出す', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      await tagsApi.removeFromRecord(10, 5)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/records/10/tags/5'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  describe('deleteTag', () => {
    it('DELETEメソッドで正しいエンドポイントを呼び出す', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      await tagsApi.deleteTag(3)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tags/3'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })
})
