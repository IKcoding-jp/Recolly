import { describe, it, expect, vi, beforeEach } from 'vitest'
import { worksApi } from './worksApi'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('worksApi', () => {
  describe('search', () => {
    it('正常系: 検索結果を返す', async () => {
      const searchData = {
        results: [{ title: 'テスト作品', media_type: 'anime', description: '説明' }],
        enriched: true,
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(searchData),
      })

      const result = await worksApi.search('テスト')
      expect(result.results).toHaveLength(1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/works/search'),
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    it('media_type指定時にクエリパラメータに含まれる', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], enriched: true }),
      })
      await worksApi.search('テスト', 'anime')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('media_type=anime'),
        expect.any(Object),
      )
    })

    it('enrich: false のとき enrich=false クエリパラメータを付与する', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], enriched: false }),
      })

      await worksApi.search('テスト', undefined, { enrich: false })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('enrich=false'),
        expect.any(Object),
      )
    })

    it('enrich 未指定のとき enrich パラメータを付与しない', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], enriched: true }),
      })

      await worksApi.search('テスト')

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).not.toContain('enrich')
    })
  })

  describe('create', () => {
    it('正常系: 作品を手動登録して返す', async () => {
      const workData = { work: { id: 1, title: '手動作品', media_type: 'anime' } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(workData),
      })
      const result = await worksApi.create('手動作品', 'anime', '説明')
      expect(result.work.title).toBe('手動作品')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/works'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })
})
