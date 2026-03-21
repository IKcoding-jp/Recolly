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
})
