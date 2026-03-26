# 204 No Contentハンドリング修正 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `request`関数で204 No Contentを正しくハンドリングし、全DELETEエンドポイントの削除後UIが正常動作するようにする

**Architecture:** `api.ts`の`request`関数に204ステータスチェックを1箇所追加。呼び出し側（useWorkDetail等）の変更は不要。テストモックを実際の204レスポンスに合わせて修正。

**Tech Stack:** TypeScript / Vitest

**Spec:** `docs/superpowers/specs/2026-03-26-fix-record-delete-204-design.md`

---

### Task 1: `request`関数の204ハンドリング追加

**Files:**
- Modify: `frontend/src/lib/api.ts:14-16`
- Test: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: `api.test.ts`に204テストを追加（失敗するテスト）**

`request`関数をテストするため、`api.test.ts`に以下を追加:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { request, authApi, ApiError } from './api'
```

※ `request`のexportが必要。`api.ts`は既に`export async function request`なのでインポート追加のみ。

`api.test.ts`の末尾に追加:

```typescript
describe('request', () => {
  it('204 No Contentでundefinedを返す', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 204,
      ok: true,
    })

    const result = await request<void>('/test', { method: 'DELETE' })
    expect(result).toBeUndefined()
  })

  it('200レスポンスでは従来通りJSONをパースする', async () => {
    const data = { message: 'success' }
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(data),
    })

    const result = await request<{ message: string }>('/test')
    expect(result).toEqual(data)
  })
})
```

- [ ] **Step 2: テスト実行 — 失敗を確認**

Run: `cd frontend && npx vitest run src/lib/api.test.ts`
Expected: 「204 No Contentでundefinedを返す」が FAIL（`response.json()` で SyntaxError）

- [ ] **Step 3: `api.ts`に204チェックを実装**

`frontend/src/lib/api.ts`の`response.json()`の前に追加:

```typescript
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  // ボディなしレスポンス（204 No Content）はJSONパースをスキップ
  if (response.status === 204) {
    return undefined as T
  }

  const data: unknown = await response.json()

  if (!response.ok) {
    const errorData = data as ErrorResponse
    const message = errorData.error ?? errorData.errors?.join(', ') ?? 'エラーが発生しました'
    throw new ApiError(message, response.status)
  }

  return data as T
}
```

- [ ] **Step 4: テスト実行 — 全パスを確認**

Run: `cd frontend && npx vitest run src/lib/api.test.ts`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git commit -m "fix: request関数で204 No Contentを正しくハンドリング"
```

---

### Task 2: DELETEテストモックを204レスポンスに修正

**Files:**
- Modify: `frontend/src/lib/recordsApi.test.ts:104`
- Modify: `frontend/src/lib/episodeReviewsApi.test.ts:125`
- Modify: `frontend/src/lib/tagsApi.test.ts:56,67`

- [ ] **Step 1: `recordsApi.test.ts`のremoveテストモックを修正**

104行目を変更:

Before:
```typescript
mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
```

After:
```typescript
mockFetch.mockResolvedValueOnce({ status: 204, ok: true })
```

- [ ] **Step 2: `episodeReviewsApi.test.ts`のremoveテストモックを修正**

125行目を変更:

Before:
```typescript
mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
```

After:
```typescript
mockFetch.mockResolvedValueOnce({ status: 204, ok: true })
```

- [ ] **Step 3: `tagsApi.test.ts`のremoveFromRecordとdeleteTagテストモックを修正**

56行目と67行目を変更:

Before:
```typescript
mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
```

After:
```typescript
mockFetch.mockResolvedValueOnce({ status: 204, ok: true })
```

- [ ] **Step 4: 全テスト実行 — パスを確認**

Run: `cd frontend && npx vitest run src/lib/recordsApi.test.ts src/lib/episodeReviewsApi.test.ts src/lib/tagsApi.test.ts`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/lib/recordsApi.test.ts frontend/src/lib/episodeReviewsApi.test.ts frontend/src/lib/tagsApi.test.ts
git commit -m "test: DELETEテストモックを実際の204レスポンスに修正"
```

---

### Task 3: 全テストスイート実行 + 動作確認

- [ ] **Step 1: フロントエンド全テスト実行**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS（既存テストに影響なし）

- [ ] **Step 2: バックエンドテスト実行（回帰確認）**

Run: `cd backend && docker compose exec backend bundle exec rspec spec/requests/api/v1/records_spec.rb`
Expected: ALL PASS

- [ ] **Step 3: 動作確認（ブラウザ）**

手動確認項目:
1. 作品詳細ページ → 「記録を削除」→ 確認ダイアログ表示 → 「削除する」→ `/search`ページに遷移すること
2. 削除中にボタンが「削除中...」でdisabledになること
3. タグの解除が正常に動作すること（UIが即時更新されること）
