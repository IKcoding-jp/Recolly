import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initAnalytics } from './lib/analytics/posthog'

// PostHog 初期化。環境変数が未設定ならサイレントに no-op
// (ローカル開発で .env.local が空でも壊さない設計)
initAnalytics({
  key: import.meta.env.VITE_POSTHOG_KEY as string | undefined,
  host: import.meta.env.VITE_POSTHOG_HOST as string | undefined,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
