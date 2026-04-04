# UI一貫性統一 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ページ間のUI差異を統一し、CLAUDE.md強化で今後の再発を防止する

**Architecture:** tokens.cssにborder-radiusトークンを追加 → 共通フォームコンポーネント（FormInput, FormSelect, FormTextarea）を作成 → 全ページのフォーム要素を共通コンポーネントに置き換え → 既存ハードコード値をトークンに置き換え → CLAUDE.mdにUI一貫性ルールを追加

**Tech Stack:** React 19 / TypeScript / CSS Modules / Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-04-05-ui-consistency-design.md`
**Issue:** #97

---

### Task 1: tokens.css に border-radius トークンを追加

**Files:**
- Modify: `frontend/src/styles/tokens.css`

- [ ] **Step 1: tokens.css にトークンを追加**

`frontend/src/styles/tokens.css` の `/* --- ボーダー --- */` セクションの末尾（67行目の後）に追加:

```css
  /* --- 角丸 --- */
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-full: 9999px;
```

- [ ] **Step 2: コミット**

```bash
git add frontend/src/styles/tokens.css
git commit -m "feat: tokens.cssにborder-radiusトークンを追加 (#97)"
```

---

### Task 2: FormInput コンポーネントを作成

**Files:**
- Create: `frontend/src/components/ui/FormInput/FormInput.tsx`
- Create: `frontend/src/components/ui/FormInput/FormInput.module.css`
- Create: `frontend/src/components/ui/FormInput/FormInput.test.tsx`

- [ ] **Step 1: テストファイルを作成**

`frontend/src/components/ui/FormInput/FormInput.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormInput } from './FormInput'

