import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { initAnalytics } from './lib/analytics/posthog'

// PostHog 初期化。環境変数が未設定ならサイレントに no-op
// (ローカル開発で .env.local が空でも壊さない設計)
initAnalytics({
  key: import.meta.env.VITE_POSTHOG_KEY as string | undefined,
  host: import.meta.env.VITE_POSTHOG_HOST as string | undefined,
})

// PWA の Service Worker を自動更新モードで登録する。
// registerType: 'autoUpdate' と immediate: true の組み合わせで、
// 新バージョン検知時に確認プロンプトなしで即座に更新・リロードされる。
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
