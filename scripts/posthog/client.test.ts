import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPosthogClient } from './client'

describe('PostHog API Client', () => {
  const fetchMock = vi.fn()
  globalThis.fetch = fetchMock as unknown as typeof fetch

  beforeEach(() => {
    fetchMock.mockReset()
  })

  const client = createPosthogClient({
    apiKey: 'phx_test',
    projectId: '42',
    host: 'https://us.i.posthog.com',
  })

  it('getInsightByName が正しい URL で GET する', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: 1, name: 'X' }] }),
    })
    const result = await client.getInsightByName('X')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://us.i.posthog.com/api/projects/42/insights/?search=X',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer phx_test' }),
      }),
    )
    expect(result).toEqual({ id: 1, name: 'X' })
  })

  it('getInsightByName が名前完全一致する要素だけを返す', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { id: 1, name: 'X prefix' },
          { id: 2, name: 'X' },
        ],
      }),
    })
    const result = await client.getInsightByName('X')
    expect(result).toEqual({ id: 2, name: 'X' })
  })

  it('getInsightByName が結果なしで null を返す', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
    const result = await client.getInsightByName('X')
    expect(result).toBeNull()
  })

  it('createInsight が正しい POST を送る', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 99, name: 'Y' }) })
    const payload = { name: 'Y', query: {}, dashboards: [1] }
    await client.createInsight(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://us.i.posthog.com/api/projects/42/insights/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    )
  })

  it('updateInsight が正しい PATCH を送る', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 99, name: 'Z' }) })
    const payload = { name: 'Z', query: { foo: 'bar' } }
    await client.updateInsight(99, payload)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://us.i.posthog.com/api/projects/42/insights/99/',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    )
  })

  it('getDashboardByName が正しい URL で GET する', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: 7, name: 'Main' }] }),
    })
    const result = await client.getDashboardByName('Main')
    expect(result).toEqual({ id: 7, name: 'Main' })
  })

  it('createDashboard が正しい POST を送る', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 7, name: 'Main' }) })
    await client.createDashboard({ name: 'Main', description: 'test' })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://us.i.posthog.com/api/projects/42/dashboards/',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })

  it('API がエラーレスポンスを返したら例外を投げる', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' })
    await expect(client.getInsightByName('X')).rejects.toThrow(/400/)
  })
})
