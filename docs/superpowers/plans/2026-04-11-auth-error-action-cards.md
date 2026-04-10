# 認証エラー時のアクション誘導カード 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OAuthButtons と AccountSettingsPage のエラー表示にアクションボタン付きカード（ActionErrorCard）を追加し、ユーザーが次に取るべき操作を明示する。

**Architecture:** 共通コンポーネント `ActionErrorCard` を `components/ui/` に作成し、OAuthButtons（#113）と AccountSettingsPage（#114）の両方から使う。各コンポーネントでは `ApiError.code` を保持するよう state を拡張し、エラーコード別にカード表示を分岐する。

**Tech Stack:** React 19 / TypeScript / Vitest + React Testing Library / CSS Modules + tokens.css

---

## ファイル構成

| 区分 | ファイル | 役割 |
|------|---------|------|
| 新規作成 | `frontend/src/components/ui/ActionErrorCard/ActionErrorCard.tsx` | 共通エラーカードコンポーネント |
| 新規作成 | `frontend/src/components/ui/ActionErrorCard/ActionErrorCard.module.css` | カードのスタイル |
| 新規作成 | `frontend/src/components/ui/ActionErrorCard/ActionErrorCard.test.tsx` | 単体テスト |
| 変更 | `frontend/src/components/OAuthButtons/OAuthButtons.tsx` | error stateを拡張、ActionErrorCard表示 |
| 変更 | `frontend/src/components/OAuthButtons/OAuthButtons.test.tsx` | エラーコード別テスト追加 |
| 変更 | `frontend/src/pages/AccountSettingsPage/useAccountSettings.ts` | providerErrorを型拡張 |
| 変更 | `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.tsx` | ActionErrorCard表示、パスワードフォームにid付与 |
| 変更 | `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.test.tsx` | 連携解除失敗テスト追加 |
| 変更 | `frontend/src/pages/LoginPage/LoginPage.tsx` | メールフォームにid付与 |

---

### Task 1: ActionErrorCard コンポーネント作成

**Files:**
- Create: `frontend/src/components/ui/ActionErrorCard/ActionErrorCard.test.tsx`
- Create: `frontend/src/components/ui/ActionErrorCard/ActionErrorCard.tsx`
- Create: `frontend/src/components/ui/ActionErrorCard/ActionErrorCard.module.css`

- [ ] **Step 1: テストファイルを作成**

```tsx
// frontend/src/components/ui/ActionErrorCard/ActionErrorCard.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ActionErrorCard } from './ActionErrorCard'

describe('ActionErrorCard', () => {
  it('タイトルとメッセージが表示される', () => {
    render(<ActionErrorCard title="エラータイトル" message="エラーの説明文" />)

    expect(screen.getByText('エラータイトル')).toBeInTheDocument()
    expect(screen.getByText('エラーの説明文')).toBeInTheDocument()
  })

  it('actionLabelを渡すとボタンが表示される', () => {
    render(
      <ActionErrorCard
        title="タイトル"
        message="メッセージ"
        actionLabel="アクションボタン"
        onAction={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'アクションボタン' })).toBeInTheDocument()
  })

  it('actionLabelを渡さないとボタンが表示されない', () => {
    render(<ActionErrorCard title="タイトル" message="メッセージ" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('ボタンクリックでonActionが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleAction = vi.fn()

    render(
      <ActionErrorCard
        title="タイトル"
        message="メッセージ"
        actionLabel="クリック"
        onAction={handleAction}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'クリック' }))
    expect(handleAction).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd frontend && npx vitest run src/components/ui/ActionErrorCard/ActionErrorCard.test.tsx`
Expected: FAIL（ActionErrorCard モジュールが存在しない）

- [ ] **Step 3: コンポーネントを実装**

