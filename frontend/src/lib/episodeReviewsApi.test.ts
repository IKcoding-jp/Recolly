import { describe, it, expect, vi, beforeEach } from 'vitest'
import { episodeReviewsApi } from './episodeReviewsApi'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('episodeReviewsApi', () => {
  describe('getAll', () => {
    it('正常系: 話数感想一覧を取得', async () => {
      const data = {
        episode_reviews: [
          {
            id: 1,
            record_id: 10,
            episode_number: 1,
            body: '面白かった',
            visibility: 'private_record',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
      }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      const result = await episodeReviewsApi.getAll(10)
      expect(result.episode_reviews).toHaveLength(1)
      expect(result.episode_reviews[0].episode_number).toBe(1)
    })

    it('正しいエンドポイントを呼び出す', async () => {
      const data = { episode_reviews: [] }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      await episodeReviewsApi.getAll(5)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/records/5/episode_reviews'),
        expect.any(Object),
      )
    })
  })

  describe('create', () => {
    it('正常系: 話数感想を作成', async () => {
      const data = {
        episode_review: {
          id: 1,
          record_id: 10,
          episode_number: 3,
          body: '衝撃の展開',
          visibility: 'private_record',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      const result = await episodeReviewsApi.create(10, { episode_number: 3, body: '衝撃の展開' })
      expect(result.episode_review.episode_number).toBe(3)
      expect(result.episode_review.body).toBe('衝撃の展開')
    })

    it('POSTメソッドで正しいエンドポイントを呼び出す', async () => {
      const data = {
        episode_review: {
          id: 1,
          record_id: 10,
          episode_number: 1,
          body: 'テスト',
          visibility: 'private_record',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      await episodeReviewsApi.create(10, { episode_number: 1, body: 'テスト' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/records/10/episode_reviews'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('update', () => {
    it('正常系: 話数感想を更新', async () => {
      const data = {
        episode_review: {
          id: 1,
          record_id: 10,
          episode_number: 1,
          body: '更新後の感想',
          visibility: 'private_record',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
        },
      }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      const result = await episodeReviewsApi.update(10, 1, { body: '更新後の感想' })
      expect(result.episode_review.body).toBe('更新後の感想')
    })

    it('PATCHメソッドで正しいエンドポイントを呼び出す', async () => {
      const data = {
        episode_review: {
          id: 1,
          record_id: 10,
          episode_number: 1,
          body: '更新',
          visibility: 'private_record',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
        },
      }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      await episodeReviewsApi.update(10, 1, { body: '更新' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/records/10/episode_reviews/1'),
        expect.objectContaining({ method: 'PATCH' }),
      )
    })
  })

  describe('remove', () => {
    it('正常系: 話数感想を削除', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      await episodeReviewsApi.remove(10, 1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/records/10/episode_reviews/1'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })
})
