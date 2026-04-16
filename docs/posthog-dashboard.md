# PostHog Dashboard 運用メモ

Recolly の計測基盤で使っている Dashboard「Recolly Main Dashboard」の内容と運用メモ。

**Spec**: `docs/superpowers/specs/2026-04-17-analytics-phase2-dashboard-design.md`
**作成スクリプト**: `scripts/posthog/sync-dashboard.ts`

## Dashboard 構成（9 本の Insight）

| #   | Insight 名                         | 種別               | 何を見るか                                     |
| --- | ---------------------------------- | ------------------ | ---------------------------------------------- |
| 1   | Active Users (DAU/WAU/MAU)         | Trends             | 日次・週次・月次のアクティブユーザー推移       |
| 2   | Cumulative Records Created         | Trends             | 累計記録件数の推移                             |
| 3-a | Cross-genre Users (Numerator)      | Trends             | ジャンル横断ユーザー（2 種以上記録）の数       |
| 3-b | All Identified Users (Denominator) | Trends             | identify 済み全ユーザー数                      |
| 4   | Funnel: Signup to First Record     | Funnel             | 登録 → 初回記録のアクティベーション率          |
| 5   | Funnel: Search to Record Created   | Funnel             | 検索 → 記録作成のコンバージョン率（30分以内）  |
| 6   | Retention (Day 1/7/30)             | Retention          | 継続率                                         |
| 7   | Status Transition Distribution     | Trends (breakdown) | ステータス遷移の分布（途中挫折・完了パターン） |
| 8   | Records by Media Type              | Trends (breakdown) | メディア種別ごとの記録件数                     |

## ジャンル横断率の見方

Insight #3-a と #3-b を割り算する。例:

- #3-a = 50、#3-b = 200 → ジャンル横断率 = 25%

目標値: 30% 以上を維持したい（Recolly の差別化の動かぬ証拠）。

## 更新方法

Insight の定義を変えたい場合:

1. `scripts/posthog/insights.ts` を編集
2. `cd scripts/posthog && npm run sync` を実行
3. PostHog UI で反映を確認

Dashboard の name を変える場合は、旧 Dashboard を UI から削除してからスクリプトを実行する（べき等性は name ベースのため）。

## 注意

- Personal API Key は `.env.local` のみ。Git や CI には入れない（spec §5.4）
- Dashboard / Insight を UI から手動編集した場合、次回 `sync` で上書きされる可能性あり。手動編集は避ける
- PostHog の query 形式は API バージョンで差異がある。初回 sync で 4xx エラーが出た場合は、UI から該当 Insight をエクスポートして `insights.ts` に貼り付けるのが確実
