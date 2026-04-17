import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncDashboard } from './sync-dashboard'
import type { PosthogItem, InsightPayload } from './client'

describe('syncDashboard', () => {
  const getInsightByName = vi.fn()
  const createInsight = vi.fn()
  const updateInsight = vi.fn()
  const getDashboardByName = vi.fn()
  const createDashboard = vi.fn()
  const client = {
    getInsightByName,
    createInsight,
    updateInsight,
    getDashboardByName,
    createDashboard,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Dashboard が未作成のときは作成し、Insight も新規作成する', async () => {
    getDashboardByName.mockResolvedValue(null)
    createDashboard.mockResolvedValue({ id: 10, name: 'Recolly Main Dashboard' } as PosthogItem)
    getInsightByName.mockResolvedValue(null)
    createInsight.mockResolvedValue({ id: 1, name: 'X' } as PosthogItem)

    const insights: InsightPayload[] = [{ name: 'X', query: {} }]
    await syncDashboard({
      client,
      insights,
      dashboardName: 'Recolly Main Dashboard',
      dashboardDescription: 'desc',
    })

    expect(createDashboard).toHaveBeenCalledWith({
      name: 'Recolly Main Dashboard',
      description: 'desc',
    })
    expect(createInsight).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'X', dashboards: [10] }),
    )
    expect(updateInsight).not.toHaveBeenCalled()
  })

  it('Dashboard が既にあるなら再利用し、既存 Insight は PATCH で更新する', async () => {
    getDashboardByName.mockResolvedValue({ id: 10, name: 'Recolly Main Dashboard' } as PosthogItem)
    getInsightByName.mockResolvedValue({ id: 7, name: 'X' } as PosthogItem)
    updateInsight.mockResolvedValue({ id: 7, name: 'X' } as PosthogItem)

    const insights: InsightPayload[] = [{ name: 'X', query: {} }]
    await syncDashboard({
      client,
      insights,
      dashboardName: 'Recolly Main Dashboard',
      dashboardDescription: 'desc',
    })

    expect(createDashboard).not.toHaveBeenCalled()
    expect(createInsight).not.toHaveBeenCalled()
    expect(updateInsight).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ name: 'X', dashboards: [10] }),
    )
  })

  it('複数の Insight で一部既存・一部新規の場合、それぞれ適切に処理される', async () => {
    getDashboardByName.mockResolvedValue({ id: 10, name: 'D' } as PosthogItem)
    getInsightByName.mockImplementation(async (name: string) => {
      if (name === 'existing') return { id: 1, name: 'existing' } as PosthogItem
      return null
    })
    createInsight.mockResolvedValue({ id: 2, name: 'new' } as PosthogItem)
    updateInsight.mockResolvedValue({ id: 1, name: 'existing' } as PosthogItem)

    const insights: InsightPayload[] = [
      { name: 'existing', query: {} },
      { name: 'new', query: {} },
    ]
    await syncDashboard({
      client,
      insights,
      dashboardName: 'D',
      dashboardDescription: 'desc',
    })

    expect(updateInsight).toHaveBeenCalledTimes(1)
    expect(createInsight).toHaveBeenCalledTimes(1)
  })
})
