# RecordModal ステータス・評価リセット修正 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 検索ページで連続して異なる作品を記録する際に、前回のステータス・評価がリセットされずに残るバグを修正する

**Architecture:** `SearchPage.tsx` の `RecordModal` に `key` 属性を追加し、作品が切り替わるたびにコンポーネントを破棄＆再作成させる。これにより `useState` の初期値が再適用され、ステータス・評価が自動リセットされる。

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library

**Issue:** #91

---

## ファイル構成

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `frontend/src/pages/SearchPage/SearchPage.tsx` | 修正 | RecordModal に `key` 属性を追加（1行） |
| `frontend/src/pages/SearchPage/SearchPage.test.tsx` | 修正 | 連続記録時のステータス・評価リセットを検証するテスト追加 |

---

### Task 1: 連続記録時のリセット検証テストを書く

**Files:**
- Modify: `frontend/src/pages/SearchPage/SearchPage.test.tsx`

- [ ] **Step 1: テストを書く**

SearchPage.test.tsx の末尾に以下のテストを追加する。

検証方法: StatusSelector/RatingInput は `aria-pressed` ではなくCSSクラスで選択状態を表現している。そのため、作品Bのモーダルで「何も変更せずに記録する」をクリックし、APIに送信されるデータが初期値（`status: 'watching'`, `rating` なし）であることで検証する。

```tsx
it('連続で異なる作品を記録する際にステータス・評価がリセットされる', async () => {
  renderSearchPage()
  const user = userEvent.setup()

  // 検索API: 2作品を返す
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        results: [
          {
            title: '作品A',
            media_type: 'anime',
            description: '説明A',
            cover_image_url: null,
            total_episodes: 12,
            external_api_id: '100',
            external_api_source: 'anilist',
            metadata: {},
          },
          {
            title: '作品B',
            media_type: 'anime',
            description: '説明B',
            cover_image_url: null,
            total_episodes: 24,
            external_api_id: '200',
            external_api_source: 'anilist',
            metadata: {},
          },
        ],
      }),
  })

  // 検索実行
  const searchInput = await screen.findByPlaceholderText('作品を検索...')
  await user.type(searchInput, 'テスト')
  await user.click(screen.getByRole('button', { name: '検索' }))

  // 作品Aが表示されるのを待つ
  await waitFor(() => {
    expect(screen.getByText('作品A')).toBeInTheDocument()
  })

  // 作品Aの「記録する」をクリック → RecordModal が開く
  const recordButtons = screen.getAllByRole('button', { name: '記録する' })
  await user.click(recordButtons[0])

  // モーダルが開いたことを確認
  await waitFor(() => {
    expect(screen.getByText('作品Aを記録')).toBeInTheDocument()
  })

  // ステータスを「視聴完了」に変更
  await user.click(screen.getByRole('button', { name: '視聴完了' }))

  // 評価を「8」に変更
  await user.click(screen.getByRole('button', { name: '8' }))

  // 記録API（作品A）: 成功を返す
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        record: { id: 1, status: 'completed', rating: 8 },
      }),
  })

  // 「記録する」をクリック（モーダル内の確定ボタン）
  const confirmButtons = screen.getAllByRole('button', { name: '記録する' })
  await user.click(confirmButtons[confirmButtons.length - 1])

  // モーダルが閉じるのを待つ
  await waitFor(() => {
    expect(screen.queryByText('作品Aを記録')).not.toBeInTheDocument()
  })

  // 作品Bの「記録する」をクリック → RecordModal が開く
  const recordButtons2 = screen.getAllByRole('button', { name: '記録する' })
  await user.click(recordButtons2[0])

  // モーダルが開いたことを確認
  await waitFor(() => {
    expect(screen.getByText('作品Bを記録')).toBeInTheDocument()
  })

  // 記録API（作品B）: 成功を返す
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        record: { id: 2, status: 'watching', rating: null },
      }),
  })

  // 何も変更せずにそのまま「記録する」をクリック
  const confirmButtons2 = screen.getAllByRole('button', { name: '記録する' })
  await user.click(confirmButtons2[confirmButtons2.length - 1])

  // APIに送信されたデータを検証: 初期値（watching, ratingなし）で送信されているか
  // mockFetch の呼び出し履歴: [0]=認証, [1]=検索, [2]=作品A記録, [3]=作品B記録
  const workBCall = mockFetch.mock.calls[3]
  const workBBody = JSON.parse(workBCall[1].body as string)
  expect(workBBody.record.status).toBe('watching')
  expect(workBBody.record.rating).toBeNull()
})
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `cd frontend && npx vitest run src/pages/SearchPage/SearchPage.test.tsx`

Expected: 新しいテストが FAIL（作品Bのモーダルで前回の値 `status: 'completed'`, `rating: 8` がAPIに送信される）

- [ ] **Step 3: コミット（失敗するテスト）**

```bash
git add frontend/src/pages/SearchPage/SearchPage.test.tsx
git commit -m "test: 連続記録時のステータス・評価リセット検証テストを追加 #91"
```

---

### Task 2: RecordModal に key 属性を追加して修正

**Files:**
- Modify: `frontend/src/pages/SearchPage/SearchPage.tsx:245`

- [ ] **Step 1: key 属性を追加する**

`frontend/src/pages/SearchPage/SearchPage.tsx` の RecordModal に `key` を追加する:

```tsx
// Before (245行目)
<RecordModal
  isOpen={modalWork !== null}

// After
<RecordModal
  key={modalWork ? `${modalWork.external_api_source ?? 'manual'}:${modalWork.external_api_id ?? manualWorkId}` : 'closed'}
  isOpen={modalWork !== null}
```

`key` の値:
- 検索結果の作品: `anilist:12345` や `tmdb:67890`（APIソース:APIのID で一意）
- 手動登録の作品: `manual:42`（external_api_source/id が null のため manualWorkId を使用）
- モーダル非表示時: `'closed'`

- [ ] **Step 2: テストを実行して全テストがパスすることを確認する**

Run: `cd frontend && npx vitest run src/pages/SearchPage/SearchPage.test.tsx`

Expected: ALL PASS（新しいテストも含めて全て緑）

- [ ] **Step 3: RecordModal の既存テストもパスすることを確認する**

Run: `cd frontend && npx vitest run src/components/RecordModal/RecordModal.test.tsx`

Expected: ALL PASS

- [ ] **Step 4: ESLint がパスすることを確認する**

Run: `cd frontend && npx eslint src/pages/SearchPage/SearchPage.tsx`

Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/SearchPage/SearchPage.tsx
git commit -m "fix: RecordModalにkey属性を追加しステータス・評価を毎回リセット #91"
```