```tsx
// frontend/src/components/ui/ActionErrorCard/ActionErrorCard.tsx
import { Button } from '../Button/Button'
import styles from './ActionErrorCard.module.css'

type ActionErrorCardProps = {
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export function ActionErrorCard({ title, message, actionLabel, onAction }: ActionErrorCardProps) {
  return (
    <div className={styles.card} role="alert">
      <p className={styles.title}>{title}</p>
      <p className={styles.message}>{message}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: CSSモジュールを作成**

```css
/* frontend/src/components/ui/ActionErrorCard/ActionErrorCard.module.css */
.card {
  background-color: var(--color-error-bg);
  border: var(--border-width-thin) var(--border-style) var(--color-error);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-top: var(--spacing-sm);
}

.title {
  color: var(--color-error);
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-medium);
  margin: 0 0 var(--spacing-xs) 0;
}

.message {
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  line-height: var(--line-height-normal);
  margin: 0 0 var(--spacing-sm) 0;
}

.message:last-child {
  margin-bottom: 0;
}
```

- [ ] **Step 5: テストを実行してパスを確認**

Run: `cd frontend && npx vitest run src/components/ui/ActionErrorCard/ActionErrorCard.test.tsx`
Expected: 4 tests PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ui/ActionErrorCard/
git commit -m "feat(frontend): ActionErrorCard 共通コンポーネントを追加

エラーメッセージ + タイトル + アクションボタンを表示する汎用カード。
OAuthButtons と AccountSettingsPage のエラー誘導に使用する。

refs #113, #114"
```

---

### Task 2: OAuthButtons にエラーコード別の ActionErrorCard を組み込む (#113)

**Files:**
- Modify: `frontend/src/components/OAuthButtons/OAuthButtons.tsx`
- Modify: `frontend/src/components/OAuthButtons/OAuthButtons.test.tsx`
- Modify: `frontend/src/pages/LoginPage/LoginPage.tsx`

- [ ] **Step 1: OAuthButtons テストにエラーコード別のケースを追加**

`OAuthButtons.test.tsx` の `sign_inモード` describe ブロック末尾に以下を追加:

```tsx
    it('email_already_registered エラー時に ActionErrorCard が表示される', async () => {
      const { triggerCallback } = setupGoogleSdkMock()
      mockSignIn.mockRejectedValue(
        new ApiError(
          'このメールアドレスは既にメール+パスワードで登録されています。メールでログインしてください',
          409,
          'email_already_registered',
        ),
      )

      renderWithProviders(<OAuthButtons />)
      await waitFor(() => expect(window.google).toBeDefined())
      triggerCallback('dummy-id-token')

      await waitFor(() => {
        expect(screen.getByText('ログイン方法が異なります')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'メールでログイン' })).toBeInTheDocument()
      })
    })

    it('email_registered_with_other_provider エラー時に ActionErrorCard が表示される（ボタンなし）', async () => {
      const { triggerCallback } = setupGoogleSdkMock()
      mockSignIn.mockRejectedValue(
        new ApiError(
          'このメールアドレスは既にGoogleで登録されています',
          409,
          'email_registered_with_other_provider',
        ),
      )

      renderWithProviders(<OAuthButtons />)
      await waitFor(() => expect(window.google).toBeDefined())
      triggerCallback('dummy-id-token')

      await waitFor(() => {
        expect(screen.getByText('別のアカウントで登録済みです')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'メールでログイン' })).not.toBeInTheDocument()
      })
    })

    it('その他のエラーは従来通りテキスト表示', async () => {
      const { triggerCallback } = setupGoogleSdkMock()
      mockSignIn.mockRejectedValue(new ApiError('不明なエラー', 500))

      renderWithProviders(<OAuthButtons />)
      await waitFor(() => expect(window.google).toBeDefined())
      triggerCallback('dummy-id-token')

      await waitFor(() => {
        expect(screen.getByText('不明なエラー')).toBeInTheDocument()
        expect(screen.queryByText('ログイン方法が異なります')).not.toBeInTheDocument()
      })
    })
```

- [ ] **Step 2: テストを実行して新規テストの失敗を確認**

