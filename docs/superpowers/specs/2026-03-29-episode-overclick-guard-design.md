# エピソード上限超過クリック防止ガード

## 概要

ホーム画面の「+1話」ボタンを連打した際、最終話を超えてクリックできてしまうバグを修正する。

## 現状の問題

### 再現手順

1. ホーム画面で視聴中のアニメ（例: 全12話）の「+1話」を連打
2. 12話（最終話）に到達後もクリックできてしまう
3. バックエンドのバリデーション（`current_episode > total_episodes`）でエラー
4. 「進捗の更新に失敗しました」エラーメッセージが表示される
5. レコードは自動完了でリストから消えているため、エラーだけが残る空画面になる

### 原因

`useDashboard.ts` の `handleAction` 関数に上限チェックがない。

- `ProgressControl` コンポーネント（作品詳細ページで使用）にはガードがある（`canIncrement = total === null || current < total`）
- しかしホーム画面の `WatchingListItem` は `handleAction` を直接呼び出しており、同等のガードがない

## 修正方針

### やること

- `handleAction` の冒頭で `current_episode >= total_episodes` の場合に早期リターンするガードを追加

### やらないこと

- 連打防止（debounce / throttle）→ ユーザーが5話→10話まで連打で追加したいケースを妨げるため
- API通信中のボタン無効化 → 同上の理由
- ボタンのUI変更（ラベル変更・disabled表示）→ スコープ外

## 修正対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/hooks/useDashboard.ts` | `handleAction` に上限チェック追加 |
| `frontend/src/hooks/useDashboard.test.ts` | 上限超過時にAPIが呼ばれないテスト追加 |

## 修正ロジック

```typescript
// handleAction 内、hasEpisodes(mediaType) が true の場合
const totalEpisodes = record.work.total_episodes
if (totalEpisodes !== null && record.current_episode >= totalEpisodes) {
  return // 上限に達しているので何もしない
}
```

## ガード条件の詳細

| current_episode | total_episodes | 結果 |
|----------------|---------------|------|
| 11 | 12 | ✅ 許可（12にインクリメント → 自動完了） |
| 12 | 12 | ❌ ブロック（既に上限） |
| 13 | 12 | ❌ ブロック（上限超過、通常到達しない） |
| 5 | null | ✅ 許可（上限なし） |
