# UI一貫性統一 設計スペック

## 概要

AI駆動開発で生まれたページ間のUI差異を統一し、今後の再発を防止する。
対象: デザイントークン追加、フォーム共通コンポーネント作成、既存ページの置き換え、CLAUDE.md強化。

## 背景

### 現状の問題

- `border-radius` がトークン化されておらず、2px〜10pxの値が散在
- フォーム入力欄のスタイルがページごとに異なる（黒枠2px vs グレー枠1px、角丸あり vs なし）
- selectのスタイルが4種類存在
- 一部のCSS値がハードコード（色のHEX直書き、px直書き）
- CLAUDE.mdの規約が抽象的すぎて守られていない

### 統一方針

- **フォームスタイル**: ログイン/サインアップページの「黒枠・角ばり」スタイル（スタイルA）に統一
- **角丸**: 4段階のトークンで管理
- **フォーム要素**: 共通コンポーネント化して全ページで再利用

## 設計

### 1. tokens.css の追加トークン

```css
/* 角丸 */
--radius-none: 0;
--radius-sm: 4px;
--radius-md: 8px;
--radius-full: 9999px;
```

既存トークン（色、スペーシング、フォント等）はそのまま活かす。

### 2. 共通フォームコンポーネント

`frontend/src/components/ui/` に3つ追加する。

#### `<FormInput>`

- **ファイル**: `FormInput/FormInput.tsx`, `FormInput/FormInput.module.css`, `FormInput/FormInput.test.tsx`
- **props**: `label`, `type`, `value`, `onChange`, `placeholder`, `error`, `required`
- **スタイル**:
  - ボーダー: `var(--border-width)` solid `var(--color-text)` = 2px solid #2c2c2c
  - 角丸: `var(--radius-none)` = 0
  - padding: `var(--spacing-sm)` `var(--spacing-md)`
  - フォント: `var(--font-body)`, `var(--font-size-body)`
  - focus: `outline: none; border-color: var(--color-text);`
  - エラー時: `border-color: var(--color-error);`
- **ラベル**: 上に表示（ログイン画面と同じ配置）

#### `<FormSelect>`

- **ファイル**: `FormSelect/FormSelect.tsx`, `FormSelect/FormSelect.module.css`, `FormSelect/FormSelect.test.tsx`
- **props**: `label`, `value`, `onChange`, `options: { value: string, label: string }[]`, `error`
- **スタイル**: FormInputと同一（黒枠・角ばり）

#### `<FormTextarea>`

- **ファイル**: `FormTextarea/FormTextarea.tsx`, `FormTextarea/FormTextarea.module.css`, `FormTextarea/FormTextarea.test.tsx`
- **props**: `label`, `value`, `onChange`, `placeholder`, `rows`（デフォルト: 4）, `error`
- **スタイル**: FormInput/FormSelectと同一

#### 共通設計方針

- CSS Modules でスタイルスコープ化
- スタイル値は全て `tokens.css` のCSS変数を使用
- `authForm.module.css` のフォームスタイルを「正」としてコンポーネント化

### 3. 既存ページの置き換え

| ページ | 現在の実装 | 置き換え先 |
|--------|----------|----------|
| LoginPage | `authForm.module.css` の input × 2 | `<FormInput>` × 2 |
| SignUpPage | `authForm.module.css` の input × 4 | `<FormInput>` × 4 |
| AccountSettingsPage | `authForm.module.css` の input × 2 | `<FormInput>` × 2 |
| OauthUsernamePage | `authForm.module.css` の input × 1 | `<FormInput>` × 1 |
| EmailPromptPage | `authForm.module.css` の input × 1 | `<FormInput>` × 1 |
| LibraryPage | 直書き select × 3 | `<FormSelect>` × 3 |
| CommunityPage | 直書き select × 1 | `<FormSelect>` × 1 |
| UserProfilePage | 直書き select × 1 | `<FormSelect>` × 1 |
| WorkDetailPage | 直書き textarea × 2, input × 1, select × 1 | `<FormTextarea>` × 2, `<FormInput>` × 1, `<FormSelect>` × 1 |
| SearchPage | 直書き input × 1 | `<FormInput>` × 1 |

**置き換え後に不要になるファイル:**
- `authForm.module.css` → フォームスタイルがコンポーネントに移行するため、不要になれば削除

### 4. 既存ハードコード値のトークン置き換え

| ファイル | 現在の値 | 置き換え先 |
|---------|---------|----------|
| StatusSelector.module.css | `border-radius: 6px` | `var(--radius-sm)` |
| RatingInput.module.css | `border-radius: 4px` | `var(--radius-sm)` |
| RecordModal系 | `border-radius: 10px` | `var(--radius-md)` |
| DiscussionCreateModal | `border-radius: 10px`, `6px` | `var(--radius-md)`, `var(--radius-sm)` |
| CommentForm.module.css | `border-radius: 8px`, `4px` | `var(--radius-md)`, `var(--radius-sm)` |
| CommentItem.module.css | `border-radius: 50%` | `var(--radius-full)` |
| ProgressControl.module.css | `border-radius: 4px`, `2px` | `var(--radius-sm)`, `var(--radius-sm)` |
| ProgressControl.module.css | `#fff3e0`, `#e65100` | tokens.css に追加して `var(--color-*)` |
| DashboardEmptyState.tsx | JS内のジャンル色HEX | 既存トークン `var(--color-anime)` 等を参照 |
| LibraryPage.module.css | `font-size: 11px`, `padding: 6px 12px` | `var(--font-size-meta)`, `var(--spacing-*)` |

### 5. CLAUDE.md の強化

コーディング規約の TypeScript / React セクションに以下を追加する。

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

## テスト

### フロントエンド（Vitest + React Testing Library）

- FormInput: レンダリング、値の入力、エラー表示、ラベル表示
- FormSelect: レンダリング、オプション選択、エラー表示
- FormTextarea: レンダリング、値の入力、デフォルトrows

### 動作確認

- 全ページのフォーム要素が統一されたスタイルで表示されること（Playwrightで確認）

## スコープ外

- レスポンシブ対応の変更（既存のレスポンシブ動作を維持する）
- 新しいコンポーネントの追加（FormInput/FormSelect/FormTextarea以外）
- バックエンドの変更
