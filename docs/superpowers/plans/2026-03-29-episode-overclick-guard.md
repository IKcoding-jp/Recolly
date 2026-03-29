# 実装プラン: エピソード上限超過クリック防止ガード

**Issue:** #78
**スペック:** `docs/superpowers/specs/2026-03-29-episode-overclick-guard-design.md`

## タスク

### Task 1: テスト追加（TDD: Red）

**ファイル:** `frontend/src/hooks/useDashboard.test.ts`

上限到達時に `handleAction` がAPIを呼ばないことを確認するテストを追加する。

- テストケース: `current_episode` が `total_episodes` と同じ場合、`recordsApi.update` が呼ばれない
- テストケース: `current_episode` が `total_episodes` 未満の場合は通常通り動作する（既存テストで担保されている可能性あり、確認して不足があれば追加）

### Task 2: ガード実装（TDD: Green）

**ファイル:** `frontend/src/hooks/useDashboard.ts`

`handleAction` の `hasEpisodes(mediaType)` 分岐の冒頭に上限チェックを追加。

```typescript
const totalEpisodes = record.work.total_episodes
if (totalEpisodes !== null && record.current_episode >= totalEpisodes) {
  return
}
```

### Task 3: リンター・テスト確認

- `npm run lint` パス確認
- `npm run test` パス確認
