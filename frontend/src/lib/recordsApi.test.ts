import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recordsApi } from './recordsApi'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('recordsApi', () => {
  describe('createFromWorkId', () => {
    it('正常系: 既存Workへの記録を作成', async () => {
      const recordData = { record: { id: 1, work_id: 10, status: 'plan_to_watch' } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(recordData),
      })
      const result = await recordsApi.createFromWorkId(10)
      expect(result.record.work_id).toBe(10)
    })
  })

  describe('createFromSearchResult', () => {
    it('正常系: 検索結果から記録を作成', async () => {
      const recordData = { record: { id: 1, work_id: 1, status: 'plan_to_watch' } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(recordData),
      })
      const workData = {
        title: 'テスト',
        media_type: 'anime' as const,
        external_api_id: '123',
        external_api_source: 'anilist',
        description: null,
        cover_image_url: null,
        total_episodes: null,
      }
      const result = await recordsApi.createFromSearchResult(workData)
      expect(result.record.status).toBe('plan_to_watch')
    })
  })

  describe('getAll', () => {
    it('正常系: 記録一覧を取得', async () => {
      const data = {
        records: [{ id: 1, status: 'watching', work: { id: 1, title: 'テスト' } }],
      }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      const result = await recordsApi.getAll()
      expect(result.records).toHaveLength(1)
    })

    it('フィルタパラメータ付きで呼び出せる', async () => {
      const data = { records: [] }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      await recordsApi.getAll({ status: 'watching', mediaType: 'anime' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=watching'),
        expect.any(Object),
      )
    })
  })

  describe('getOne', () => {
    it('正常系: 記録詳細を取得', async () => {
      const data = { record: { id: 1, status: 'watching', rating: 7 } }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      const result = await recordsApi.getOne(1)
      expect(result.record.rating).toBe(7)
    })
  })

  describe('update', () => {
    it('正常系: 記録を更新', async () => {
      const data = { record: { id: 1, status: 'completed', rating: 9 } }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      const result = await recordsApi.update(1, { status: 'completed', rating: 9 })
      expect(result.record.status).toBe('completed')
    })

    it('review_textを含む更新パラメータを送信できる', async () => {
      const data = { record: { id: 1, status: 'completed', rating: 9, review_text: '最高の作品' } }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      await recordsApi.update(1, { review_text: '最高の作品' })
      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body as string) as { record: { review_text: string } }
      expect(body.record.review_text).toBe('最高の作品')
    })

    it('rewatch_countを含む更新パラメータを送信できる', async () => {
      const data = { record: { id: 1, status: 'completed', rewatch_count: 2 } }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      await recordsApi.update(1, { rewatch_count: 2 })
      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body as string) as { record: { rewatch_count: number } }
      expect(body.record.rewatch_count).toBe(2)
    })
  })

  describe('remove', () => {
    it('正常系: 記録を削除', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      await recordsApi.remove(1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/records/1'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  describe('createFromWorkId（拡張）', () => {
    it('ステータスと評価を指定して記録を作成', async () => {
      const data = { record: { id: 1, status: 'watching', rating: 7 } }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      const result = await recordsApi.createFromWorkId(10, { status: 'watching', rating: 7 })
      expect(result.record.status).toBe('watching')
    })
  })
})
