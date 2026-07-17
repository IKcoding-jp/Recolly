# 検索結果カードのジャケットクリック記録化 設計書

作成日: 2026-07-17
関連: [2026-07-16-search-ui-redesign-design.md](2026-07-16-search-ui-redesign-design.md)（ジャケット主体グリッドの導入元）
関連ADR: [ADR-0044](../../adr/0044-検索結果から説明文を廃止し記録時補完に移行.md)（グリッドUI・記録フローの前提）

## 概要

検索結果カード（`WorkCard`）から「記録する」ボタンを廃止し、カード（ジャケット＋ジャンル＋タイトル）をクリックすることで `RecordModal` が開く形に変更する。あわせて、検索結果グリッドの列数・カードの見た目をライブラリ画面（`RecordCardItem`）に揃える。

## 背景・経緯

- ライブラリ画面のグリッドレイアウト（ジャケット主体・カード全体がクリック可能）のUXが好評で、検索結果にも同じ操作感を持たせたい
- 現状の検索結果カードは「記録する」ボタンのみが操作対象で、ジャケット自体はクリックしても反応しない。ライブラリと挙動が異なり一貫性がない

## 決定事項（2026-07-17 IKさん承認）

| 論点 | 決定 |
|------|------|
| 記録ボタン | 削除する |
| クリック可能範囲 | カード全体（ジャケット＋ジャンルバッジ＋タイトル） |
| 記録済み作品のクリック | モーダルは開くが、フォーム・確定ボタンを無効化し「記録済み」であることを案内する |
| グリッド列数 | ライブラリと同じ PC6列／タブレット(〜1024px)4列／モバイル(〜768px)3列に揃える |
| カードの見た目 | ホバー時の浮き上がり効果（`translateY` + `box-shadow`）を `RecordCardItem` に揃える |

## UI仕様

### WorkCard（検索結果カード）

- 「記録する」`<Button>` を削除
- カード（`div`）に `role="button"` `tabIndex={0}` を付与し、クリック・Enter/Spaceキーで `onRecord(work)` を呼ぶ
- 記録済み・未記録に関わらず常にクリック可能（記録済みでもモーダルを開く。モーダル側で送信を止める）
- 「記録済み」バッジ表示は現状維持（状態表示のみで、クリック可否には影響しない）
- `isLoading` prop は廃止する（モーダルのオーバーレイが背後のカードへのクリックを物理的に遮るため、カード側で二重送信を防ぐ意味がなくなるため）

### RecordModal

- 新規 prop `alreadyRecorded?: boolean`（デフォルト `false`）を追加
- `true` の場合:
  - `StatusSelector` / `RatingSlider` を無効化する
  - 確定ボタンのラベルを「記録済み」にし、常に `disabled` にする
  - ヘッダー直下に案内文「この作品はすでに記録済みです」を表示する
  - キャンセルボタンのみ操作可能（閉じる）
- `RecommendationsPage` からの呼び出しは変更しない（`alreadyRecorded` を渡さない限り従来通り）

### グリッド・レイアウト

- `SearchPage.module.css` の `.results` グリッド列数をライブラリ（`LibraryPage.module.css` の `.cardGrid`）に合わせて変更する
  - PC: 6列 / タブレット(〜1024px): 4列 / モバイル(〜768px): 3列
  - ブレークポイント基準も 1024px / 768px に統一する（現行は 768px / 480px）
- `WorkCard.module.css` にホバー効果を追加
  - `.card:hover` に `transform: translateY(-2px)` を追加（背景色変化は維持）
  - `box-shadow` は `RecordCardItem` に揃えて `var(--shadow-md)` を使用

## データフロー

```
WorkCard クリック（記録済み/未記録どちらも）
  → SearchPage.handleOpenModal(work) → setModalWork(work)
  → RecordModal isOpen=true, alreadyRecorded={recordedIds.has(workKey)}
      - 未記録 → 通常どおり入力・確定可能（既存フロー）
      - 記録済み → フォーム無効化・確定ボタン無効化・案内文表示
      - キャンセルのみ操作可能
```

- `SearchPage.tsx` の `handleOpenModal` / `handleConfirmRecord` / `recordedIds` の管理ロジックは変更なし
- `RecordModal` への渡し方のみ追加（`alreadyRecorded={recordedIds.has(workKey)}`）

## 変更ファイル一覧（見込み）

- `frontend/src/components/WorkCard/WorkCard.tsx` — ボタン削除・カードクリック化・キーボード対応・`isLoading` prop削除
- `frontend/src/components/WorkCard/WorkCard.module.css` — ホバー効果追加
- `frontend/src/components/WorkCard/WorkCard.test.tsx` — ボタンテストをカードクリック/キーボード操作テストに置換
- `frontend/src/components/RecordModal/RecordModal.tsx` — `alreadyRecorded` prop追加
- `frontend/src/components/RecordModal/RecordModal.module.css` — 案内文のスタイル追加（必要な場合）
- `frontend/src/components/RecordModal/RecordModal.test.tsx` — `alreadyRecorded` 時の表示・disabled状態テスト追加
- `frontend/src/pages/SearchPage/SearchPage.tsx` — `WorkCard` へのprops変更、`RecordModal` に `alreadyRecorded` を渡す
- `frontend/src/pages/SearchPage/SearchPage.module.css` — グリッド列数・ブレークポイント変更
- `frontend/src/pages/SearchPage/SearchPage.test.tsx`（存在すれば）— ジャケットクリックでモーダルが開くこと、記録済みクリック時の無効化を確認するテスト追加

## テスト方針

- `WorkCard`: カード（記録済み/未記録）クリックで `onRecord` が呼ばれること、Enter/Spaceキーでも同様に呼ばれること、「記録する」ボタンが存在しないこと
- `RecordModal`: `alreadyRecorded=true` のとき確定ボタンが disabled で文言が「記録済み」になること、案内文が表示されること、入力コンポーネントが無効化されること
- `SearchPage`: ジャケットクリックでモーダルが開くこと（既存の「記録するボタンクリックでモーダルが開く」テストの置き換え）、記録済み作品クリック時に `alreadyRecorded` が正しく渡ること

## 既知のトレードオフ・影響範囲外

- `RecommendationsPage` / `RecommendedWorkCard`（おすすめ画面の記録カード）は今回の変更対象外。将来的に統一するかは別途検討
- ライブラリ画面の `RecordCardItem`（詳細ページへの遷移）は変更しない
- カード全体をクリック領域にするため、将来的にカード内に別のインタラクティブ要素（例: お気に入りボタン等）を追加する場合はクリックイベントの伝播に注意が必要
