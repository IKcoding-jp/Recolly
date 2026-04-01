# RecordModal ステータス・評価リセット修正

## 概要

検索ページで連続して異なる作品を記録する際、前回の記録のステータス（status）と評価（rating）がリセットされずに残る問題を修正する。

## 問題の原因

`SearchPage.tsx` で `RecordModal` に `key` 属性が指定されていない。

RecordModal はモーダルを閉じるとき `isOpen=false` → `return null` で非表示にしているが、コンポーネント自体はアンマウント（破棄）されない。そのため `useState` の値（status, rating）が前回の値のまま保持され、次にモーダルを開いたときにリセットされない。

### 再現手順

1. 検索ページで作品Aを「記録する」
2. ステータスを「完了」、評価を「8」に設定して記録
3. 続けて作品Bを「記録する」
4. → ステータスが「完了」、評価が「8」のまま表示される（期待: 「視聴中」、評価なし）

## 修正方針

案A: `key` 属性による破棄＆再作成（採用）

`RecordModal` に作品を一意に特定できる `key` を付与する。作品が切り替わるたびに React がコンポーネントを破棄して再作成するため、`useState` の初期値が適用され、ステータス・評価が自動的にリセットされる。

### 不採用案

- 案B（`useEffect` でリセット）: state 追加時にリセット処理の書き忘れリスクがある
- 案C（親がリセット）: RecordModal の内部状態を親が管理する必要があり、責任が分散する

## 変更内容

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/pages/SearchPage/SearchPage.tsx` | RecordModal に `key` 属性を追加 |

### 変更詳細

```tsx
// Before
<RecordModal
  isOpen={modalWork !== null}
  title={modalWork?.title ?? ''}
  ...
/>

// After
<RecordModal
  key={modalWork ? `${modalWork.external_api_source}:${modalWork.external_api_id}` : 'closed'}
  isOpen={modalWork !== null}
  title={modalWork?.title ?? ''}
  ...
/>
```

`key` の値は `external_api_source:external_api_id`（例: `tmdb:12345`）で、作品ごとに一意になる。`modalWork` が `null`（モーダル非表示）のときは `'closed'` を使用する。

## テスト

- SearchPage のテストで、連続して異なる作品を記録したときに RecordModal の status と rating がリセットされることを確認する

## 影響範囲

- `RecordModal` コンポーネントのみ。他のページ・コンポーネントへの影響なし
- パフォーマンス影響: コンポーネントの再作成コストは実用上問題なし（モーダルは軽量なコンポーネント）
