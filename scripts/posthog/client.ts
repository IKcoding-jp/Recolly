import { z } from 'zod'

export type PosthogClientConfig = {
  apiKey: string
  projectId: string
  host: string
}

const listResponseSchema = z.object({
  results: z.array(z.object({ id: z.number(), name: z.string() }).passthrough()),
})

const itemSchema = z.object({ id: z.number(), name: z.string() }).passthrough()

export type PosthogItem = z.infer<typeof itemSchema>

export type InsightPayload = {
  name: string
  description?: string
  query: unknown
  dashboards?: number[]
}

export type DashboardPayload = {
  name: string
  description?: string
}

async function ensureOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`PostHog API ${res.status}: ${body}`)
  }
}

export function createPosthogClient(config: PosthogClientConfig) {
  const base = `${config.host}/api/projects/${config.projectId}`
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  }

  return {
    async getInsightByName(name: string): Promise<PosthogItem | null> {
      const res = await fetch(`${base}/insights/?search=${encodeURIComponent(name)}`, { headers })
      await ensureOk(res)
      const data = listResponseSchema.parse(await res.json())
      // PostHog の search は部分一致なので、完全一致だけ拾う
      return data.results.find((i) => i.name === name) ?? null
    },

    async createInsight(payload: InsightPayload): Promise<PosthogItem> {
      const res = await fetch(`${base}/insights/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      await ensureOk(res)
      return itemSchema.parse(await res.json())
    },

    async updateInsight(id: number, payload: InsightPayload): Promise<PosthogItem> {
      const res = await fetch(`${base}/insights/${id}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      })
      await ensureOk(res)
      return itemSchema.parse(await res.json())
    },

    async getDashboardByName(name: string): Promise<PosthogItem | null> {
      const res = await fetch(`${base}/dashboards/?search=${encodeURIComponent(name)}`, { headers })
      await ensureOk(res)
      const data = listResponseSchema.parse(await res.json())
      return data.results.find((d) => d.name === name) ?? null
    },

    async createDashboard(payload: DashboardPayload): Promise<PosthogItem> {
      const res = await fetch(`${base}/dashboards/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      await ensureOk(res)
      return itemSchema.parse(await res.json())
    },
  }
}
