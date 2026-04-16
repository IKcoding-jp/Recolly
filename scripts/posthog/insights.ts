/**
 * Dashboard に載せる 9 本の Insight 定義。
 * Spec: docs/superpowers/specs/2026-04-17-analytics-phase2-dashboard-design.md §4.2
 *
 * query の構造は PostHog の Query JSON 形式に従う。詳細:
 * https://posthog.com/docs/api/queries
 *
 * 注意: PostHog の query 形式は API バージョンで差異があるため、
 * 初回実行で 4xx が出た場合は PostHog UI から該当 Insight をエクスポートし、
 * そのクエリ JSON をここに貼り付けるのが確実。
 */
import type { InsightPayload } from './client'

export const DASHBOARD_NAME = 'Recolly Main Dashboard'
export const DASHBOARD_DESCRIPTION =
  'Recolly の主要 KPI を一覧する。spec: 2026-04-17-analytics-phase2-dashboard-design.md'

export const INSIGHT_DEFINITIONS: InsightPayload[] = [
  {
    name: 'Active Users (DAU/WAU/MAU)',
    description: '利用アクティビティ。$pageview を DAU/WAU/MAU で 3 本線表示',
    query: {
      kind: 'TrendsQuery',
      series: [
        { event: '$pageview', math: 'dau', name: 'DAU' },
        { event: '$pageview', math: 'weekly_active', name: 'WAU' },
        { event: '$pageview', math: 'monthly_active', name: 'MAU' },
      ],
    },
  },
  {
    name: 'Cumulative Records Created',
    description: '累計記録件数。record_created の total を cumulative 表示',
    query: {
      kind: 'TrendsQuery',
      series: [{ event: 'record_created', math: 'total' }],
      trendsFilter: { display: 'ActionsLineGraphCumulative' },
    },
  },
  {
    name: 'Cross-genre Users (Numerator)',
    description: 'ジャンル横断率の分子。distinct_media_types_count >= 2 の unique user 数',
    query: {
      kind: 'TrendsQuery',
      series: [{ event: '$pageview', math: 'dau', name: 'cross-genre users' }],
      properties: {
        type: 'AND',
        values: [
          {
            type: 'person',
            key: 'distinct_media_types_count',
            operator: 'gte',
            value: 2,
          },
        ],
      },
    },
  },
  {
    name: 'All Identified Users (Denominator)',
    description: 'ジャンル横断率の分母。identify 済み全 unique user 数',
    query: {
      kind: 'TrendsQuery',
      series: [{ event: '$pageview', math: 'dau', name: 'identified users' }],
      properties: {
        type: 'AND',
        values: [
          {
            type: 'person',
            key: 'distinct_media_types_count',
            operator: 'is_set',
          },
        ],
      },
    },
  },
  {
    name: 'Funnel: Signup to First Record',
    description: '登録→初回記録ファネル（14日間ウィンドウ）',
    query: {
      kind: 'FunnelsQuery',
      series: [
        { event: 'signup_completed', order: 0 },
        { event: 'record_created', order: 1 },
      ],
      funnelsFilter: { funnelWindowInterval: 14, funnelWindowIntervalUnit: 'day' },
    },
  },
  {
    name: 'Funnel: Search to Record Created',
    description: '検索→記録作成ファネル（30分以内）',
    query: {
      kind: 'FunnelsQuery',
      series: [
        { event: 'search_performed', order: 0 },
        { event: 'record_created', order: 1 },
      ],
      funnelsFilter: { funnelWindowInterval: 30, funnelWindowIntervalUnit: 'minute' },
    },
  },
  {
    name: 'Retention (Day 1/7/30)',
    description: '継続率。$pageview ベースの retention',
    query: {
      kind: 'RetentionQuery',
      retentionFilter: {
        targetEntity: { id: '$pageview', type: 'events' },
        returningEntity: { id: '$pageview', type: 'events' },
        period: 'Day',
      },
    },
  },
  {
    name: 'Status Transition Distribution',
    description: 'ステータス遷移の分布。from_status × to_status でブレイクダウン',
    query: {
      kind: 'TrendsQuery',
      series: [{ event: 'record_status_changed', math: 'total' }],
      breakdownFilter: {
        breakdown: ['from_status', 'to_status'],
        breakdown_type: 'event',
      },
    },
  },
  {
    name: 'Records by Media Type',
    description: 'メディアタイプ別の記録件数',
    query: {
      kind: 'TrendsQuery',
      series: [{ event: 'record_created', math: 'total' }],
      breakdownFilter: {
        breakdown: 'media_type',
        breakdown_type: 'event',
      },
    },
  },
]