describe('FormInput', () => {
  it('ラベルが表示される', () => {
    render(<FormInput label="メールアドレス" value="" onChange={() => {}} />)
    expect(screen.getByText('メールアドレス')).toBeInTheDocument()
  })

  it('入力値が反映される', () => {
    render(<FormInput label="メール" value="test@example.com" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('test@example.com')
  })

  it('onChangeが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<FormInput label="メール" value="" onChange={handleChange} />)
    await user.type(screen.getByRole('textbox'), 'a')
    expect(handleChange).toHaveBeenCalled()
  })

  it('placeholderが表示される', () => {
    render(
      <FormInput label="メール" value="" onChange={() => {}} placeholder="入力してください" />,
    )
    expect(screen.getByPlaceholderText('入力してください')).toBeInTheDocument()
  })

  it('エラーメッセージが表示される', () => {
    render(<FormInput label="メール" value="" onChange={() => {}} error="必須項目です" />)
    expect(screen.getByText('必須項目です')).toBeInTheDocument()
  })

  it('required属性が設定される', () => {
    render(<FormInput label="メール" value="" onChange={() => {}} required />)
    expect(screen.getByRole('textbox')).toBeRequired()
  })

  it('type属性が設定される', () => {
    render(<FormInput label="パスワード" value="" onChange={() => {}} type="password" />)
    // password型はtextboxロールではないのでidで取得
    const input = document.querySelector('input[type="password"]')
    expect(input).toBeInTheDocument()
  })

  it('autoComplete属性が設定される', () => {
    render(<FormInput label="メール" value="" onChange={() => {}} autoComplete="email" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('autocomplete', 'email')
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec frontend npx vitest run src/components/ui/FormInput/FormInput.test.tsx`
Expected: FAIL（FormInputが存在しない）

- [ ] **Step 3: CSSファイルを作成**

`frontend/src/components/ui/FormInput/FormInput.module.css`:

```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.label {
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  font-weight: 600;
  color: var(--color-text);
}

.input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) var(--border-style) var(--color-text);
  border-radius: var(--radius-none);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  color: var(--color-text);
  background-color: var(--color-bg);
  transition: border-color var(--transition-fast);
}

.input:focus {
  outline: none;
  border-color: var(--color-text);
}

.inputError {
  border-color: var(--color-error);
}

.error {
  color: var(--color-error);
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
}
```

- [ ] **Step 4: コンポーネントを作成**

`frontend/src/components/ui/FormInput/FormInput.tsx`:

```tsx
import type { InputHTMLAttributes } from 'react'
import styles from './FormInput.module.css'

type FormInputProps = {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  error?: string
  className?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'value' | 'onChange'>

export function FormInput({
  label,
  value,
  onChange,
  error,
  className,
  id,
  ...rest
}: FormInputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  const inputClasses = [styles.input, error ? styles.inputError : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input id={inputId} className={inputClasses} value={value} onChange={onChange} {...rest} />
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
```

- [ ] **Step 5: テストを実行して全てパスすることを確認**

Run: `docker compose exec frontend npx vitest run src/components/ui/FormInput/FormInput.test.tsx`
Expected: PASS（8テスト全て）

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ui/FormInput/
git commit -m "feat: FormInput共通コンポーネントを作成 (#97)"
```

---

### Task 3: FormSelect コンポーネントを作成

**Files:**
- Create: `frontend/src/components/ui/FormSelect/FormSelect.tsx`
- Create: `frontend/src/components/ui/FormSelect/FormSelect.module.css`
- Create: `frontend/src/components/ui/FormSelect/FormSelect.test.tsx`

- [ ] **Step 1: テストファイルを作成**

`frontend/src/components/ui/FormSelect/FormSelect.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormSelect } from './FormSelect'

const OPTIONS = [
  { value: 'all', label: 'すべて' },
  { value: 'anime', label: 'アニメ' },
  { value: 'movie', label: '映画' },
]

describe('FormSelect', () => {
  it('ラベルが表示される', () => {
    render(<FormSelect label="ジャンル" value="all" onChange={() => {}} options={OPTIONS} />)
    expect(screen.getByText('ジャンル')).toBeInTheDocument()
  })

  it('選択肢が表示される', () => {
    render(<FormSelect label="ジャンル" value="all" onChange={() => {}} options={OPTIONS} />)
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('すべて')).toBeInTheDocument()
    expect(screen.getByText('アニメ')).toBeInTheDocument()
    expect(screen.getByText('映画')).toBeInTheDocument()
  })

  it('選択値が反映される', () => {
    render(<FormSelect label="ジャンル" value="anime" onChange={() => {}} options={OPTIONS} />)
    expect(screen.getByRole('combobox')).toHaveValue('anime')
  })

  it('onChangeが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<FormSelect label="ジャンル" value="all" onChange={handleChange} options={OPTIONS} />)
    await user.selectOptions(screen.getByRole('combobox'), 'anime')
    expect(handleChange).toHaveBeenCalled()
  })

  it('エラーメッセージが表示される', () => {
    render(
      <FormSelect
        label="ジャンル"
        value="all"
        onChange={() => {}}
        options={OPTIONS}
        error="選択してください"
      />,
    )
    expect(screen.getByText('選択してください')).toBeInTheDocument()
  })

  it('ラベルなしで使用できる', () => {
    render(<FormSelect value="all" onChange={() => {}} options={OPTIONS} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec frontend npx vitest run src/components/ui/FormSelect/FormSelect.test.tsx`
Expected: FAIL（FormSelectが存在しない）

- [ ] **Step 3: CSSファイルを作成**

`frontend/src/components/ui/FormSelect/FormSelect.module.css`:

```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.label {
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  font-weight: 600;
  color: var(--color-text);
}

.select {
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) var(--border-style) var(--color-text);
  border-radius: var(--radius-none);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  color: var(--color-text);
  background-color: var(--color-bg);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.select:focus {
  outline: none;
  border-color: var(--color-text);
}

.selectError {
  border-color: var(--color-error);
}

.error {
  color: var(--color-error);
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
}
```

- [ ] **Step 4: コンポーネントを作成**

`frontend/src/components/ui/FormSelect/FormSelect.tsx`:

```tsx
import type { SelectHTMLAttributes } from 'react'
import styles from './FormSelect.module.css'

type SelectOption = {
  value: string
  label: string
}

type FormSelectProps = {
  label?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: SelectOption[]
  error?: string
  className?: string
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'value' | 'onChange'>

export function FormSelect({
  label,
  value,
  onChange,
  options,
  error,
  className,
  id,
  ...rest
}: FormSelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const selectClasses = [styles.select, error ? styles.selectError : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={selectId} className={styles.label}>
          {label}
        </label>
      )}
      <select id={selectId} className={selectClasses} value={value} onChange={onChange} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
```

- [ ] **Step 5: テストを実行して全てパスすることを確認**

Run: `docker compose exec frontend npx vitest run src/components/ui/FormSelect/FormSelect.test.tsx`
Expected: PASS（6テスト全て）

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ui/FormSelect/
git commit -m "feat: FormSelect共通コンポーネントを作成 (#97)"
```

---

### Task 4: FormTextarea コンポーネントを作成

**Files:**
- Create: `frontend/src/components/ui/FormTextarea/FormTextarea.tsx`
- Create: `frontend/src/components/ui/FormTextarea/FormTextarea.module.css`
- Create: `frontend/src/components/ui/FormTextarea/FormTextarea.test.tsx`

- [ ] **Step 1: テストファイルを作成**

`frontend/src/components/ui/FormTextarea/FormTextarea.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormTextarea } from './FormTextarea'

describe('FormTextarea', () => {
  it('ラベルが表示される', () => {
    render(<FormTextarea label="感想" value="" onChange={() => {}} />)
    expect(screen.getByText('感想')).toBeInTheDocument()
  })

  it('入力値が反映される', () => {
    render(<FormTextarea label="感想" value="面白かった" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('面白かった')
  })

  it('onChangeが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<FormTextarea label="感想" value="" onChange={handleChange} />)
    await user.type(screen.getByRole('textbox'), 'a')
    expect(handleChange).toHaveBeenCalled()
  })

  it('placeholderが表示される', () => {
    render(
      <FormTextarea label="感想" value="" onChange={() => {}} placeholder="感想を書く..." />,
    )
    expect(screen.getByPlaceholderText('感想を書く...')).toBeInTheDocument()
  })

  it('デフォルトのrowsが4である', () => {
    render(<FormTextarea label="感想" value="" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '4')
  })

  it('rowsを指定できる', () => {
    render(<FormTextarea label="感想" value="" onChange={() => {}} rows={6} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '6')
  })

  it('エラーメッセージが表示される', () => {
    render(<FormTextarea label="感想" value="" onChange={() => {}} error="入力してください" />)
    expect(screen.getByText('入力してください')).toBeInTheDocument()
  })

  it('ラベルなしで使用できる', () => {
    render(<FormTextarea value="" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec frontend npx vitest run src/components/ui/FormTextarea/FormTextarea.test.tsx`
Expected: FAIL（FormTextareaが存在しない）

- [ ] **Step 3: CSSファイルを作成**

`frontend/src/components/ui/FormTextarea/FormTextarea.module.css`:

```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.label {
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  font-weight: 600;
  color: var(--color-text);
}

.textarea {
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) var(--border-style) var(--color-text);
  border-radius: var(--radius-none);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  color: var(--color-text);
  background-color: var(--color-bg);
  resize: vertical;
  transition: border-color var(--transition-fast);
}

.textarea:focus {
  outline: none;
  border-color: var(--color-text);
}

.textareaError {
  border-color: var(--color-error);
}

.error {
  color: var(--color-error);
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
}
```

- [ ] **Step 4: コンポーネントを作成**

`frontend/src/components/ui/FormTextarea/FormTextarea.tsx`:

```tsx
import type { TextareaHTMLAttributes } from 'react'
import styles from './FormTextarea.module.css'

type FormTextareaProps = {
  label?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  rows?: number
  error?: string
  className?: string
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'value' | 'onChange' | 'rows'>

export function FormTextarea({
  label,
  value,
  onChange,
  rows = 4,
  error,
  className,
  id,
  ...rest
}: FormTextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const textareaClasses = [styles.textarea, error ? styles.textareaError : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={textareaId} className={styles.label}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={textareaClasses}
        value={value}
        onChange={onChange}
        rows={rows}
        {...rest}
      />
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
```

- [ ] **Step 5: テストを実行して全てパスすることを確認**

Run: `docker compose exec frontend npx vitest run src/components/ui/FormTextarea/FormTextarea.test.tsx`
Expected: PASS（8テスト全て）

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ui/FormTextarea/
git commit -m "feat: FormTextarea共通コンポーネントを作成 (#97)"
```

---

### Task 5: LoginPage を FormInput に置き換え

**Files:**
- Modify: `frontend/src/pages/LoginPage/LoginPage.tsx`

- [ ] **Step 1: LoginPage.tsx を修正**

変更内容:
- `import styles from '../../styles/authForm.module.css'` は残す（page, card, form, link, error クラスをまだ使うため）
- `<div className={styles.field}>` + `<label>` + `<input>` のブロックを `<FormInput>` に置き換え

変更前（56-76行目）:
```tsx
          <div className={styles.field}>
            <label htmlFor="email">メールアドレス</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
```

変更後:
```tsx
          <FormInput
            label="メールアドレス"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <FormInput
            label="パスワード"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
```

import文に追加:
```tsx
import { FormInput } from '../../components/ui/FormInput/FormInput'
```

- [ ] **Step 2: 既存テストがパスすることを確認**

Run: `docker compose exec frontend npx vitest run src/pages/LoginPage/`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add frontend/src/pages/LoginPage/LoginPage.tsx
git commit -m "refactor: LoginPageのフォームをFormInputに置き換え (#97)"
```

---

### Task 6: SignUpPage を FormInput に置き換え

**Files:**
- Modify: `frontend/src/pages/SignUpPage/SignUpPage.tsx`

- [ ] **Step 1: SignUpPage.tsx を修正**

LoginPageと同じパターンで、4つの `<div className={styles.field}>` + `<input>` ブロックを `<FormInput>` に置き換える。

import文に追加:
```tsx
import { FormInput } from '../../components/ui/FormInput/FormInput'
```

置き換え対象:
1. ユーザー名 input → `<FormInput label="ユーザー名" ... />`
2. メールアドレス input → `<FormInput label="メールアドレス" type="email" ... />`
3. パスワード input → `<FormInput label="パスワード" type="password" ... />`
4. パスワード（確認）input → `<FormInput label="パスワード（確認）" type="password" ... />`

- [ ] **Step 2: 既存テストがパスすることを確認**

Run: `docker compose exec frontend npx vitest run src/pages/SignUpPage/`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add frontend/src/pages/SignUpPage/SignUpPage.tsx
git commit -m "refactor: SignUpPageのフォームをFormInputに置き換え (#97)"
```

---

### Task 7: AccountSettingsPage を FormInput に置き換え

**Files:**
- Modify: `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.tsx`
- Modify: `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.module.css`

- [ ] **Step 1: AccountSettingsPage.tsx を修正**

パスワード変更の2つの input を FormInput に置き換える。

import文に追加:
```tsx
import { FormInput } from '../../components/ui/FormInput/FormInput'
```

置き換え対象:
1. 新しいパスワード input → `<FormInput label="新しいパスワード" type="password" ... />`
2. パスワード（確認）input → `<FormInput label="パスワード（確認）" type="password" ... />`

- [ ] **Step 2: AccountSettingsPage.module.css からフォーム input スタイルを削除**

`.field input` および `.field input:focus` のスタイル（FormInputが担うようになるため不要）を削除する。`.field` 自体はレイアウト用に残す場合がある。実装時にFormInputの `.field` と衝突しないか確認し、不要なら削除する。

- [ ] **Step 3: 既存テストがパスすることを確認**

Run: `docker compose exec frontend npx vitest run src/pages/AccountSettingsPage/`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/AccountSettingsPage/
git commit -m "refactor: AccountSettingsPageのフォームをFormInputに置き換え (#97)"
```

---

### Task 8: OauthUsernamePage と EmailPromptPage を FormInput に置き換え

**Files:**
- Modify: `frontend/src/pages/OauthUsernamePage/OauthUsernamePage.tsx`
- Modify: `frontend/src/pages/EmailPromptPage/EmailPromptPage.tsx`

- [ ] **Step 1: OauthUsernamePage.tsx を修正**

ユーザー名 input を `<FormInput label="ユーザー名" ... />` に置き換える。

import文に追加:
```tsx
import { FormInput } from '../../components/ui/FormInput/FormInput'
```

- [ ] **Step 2: EmailPromptPage.tsx を修正**

メールアドレス input を `<FormInput label="メールアドレス" type="email" ... />` に置き換える。

import文に追加:
```tsx
import { FormInput } from '../../components/ui/FormInput/FormInput'
```

- [ ] **Step 3: コミット**

```bash
git add frontend/src/pages/OauthUsernamePage/ frontend/src/pages/EmailPromptPage/
git commit -m "refactor: OAuth関連ページのフォームをFormInputに置き換え (#97)"
```

---

### Task 9: SearchPage を FormInput に置き換え

**Files:**
- Modify: `frontend/src/pages/SearchPage/SearchPage.tsx`
- Modify: `frontend/src/pages/SearchPage/SearchPage.module.css`

- [ ] **Step 1: SearchPage.tsx の検索 input を FormInput に置き換え**

注意: 検索ページの input はラベルが不要（検索バーとして使用）なので、FormInput に `label` をオプショナルにするか、既存の input のスタイルだけトークン化するか判断が必要。

検索バーはレイアウトが特殊（横にボタンがある）なので、FormInput のラベルを空文字にして使い、wrapper のスタイルは SearchPage.module.css に残す。

import文に追加:
```tsx
import { FormInput } from '../../components/ui/FormInput/FormInput'
```

- [ ] **Step 2: SearchPage.module.css の .searchInput スタイルを削除**

FormInput が統一スタイルを提供するため、`.searchInput` のボーダー・フォント等のスタイルを削除する。レイアウト（flex内の配置）のみ残す。

- [ ] **Step 3: 既存テストがパスすることを確認**

Run: `docker compose exec frontend npx vitest run src/pages/SearchPage/`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/SearchPage/
git commit -m "refactor: SearchPageの検索入力をFormInputに置き換え (#97)"
```

---

### Task 10: LibraryPage の select を FormSelect に置き換え

**Files:**
- Modify: `frontend/src/pages/LibraryPage/LibraryPage.tsx`
- Modify: `frontend/src/pages/LibraryPage/LibraryPage.module.css`

- [ ] **Step 1: LibraryPage.tsx の3つの select を FormSelect に置き換え**

import文に追加:
```tsx
import { FormSelect } from '../../components/ui/FormSelect/FormSelect'
```

変更前（80-128行目の3つの select）を以下に置き換え:

```tsx
<FormSelect
  label="ステータス"
  id="status-filter"
  value={status ?? 'all'}
  onChange={handleStatusChange}
  options={statusOptions.map((o) => ({ value: o.value ?? 'all', label: o.label }))}
/>

<FormSelect
  label="ジャンル"
  id="media-type-filter"
  value={mediaType ?? 'all'}
  onChange={handleMediaTypeChange}
  options={MEDIA_TYPE_OPTIONS.map((o) => ({ value: o.value ?? 'all', label: o.label }))}
/>

<FormSelect
  label="並び替え"
  id="sort-filter"
  value={sort}
  onChange={handleSortChange}
  options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
/>
```

- [ ] **Step 2: LibraryPage.module.css から不要なスタイルを削除**

削除対象:
- `.filterItem` （FormSelectの `.field` が代替）
- `.filterLabel` （FormSelectの `.label` が代替）
- `.filterSelect` + `.filterSelect:hover` + `.filterSelect:focus`（FormSelectの `.select` が代替）

`.filters` のflex レイアウトは残す。

- [ ] **Step 3: LibraryPage.module.css のハードコード値をトークンに置き換え**

`.filterItem` 内の `gap: 2px` → `gap: var(--spacing-xs)` （削除対象なら不要）

- [ ] **Step 4: 既存テストがパスすることを確認**

Run: `docker compose exec frontend npx vitest run src/pages/LibraryPage/`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/LibraryPage/
git commit -m "refactor: LibraryPageのselectをFormSelectに置き換え (#97)"
```

---

### Task 11: CommunityPage の select を FormSelect に置き換え

**Files:**
- Modify: `frontend/src/pages/CommunityPage/CommunityPage.tsx`
- Modify: `frontend/src/pages/CommunityPage/CommunityPage.module.css`

- [ ] **Step 1: CommunityPage.tsx の select を FormSelect に置き換え**

import文に追加:
```tsx
import { FormSelect } from '../../components/ui/FormSelect/FormSelect'
```

変更前（56-67行目の select ブロック）:
```tsx
<select id="sort-select" className={styles.sortSelect} value={sort} onChange={handleSortChange}>
  {SORT_OPTIONS.map((o) => (
    <option key={o.value} value={o.value}>{o.label}</option>
  ))}
</select>
```

変更後:
```tsx
<FormSelect
  label="並び替え"
  id="sort-select"
  value={sort}
  onChange={handleSortChange}
  options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
/>
```

`.sortWrapper`, `.sortLabel` の div/label も不要になる（FormSelectが内包する）。

- [ ] **Step 2: CommunityPage.module.css から不要なスタイルを削除**

削除対象:
- `.sortWrapper`（FormSelectの `.field` が代替）
- `.sortLabel`（FormSelectの `.label` が代替）
- `.sortSelect` + `.sortSelect:hover` + `.sortSelect:focus`（FormSelectの `.select` が代替）
- レスポンシブ内の `.sortSelect` も削除

ハードコード値の修正:
- `.sortWrapper` の `gap: 2px` → 削除時に解消
- `.sortLabel` の `font-size: 11px` → 削除時に解消

- [ ] **Step 3: 既存テストがパスすることを確認**

Run: `docker compose exec frontend npx vitest run src/pages/CommunityPage/`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/CommunityPage/
git commit -m "refactor: CommunityPageのselectをFormSelectに置き換え (#97)"
```

---

### Task 12: UserProfilePage の select を FormSelect に置き換え

**Files:**
- Modify: `frontend/src/pages/UserProfilePage/UserProfilePage.tsx`
- Modify: `frontend/src/pages/UserProfilePage/UserProfilePage.module.css`

- [ ] **Step 1: UserProfilePage.tsx 内の select を FormSelect に置き換え**

ファイルを読み、並び替え select を `<FormSelect>` に置き換える。パターンはCommunityPageと同一。

import文に追加:
```tsx
import { FormSelect } from '../../components/ui/FormSelect/FormSelect'
```

- [ ] **Step 2: 対応する CSS スタイルを削除**

select関連のスタイル（`.sortSelect` 等）を削除する。

- [ ] **Step 3: コミット**

```bash
git add frontend/src/pages/UserProfilePage/
git commit -m "refactor: UserProfilePageのselectをFormSelectに置き換え (#97)"
```

---

### Task 13: WorkDetailPage のフォーム要素を共通コンポーネントに置き換え

**Files:**
- Modify: `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`（またはその子コンポーネント）
- 関連する module.css

- [ ] **Step 1: WorkDetailPage の構造を確認**

WorkDetailPage はコンポーネント化されている。ファイルを読み、textarea（感想入力）、input（タグ入力）、select（ディスカッション並び替え）がどのコンポーネントにあるか特定する。

- [ ] **Step 2: 各フォーム要素を共通コンポーネントに置き換え**

import文に追加（該当する子コンポーネントファイルに）:
```tsx
import { FormInput } from '../../components/ui/FormInput/FormInput'
import { FormSelect } from '../../components/ui/FormSelect/FormSelect'
import { FormTextarea } from '../../components/ui/FormTextarea/FormTextarea'
```

- [ ] **Step 3: 既存テストがパスすることを確認**

Run: `docker compose exec frontend npx vitest run src/pages/WorkDetailPage/`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/WorkDetailPage/
git commit -m "refactor: WorkDetailPageのフォームを共通コンポーネントに置き換え (#97)"
```

---

### Task 14: 既存コンポーネントの border-radius をトークンに置き換え

**Files:**
- Modify: `frontend/src/components/ui/StatusSelector/StatusSelector.module.css`
- Modify: `frontend/src/components/ui/RatingInput/RatingInput.module.css`
- Modify: `frontend/src/components/ui/ProgressControl/ProgressControl.module.css`
- Modify: `frontend/src/components/CommentForm/CommentForm.module.css`
- Modify: `frontend/src/components/CommentItem/CommentItem.module.css`
- Modify: `frontend/src/components/RecordModal/RecordModal.module.css`
- Modify: `frontend/src/components/DiscussionCreateModal/DiscussionCreateModal.module.css`
- Modify: `frontend/src/components/DashboardEmptyState/DashboardEmptyState.module.css`
- Modify: `frontend/src/components/RecordCardItem/RecordCardItem.module.css`
- Modify: `frontend/src/components/RecordListItem/RecordListItem.module.css`
- Modify: `frontend/src/components/WatchingListItem/WatchingListItem.module.css`
- Modify: `frontend/src/components/DiscussionCard/DiscussionCard.module.css`
- Modify: `frontend/src/components/EpisodeReviewSection/EpisodeReviewSection.module.css`
- Modify: `frontend/src/components/FavoriteWorkSelector/FavoriteWorkSelector.module.css`（存在する場合）

- [ ] **Step 1: 各ファイルの border-radius を置き換え**

置き換えルール:
- `border-radius: 0` → `border-radius: var(--radius-none)`
- `border-radius: 2px` → `border-radius: var(--radius-sm)`
- `border-radius: 3px` → `border-radius: var(--radius-sm)`
- `border-radius: 4px` → `border-radius: var(--radius-sm)`
- `border-radius: 6px` → `border-radius: var(--radius-sm)`
- `border-radius: 8px` → `border-radius: var(--radius-md)`
- `border-radius: 10px` → `border-radius: var(--radius-md)`
- `border-radius: 20px` → `border-radius: var(--radius-md)`
- `border-radius: 50%` → `border-radius: var(--radius-full)`
- `border-radius: 999px` → `border-radius: var(--radius-full)`
- `border-radius: 9999px` → `border-radius: var(--radius-full)`

全ファイルを一括で修正する。

- [ ] **Step 2: 既存テストがパスすることを確認**

Run: `docker compose exec frontend npx vitest run`
Expected: PASS（全テスト）

- [ ] **Step 3: コミット**

```bash
git add frontend/src/components/
git commit -m "refactor: 全コンポーネントのborder-radiusをトークンに置き換え (#97)"
```

---

### Task 15: ハードコードされた色・サイズをトークンに置き換え

**Files:**
- Modify: `frontend/src/styles/tokens.css`（ongoing色の追加）
- Modify: `frontend/src/components/ui/ProgressControl/ProgressControl.module.css`
- Modify: `frontend/src/components/DashboardEmptyState/DashboardEmptyState.tsx`

- [ ] **Step 1: tokens.css に ongoing バッジ用の色を追加**

`/* --- カラー --- */` セクションに追加:
```css
  /* 進行中バッジ */
  --color-ongoing-bg: #fff3e0;
  --color-ongoing-text: #e65100;
```

- [ ] **Step 2: ProgressControl.module.css のハードコード色を置き換え**

変更前:
```css
.ongoingBadge {
  background: #fff3e0;
  color: #e65100;
}
```

変更後:
```css
.ongoingBadge {
  background: var(--color-ongoing-bg);
  color: var(--color-ongoing-text);
}
```

- [ ] **Step 3: DashboardEmptyState.tsx のジャンル色をCSS変数に移行**

変更前:
```tsx
const GENRES = [
  { label: 'アニメ', color: '#3d5a80' },
  { label: '映画', color: '#5e548e' },
  { label: 'ドラマ', color: '#9f86c0' },
  { label: '本', color: '#c4956a' },
  { label: '漫画', color: '#e07a5f' },
  { label: 'ゲーム', color: '#6b9080' },
] as const
```

変更後（CSS変数名を文字列で持つ。インラインスタイルでCSS変数を参照するため `getComputedStyle` を使うか、CSSモジュールのクラスで管理する。最もシンプルな方法: CSS変数名をdata属性で管理し、CSSで色を適用する）:

実装時に DashboardEmptyState のインラインスタイル（hexToRgba）の使い方を確認し、最適な方法を選択する。CSS変数はインラインスタイルの `rgba()` 計算に直接使えないため、HEXとCSS変数の対応をマッピングするか、CSSで各ジャンル用のクラスを用意するアプローチが考えられる。実装時に判断する。

- [ ] **Step 4: 既存テストがパスすることを確認**

Run: `docker compose exec frontend npx vitest run`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/styles/tokens.css frontend/src/components/ui/ProgressControl/ frontend/src/components/DashboardEmptyState/
git commit -m "refactor: ハードコード色をデザイントークンに置き換え (#97)"
```

---

### Task 16: authForm.module.css の整理

**Files:**
- Modify: `frontend/src/styles/authForm.module.css`

- [ ] **Step 1: authForm.module.css からフォーム input スタイルを削除**

FormInputが担うようになったスタイルを削除:
- `.field` の flex レイアウト → FormInput の `.field` が代替
- `.field label` のスタイル → FormInput の `.label` が代替
- `.field input` のスタイル → FormInput の `.input` が代替
- `.field input:focus` → FormInput の `.input:focus` が代替

残すもの:
- `.page`（レイアウト: 中央配置）
- `.card`（幅制限）
- `.form`（flex + gap）
- `.error`（エラーメッセージ）
- `.link`（リンク）
- `.skipButton`（スキップボタン）
- レスポンシブ

- [ ] **Step 2: authForm.module.css を使用しているページで表示が崩れないか確認**

LoginPage, SignUpPage, AccountSettingsPage, OauthUsernamePage, EmailPromptPage で `.field` クラスが使用されなくなっていることを確認。まだ使用されている場合はページ側の修正が必要。

- [ ] **Step 3: 既存テストがパスすることを確認**

Run: `docker compose exec frontend npx vitest run`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add frontend/src/styles/authForm.module.css
git commit -m "refactor: authForm.module.cssからFormInput移行済みスタイルを削除 (#97)"
```

---

### Task 17: CLAUDE.md にUI一貫性ルールを追加

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md の TypeScript / React セクションの後に追加**

`### TypeScript / React` セクションの末尾（現在の最後の項目の後）に以下を追加:

```markdown
### フロントエンドUI一貫性ルール

#### デザイントークン（必須）
スタイル値は全て `tokens.css` のCSS変数を使用する。ハードコード禁止。

- 色: `var(--color-*)` のみ
- フォント: `var(--font-size-*)`, `var(--font-weight-*)` のみ
- スペーシング: `var(--spacing-*)` のみ
- 角丸: `var(--radius-*)` のみ
- トランジション: `var(--transition-*)` のみ

tokens.cssに必要な値がない場合は、まずトークンを追加してから使う。

#### フォーム要素（必須）
フォーム入力要素は必ず共通コンポーネントを使用する。

- テキスト入力 → `<FormInput>`
- セレクト → `<FormSelect>`
- テキストエリア → `<FormTextarea>`

HTMLの `<input>`, `<select>`, `<textarea>` を直接使わない。

#### 共通コンポーネント使用（必須）
新しいUIを作る前に `frontend/src/components/ui/` を確認する。
同等の機能を持つ要素を新規CSSで直書きしない。

#### 新しいスタイル値が必要な場合
1. tokens.cssにトークンとして追加
2. 必要に応じて共通コンポーネントに反映
3. その上でページ固有のスタイルを書く
```

- [ ] **Step 2: コミット**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.mdにフロントエンドUI一貫性ルールを追加 (#97)"
```

---

### Task 18: 全体テスト + リンター実行

- [ ] **Step 1: 全テスト実行**

Run: `docker compose exec frontend npx vitest run`
Expected: PASS（全テスト）

- [ ] **Step 2: ESLint 実行**

Run: `docker compose exec frontend npx eslint src/ --ext .ts,.tsx`
Expected: エラーなし

- [ ] **Step 3: Prettier 実行**

Run: `docker compose exec frontend npx prettier --check "src/**/*.{ts,tsx,css}"`
Expected: 全ファイルフォーマット済み

- [ ] **Step 4: 問題があれば修正してコミット**

```bash
git add -A
git commit -m "fix: リンター・フォーマッター指摘の修正 (#97)"
```
