import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { capturePageview } from '../../lib/analytics/posthog'

/**
 * React Router の location 変化を監視して PostHog に $pageview を送る。
 *
 * PostHog SDK の capture_pageview は初回ロードしか拾えないので、
 * SPA 遷移ではここで手動発火する。初回マウント時もこの useEffect が走るため、
 * SDK 側の自動 pageview は init 時に無効化してある。
 *
 * BrowserRouter の子孫として配置する必要がある（useLocation を使うため）。
 */
export function PageviewTracker(): null {
  const location = useLocation()

  useEffect(() => {
    capturePageview(location.pathname + location.search)
  }, [location.pathname, location.search])

  return null
}
