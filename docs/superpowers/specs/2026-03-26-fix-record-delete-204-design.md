# 204 No Contentハンドリング修正

## 概要

DELETEエンドポイントが204 No Content（ボディなし）を返すが、フロントエンドの`request`関数が全レスポンスに対して`response.json()`を呼んでいるため、`SyntaxError`が発生する。その結果、削除は実際にDB上で成功しているが、UIが成功を認識できない。

## 問題の詳細

### 症状（記録削除の例）

- 削除確認ダイアログで「削除する」を押しても画面遷移しない
- 削除ボタンが再度クリック可能になる（`isDeleting`がfalseに戻る）
- レコードはDB上では削除されている

### 原因

`frontend/src/lib/api.ts`の`request`関数（16行目）:

```typescript
const data: unknown = await response.json()
```

204 No Contentの空ボディに対して`response.json()`を呼ぶと`SyntaxError`が発生し、呼び出し側のcatchブロックに落ちる。

### 影響範囲

204 No Contentを返すDELETEエンドポイントが**4つ**あり、すべて同じバグが存在する:

| エンドポイント | フロントエンドAPI | 影響 |
|---------------|-----------------|------|
| `DELETE /api/v1/records/:id` | `recordsApi.remove()` | 削除後に`/search`へ遷移しない |
| `DELETE /api/v1/records/:record_id/episode_reviews/:id` | `episodeReviewsApi.remove()` | 削除後にUIが更新されない |
| `DELETE /api/v1/records/:record_id/tags/:id` | `tagsApi.removeFromRecord()` | タグ解除後にUIが更新されない |
| `DELETE /api/v1/tags/:id` | `tagsApi.deleteTag()` | タグ削除後にUIが更新されない |

**影響なしのDELETEエンドポイント**:

- `DELETE /api/v1/logout` — JSONボディ付きレスポンスを返すため問題なし
- `DELETE /api/v1/account_settings/unlink_provider` — 同上

### 影響フロー（記録削除の例）

1. 「削除する」クリック → `isDeleting: true`
2. DELETE APIコール → 204 No Content（DB削除成功）
3. `response.json()` → `SyntaxError`
4. catchブロック → `isDeleting: false`に戻る
5. `navigate('/search')`は実行されない

## 修正内容

### 変更ファイル

**`frontend/src/lib/api.ts` — `request`関数**

`response.json()`の前に204ステータスチェックを追加:

```typescript
// ボディなしレスポンス（204 No Content）はJSONパースをスキップ
if (response.status === 204) {
  return undefined as T
}
```

### 変更しないファイル

- `useWorkDetail.ts` — `handleDelete`のロジックはそのまま
- `useEpisodeReviews.ts` — 削除ロジックはそのまま
- `useTags.ts` — タグ解除・削除ロジックはそのまま
- `RecordDeleteDialog` — `isLoading`制御もそのまま
- バックエンド — 変更不要

## 修正後のフロー

1. 「削除する」クリック → `isDeleting: true`、ボタンdisabled
2. DELETE API → 204 No Content
3. `request`が`undefined`を返す（エラーなし）
4. `navigate('/search')` 実行 → 検索ページへ遷移

## テスト

### `api.ts`

- 204レスポンスで`undefined`を返すことを確認
- 200レスポンスでは従来通り`response.json()`が呼ばれることを確認

### `recordsApi.test.ts`

- `remove`のテストモックを204レスポンスに修正し、パスすることを確認

### `episodeReviewsApi.test.ts`

- `remove`のテストモックを204レスポンスに修正し、パスすることを確認

### `tagsApi.test.ts`

- `removeFromRecord`と`deleteTag`のテストモックを204レスポンスに修正し、パスすることを確認

### 統合テスト（フック）

- `useWorkDetail`: 削除成功時に`/search`へ遷移することを確認

## アプローチ選定

| アプローチ | 内容 | 判定 |
|-----------|------|------|
| A: `request`関数で204を汎用ハンドリング | 根本原因を1箇所で修正、全DELETEエンドポイントに効果 | **採用** |
| B: `recordsApi.remove`だけ個別対応 | DRY原則に反し、他3箇所のバグが残る | 不採用 |
