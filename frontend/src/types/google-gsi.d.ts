// Google Identity Services (ADR-0035) の型定義
// 公式SDK（accounts.google.com/gsi/client）が提供する `window.google.accounts.id` の型を宣言する
// SDKは非同期読み込みなので `window.google` は undefined になりうる（ランタイムでガード必須）

export interface GoogleCredentialResponse {
  credential: string
  select_by: string
  client_id: string
}

export interface GoogleIdConfiguration {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  use_fedcm_for_prompt?: boolean
}

export interface GoogleButtonConfiguration {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
  locale?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfiguration) => void
          renderButton: (element: HTMLElement, config: GoogleButtonConfiguration) => void
          prompt: () => void
          disableAutoSelect: () => void
          cancel: () => void
        }
      }
    }
  }
}

export {}