Run: `cd frontend && npx vitest run src/components/OAuthButtons/OAuthButtons.test.tsx`
Expected: 新規3テストが FAIL（ActionErrorCard のタイトルが表示されないため）

- [ ] **Step 3: OAuthButtons.tsx を変更**

`frontend/src/components/OAuthButtons/OAuthButtons.tsx` を以下のように変更:

1. import に `ActionErrorCard` を追加:
```tsx
import { ActionErrorCard } from '../ui/ActionErrorCard/ActionErrorCard'
```

2. error state の型を変更（L34）:
```tsx
// 変更前:
const [error, setError] = useState<string | null>(null)

// 変更後:
const [error, setError] = useState<{ message: string; code?: string } | null>(null)
```

3. SDK読み込みエラーの setError を修正（L55）:
```tsx
// 変更前:
setError('Googleログインの読み込みに失敗しました。ページを再読み込みしてください')

// 変更後:
setError({ message: 'Googleログインの読み込みに失敗しました。ページを再読み込みしてください' })
```

4. CLIENT_ID 未定義エラーの setError を修正（L69）:
```tsx
// 変更前:
setError('Googleログインが設定されていません（VITE_GOOGLE_CLIENT_ID 未定義）')

// 変更後:
setError({ message: 'Googleログインが設定されていません（VITE_GOOGLE_CLIENT_ID 未定義）' })
```

5. catch ブロック（L108-114）を変更:
```tsx
    } catch (err) {
      if (err instanceof ApiError) {
        const errorInfo = { message: err.message, code: err.code }
        if (mode === 'link') {
          onLinkError?.(err.message)
        } else {
          setError(errorInfo)
        }
      } else {
        const errorInfo = { message: 'ログインに失敗しました' }
        if (mode === 'link') {
          onLinkError?.(errorInfo.message)
        } else {
          setError(errorInfo)
        }
      }
    }
```

6. handleSignIn の error ケース（L131-132）を変更:
```tsx
      case 'error':
        setError({ message: data.message, code: data.code })
        break
```

7. Props に `onScrollToEmailForm` を追加（L14-20）:
```tsx
type OAuthButtonsProps = {
  mode?: 'sign_in' | 'link'
  onLinkSuccess?: (user: User) => void
  onLinkError?: (message: string) => void
  onScrollToEmailForm?: () => void
}
```

8. コンポーネント引数にも追加（L27-31）:
```tsx
export function OAuthButtons({
  mode = 'sign_in',
  onLinkSuccess,
  onLinkError,
  onScrollToEmailForm,
}: OAuthButtonsProps = {}) {
```

9. JSX のエラー表示部分（L150）を変更:
```tsx
      {error && error.code === 'email_already_registered' && (
        <ActionErrorCard
          title="ログイン方法が異なります"
          message={error.message}
          actionLabel="メールでログイン"
          onAction={onScrollToEmailForm}
        />
      )}
      {error && error.code === 'email_registered_with_other_provider' && (
        <ActionErrorCard
          title="別のアカウントで登録済みです"
          message={error.message}
        />
      )}
      {error && !error.code?.match(/^(email_already_registered|email_registered_with_other_provider)$/) && (
        <p className={styles.error}>{error.message}</p>
      )}
```

- [ ] **Step 4: LoginPage.tsx にメールフォームの id とスクロールコールバックを追加**

`frontend/src/pages/LoginPage/LoginPage.tsx` を変更:

1. `<form>` タグに id を追加（L70）:
```tsx
// 変更前:
<form className={styles.form} onSubmit={handleSubmit}>

// 変更後:
<form id="email-login-form" className={styles.form} onSubmit={handleSubmit}>
```

2. `<OAuthButtons />` にコールバックを渡す（L139）:
```tsx
// 変更前:
<OAuthButtons />

// 変更後:
<OAuthButtons
  onScrollToEmailForm={() => {
    const form = document.getElementById('email-login-form')
    if (form) {
      form.scrollIntoView({ behavior: 'smooth' })
      const emailInput = form.querySelector<HTMLInputElement>('input[type="email"]')
      emailInput?.focus({ preventScroll: true })
    }
  }}
/>
```

