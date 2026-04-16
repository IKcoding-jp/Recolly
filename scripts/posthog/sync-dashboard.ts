import 'dotenv/config'
import { createPosthogClient, type InsightPayload } from './client'
import { INSIGHT_DEFINITIONS, DASHBOARD_NAME, DASHBOARD_DESCRIPTION } from './insights'

type PosthogClient = ReturnType<typeof createPosthogClient>

type SyncDashboardParams = {
  client: Pick<
    PosthogClient,
    | 'getInsightByName'
    | 'createInsight'
    | 'updateInsight'
    | 'getDashboardByName'
    | 'createDashboard'
  >
  insights: InsightPayload[]
  dashboardName: string
  dashboardDescription: string
}

/**
 * Dashboard と Insight をべき等に作成・更新する。
 *
 * - Dashboard は name で検索 → 無ければ作成、あれば再利用。
 * - Insight も name で検索 → 無ければ POST、あれば PATCH で query を更新。
 * - すべての Insight は対象 Dashboard に紐付ける。
 */
export async function syncDashboard(params: SyncDashboardParams): Promise<void> {
  const { client, insights, dashboardName, dashboardDescription } = params

  let dashboard = await client.getDashboardByName(dashboardName)
  if (!dashboard) {
    dashboard = await client.createDashboard({
      name: dashboardName,
      description: dashboardDescription,
    })
    console.log(`Created dashboard "${dashboardName}" (id: ${dashboard.id})`)
  } else {
    console.log(`Reusing existing dashboard "${dashboardName}" (id: ${dashboard.id})`)
  }

  for (const insightDef of insights) {
    const payload: InsightPayload = { ...insightDef, dashboards: [dashboard.id] }
    const existing = await client.getInsightByName(insightDef.name)
    if (existing) {
      await client.updateInsight(existing.id, payload)
      console.log(`  Updated insight "${insightDef.name}" (id: ${existing.id})`)
    } else {
      const created = await client.createInsight(payload)
      console.log(`  Created insight "${insightDef.name}" (id: ${created.id})`)
    }
  }
}

// CLI エントリポイント（tsx sync-dashboard.ts で直接実行時のみ走る）
if (import.meta.url === `file://${process.argv[1]}`) {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  const projectId = process.env.POSTHOG_PROJECT_ID
  const host = process.env.POSTHOG_HOST

  if (!apiKey || !projectId || !host) {
    console.error('Missing env vars: POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID, POSTHOG_HOST')
    console.error('See scripts/posthog/README.md')
    process.exit(1)
  }

  const client = createPosthogClient({ apiKey, projectId, host })
  syncDashboard({
    client,
    insights: INSIGHT_DEFINITIONS,
    dashboardName: DASHBOARD_NAME,
    dashboardDescription: DASHBOARD_DESCRIPTION,
  }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
