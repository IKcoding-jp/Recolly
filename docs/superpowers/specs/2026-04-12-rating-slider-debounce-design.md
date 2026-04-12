# 評価スライダー デバウンス/楽観的更新 — 設計スペック

Issue: #124

## 問題

`useWorkDetail.ts` の `handleRatingChange`、`handleEpisodeChange`、`handleRewatchCountChange` が操作のたびに即座に `recordsApi.update` を呼ぶため、連続操作時に大量のAPIリクエストが発生し、UIがもたつく。

例: スライダーを1から8まで動かすと7回のAPIリクエストが飛ぶ。

## 解決策

`useDebouncedRecordUpdate` カスタムフックを作成し、以下の2つを組み合わせる。

### 楽観的更新（Optimistic Update）

操作のたびにUIの状態を即座に更新する。APIの返事は待たない。

### デバウンス（Debounce）

操作が止まって300ms経過後にAPIリクエストを1回だけ送る。

### フロー

```
ユーザー操作（値: 3→4→5→6）
  ↓
毎回即座にローカルstateを更新（UIは即座に6と表示）
  ↓
300ms無操作 → API呼び出し（{ rating: 6 } の1回だけ）
  ↓
API成功 → サーバーレスポンスでstateを確定
API失敗 → 操作前の値（3）にロールバック
```

## 対象ハンドラー

| ハンドラー | デバウンス適用 | 理由 |
|-----------|:---:|------|
| `handleRatingChange` | する | スライダーで連続発火 |
| `handleEpisodeChange` | する | +1ボタン連打で連続発火 |
| `handleRewatchCountChange` | する | 同上 |
| `handleStatusChange` | しない | ドロップダウンで1回確定 |
| `handleReviewTextSave` | しない | 保存ボタンで明示的送信 |

## 変更ファイル

### 新規作成

- `frontend/src/hooks/useDebouncedRecordUpdate.ts` — デバウンス + 楽観的更新フック

### 変更

- `frontend/src/pages/WorkDetailPage/useWorkDetail.ts` — 3つのハンドラーを新フックに切り替え

### テスト

- `frontend/src/hooks/__tests__/useDebouncedRecordUpdate.test.ts` — フック単体テスト
- `frontend/src/pages/WorkDetailPage/__tests__/useWorkDetail.test.ts` — 既存テストの更新（デバウンス挙動に合わせる）

## 設計詳細

### `useDebouncedRecordUpdate` フック

```typescript
type UseDebouncedRecordUpdateParams = {
  record: UserRecord | null
  setState: React.Dispatch<React.SetStateAction<WorkDetailState>>
  delayMs?: number // デフォルト: 300
}

type DebouncedUpdateFn = (params: Partial<Pick<UserRecord, 'rating' | 'current_episode' | 'rewatch_count'>>) => void
```

**引数:**
- `record`: 現在の記録データ（APIリクエストに使うIDと、ロールバック用の値）
- `setState`: useWorkDetailのstate更新関数
- `delayMs`: デバウンス待機時間（デフォルト300ms）

**戻り値:**
- `debouncedUpdate`: 楽観的更新 + デバウンスAPIコールを行う関数

**内部実装のポイント:**
- `useRef` でデバウンスのタイマーIDを保持
- `useRef` でロールバック用の「操作前の値」を保持（デバウンス開始時にスナップショットを取る）
- コンポーネントのアンマウント時にタイマーをクリア（`useEffect` cleanup）

### エラー時のロールバック

APIが失敗した場合:
1. デバウンス開始時に保存したスナップショットでrecordを復元
2. UIの表示値が操作前に戻る

### デバウンス時間

300ms。スライダー操作やボタン連打の「操作の区切り」として十分短く、APIへの不要なリクエストを防げる値。