- [ ] **Step 5: テストを実行してパスを確認**

Run: `cd frontend && npx vitest run src/components/OAuthButtons/OAuthButtons.test.tsx`
Expected: 全テスト PASS

- [ ] **Step 6: 既存テストに影響がないか確認**

Run: `cd frontend && npx vitest run src/pages/LoginPage/LoginPage.test.tsx`
Expected: 全テスト PASS

- [ ] **Step 7: コミット**

```bash
git add frontend/src/components/OAuthButtons/OAuthButtons.tsx \
       frontend/src/components/OAuthButtons/OAuthButtons.test.tsx \
       frontend/src/pages/LoginPage/LoginPage.tsx
git commit -m "feat(frontend): OAuthButtons にエラーコード別 ActionErrorCard を追加

- email_already_registered: 「メールでログイン」ボタン付きカード表示
- email_registered_with_other_provider: プロバイダ名明示カード表示
- その他のエラー: 従来通りテキスト表示
- LoginPage のメールフォームへスクロール＆フォーカス

closes #113"
```

---

### Task 3: AccountSettingsPage に連携解除失敗時の ActionErrorCard を組み込む (#114)

**Files:**
- Modify: `frontend/src/pages/AccountSettingsPage/useAccountSettings.ts`
- Modify: `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.tsx`
- Modify: `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.test.tsx`

- [ ] **Step 1: AccountSettingsPage テストに連携解除失敗ケースを追加**

`AccountSettingsPage.test.tsx` に以下の import と変数を追加:

1. import に `userEvent` と `waitFor` を追加（L1）:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
```

2. API モック定義を変更して `accountApi.unlinkProvider` にアクセスできるようにする（L8-25 を置換）:
```tsx
// APIモック
const mockUnlinkProvider = vi.fn()
const mockSetPassword = vi.fn()

vi.mock('../../lib/api', () => ({
  accountApi: {
    unlinkProvider: (...args: unknown[]) => mockUnlinkProvider(...args),
    setPassword: (...args: unknown[]) => mockSetPassword(...args),
  },
  googleAuthApi: {
    signIn: vi.fn(),
    linkProvider: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number
    code?: string
    constructor(message: string, status: number, code?: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.code = code
    }
  },
}))
```

3. `describe('AccountSettingsPage')` ブロック末尾に以下のテストを追加:

```tsx
  it('連携解除失敗時（last_login_method）に ActionErrorCard が表示される', async () => {
    const user = userEvent.setup()
    mockUser = createUser({ providers: ['google_oauth2'], has_password: true })
    // unlinkProvider が last_login_method エラーを返す
    const { ApiError: MockApiError } = await import('../../lib/api')
    mockUnlinkProvider.mockRejectedValue(
      new MockApiError(
        '最後のログイン手段は解除できません。先にパスワードを設定するか、別のOAuthを連携してください',
        422,
        'last_login_method',
      ),
    )

    renderPage()

    // 「解除」ボタンをクリック
    const unlinkButton = screen.getByRole('button', { name: '解除' })
    await user.click(unlinkButton)

    await waitFor(() => {
      expect(screen.getByText('解除できません')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'パスワードを設定する' }),
      ).toBeInTheDocument()
    })
  })

  it('連携解除失敗時（その他エラー）は従来通りテキスト表示', async () => {
    const user = userEvent.setup()
    mockUser = createUser({ providers: ['google_oauth2'], has_password: true })
    const { ApiError: MockApiError } = await import('../../lib/api')
    mockUnlinkProvider.mockRejectedValue(
      new MockApiError('サーバーエラー', 500),
    )

    renderPage()

    const unlinkButton = screen.getByRole('button', { name: '解除' })
    await user.click(unlinkButton)

    await waitFor(() => {
      expect(screen.getByText('サーバーエラー')).toBeInTheDocument()
      expect(screen.queryByText('解除できません')).not.toBeInTheDocument()
    })
  })
```

- [ ] **Step 2: テストを実行して新規テストの失敗を確認**

Run: `cd frontend && npx vitest run src/pages/AccountSettingsPage/AccountSettingsPage.test.tsx`
Expected: 新規2テストが FAIL

- [ ] **Step 3: useAccountSettings.ts の providerError 型を拡張**

`frontend/src/pages/AccountSettingsPage/useAccountSettings.ts` を変更:

1. providerError の型を変更（L19）:
```tsx
// 変更前:
const [providerError, setProviderError] = useState('')

// 変更後:
const [providerError, setProviderError] = useState<{
  message: string
  code?: string
} | null>(null)
```

2. handleUnlinkProvider のエラーリセット（L27）を変更:
```tsx
// 変更前:
setProviderError('')

// 変更後:
setProviderError(null)
```

3. catch ブロック（L33-36）を変更:
```tsx
    } catch (err) {
      if (err instanceof ApiError) {
        setProviderError({ message: err.message, code: err.code })
      } else {
        setProviderError({ message: '連携解除に失敗しました' })
      }
    }
```

- [ ] **Step 4: AccountSettingsPage.tsx に ActionErrorCard を組み込む**

`frontend/src/pages/AccountSettingsPage/AccountSettingsPage.tsx` を変更:

1. import に ActionErrorCard を追加（L1付近）:
```tsx
import { ActionErrorCard } from '../../components/ui/ActionErrorCard/ActionErrorCard'
```

2. エラー表示部分（L43）を変更:
```tsx
// 変更前:
{providerError && <p className={styles.error}>{providerError}</p>}

// 変更後:
{providerError && providerError.code === 'last_login_method' && (
  <ActionErrorCard
    title="解除できません"
    message={providerError.message}
    actionLabel="パスワードを設定する"
    onAction={() => {
      const form = document.getElementById('password-form')
      if (form) {
        form.scrollIntoView({ behavior: 'smooth' })
        const input = form.querySelector<HTMLInputElement>('input[type="password"]')
        input?.focus({ preventScroll: true })
      }
    }}
  />
)}
{providerError && providerError.code !== 'last_login_method' && (
  <p className={styles.error}>{providerError.message}</p>
)}
```

3. パスワードセクションの form に id を追加（L101）:
```tsx
// 変更前:
<form className={styles.form} onSubmit={handlePasswordSubmit}>

// 変更後:
<form id="password-form" className={styles.form} onSubmit={handlePasswordSubmit}>
```

4. onLinkError コールバックを更新（L89）:
```tsx
// 変更前:
onLinkError={(message) => setProviderError(message)}

// 変更後:
onLinkError={(message) => setProviderError({ message })}
```

- [ ] **Step 5: テストを実行してパスを確認**

Run: `cd frontend && npx vitest run src/pages/AccountSettingsPage/AccountSettingsPage.test.tsx`
Expected: 全テスト PASS

- [ ] **Step 6: 全テストを実行して回帰がないか確認**

Run: `cd frontend && npx vitest run`
Expected: 全テスト PASS

- [ ] **Step 7: ESLint を実行**

Run: `cd frontend && npx eslint src/components/ui/ActionErrorCard/ src/components/OAuthButtons/ src/pages/AccountSettingsPage/ src/pages/LoginPage/`
Expected: エラーなし

- [ ] **Step 8: コミット**

```bash
git add frontend/src/pages/AccountSettingsPage/useAccountSettings.ts \
       frontend/src/pages/AccountSettingsPage/AccountSettingsPage.tsx \
       frontend/src/pages/AccountSettingsPage/AccountSettingsPage.test.tsx
git commit -m "feat(frontend): AccountSettingsPage に連携解除失敗時の ActionErrorCard を追加

- last_login_method エラー時に「パスワードを設定する」ボタン付きカード表示
- ボタンクリックでパスワード設定フォームにスクロール＆フォーカス
- その他のエラーは従来通りテキスト表示

closes #114"
```
