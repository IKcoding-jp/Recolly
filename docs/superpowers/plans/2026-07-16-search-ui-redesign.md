# 検索UI再設計（ジャケット主体グリッド＋記録時補完） 実装プラン

作成日: 2026-07-16
スペック: [2026-07-16-search-ui-redesign-design.md](../specs/2026-07-16-search-ui-redesign-design.md)
Issue: #209（#208と同一PRで対応）
ブランチ: `fix/search-description-japanese-only`（先行作業分を含む）

## 前提（このブランチで実施済みの先行作業）

- 二段階レスポンスのフロントエンド廃止（1回リクエスト化・ADR-0043）
- 「※ シリーズ全体の説明」ラベル削除
- バックエンド高速化（faraday-retryのタイムアウト再試行無効化・代替タイトル検索の並列化）
- docker-compose.yml の server.pid 削除対応

## タスク分解（各タスクはTDD: テスト先行 → 実装 → グリーン確認）

### Task 1: WorkEnrichmentService の分離（バックエンド）

1. spec更新: `enrich` → カバー補完のみになること / 単一作品説明補完 `enrich_work_description!(work)` の新テスト
   （キャッシュヒット・ミス・NOT_FOUND・失敗時に例外を漏らさない・日本語説明が既にあればスキップ）
2. 実装:
   - `enrich(results, limit:)` から説明補完・シリーズ親流用を撤去（openBDカバー補完のみに）
   - `enrich_work_description!(work)` を公開（既存 `try_enrich_description` ロジックをWorkモデル向けに再利用・タイトル単位キャッシュ共有）
   - `share_series_descriptions` 系・`description_from_parent` を削除

### Task 2: WorkSearchService の単一パス化（バックエンド）

1. spec更新: `enrich`/`enriched`/rawキャッシュのテスト削除、単一パス＋v8キャッシュのテスト
2. 実装: `Outcome`・`search_with_status`・rawキャッシュ削除、`search` 一本化、`CACHE_VERSION = 'v8'`

### Task 3: コントローラー対応（バックエンド）

1. works request spec: `enrich` パラメータ・`enriched` フィールドの廃止を反映
2. records request spec: 記録作成時に説明補完が走ること（補完成功・失敗・既に日本語説明あり）
3. 実装: `WorksController#search` 簡素化 / `RecordsController#create` に補完呼び出し追加（失敗しても記録は成功）

### Task 4: 型とAPIクライアント（フロントエンド）

1. `types.ts`: `SearchResponse.enriched`・`WorkMetadata.description_from_parent` 削除
2. テストのモックレスポンスから `enriched` を除去

### Task 5: WorkCard のグリッドカード化（フロントエンド）

1. test更新: 縦カードの表示要素（画像・ジャンルバッジ・タイトル・ボタン/記録済み）、説明文が表示されないこと
2. 実装: JSX構造とCSSを縦型カードに作り直し（DESIGN.md準拠・tokens.cssのみ）

### Task 6: SearchPage グリッド化 + SearchSkeleton 更新（フロントエンド）

1. test更新: グリッドコンテナ・スケルトン形状変更に伴う修正
2. 実装: resultsコンテナをCSS Grid化（PC4列/768px以下3列/480px以下2列）、SearchSkeletonを縦カード形状に

### Task 7: 全体検証

- バックエンド: `rspec` 全件 + `rubocop`
- フロントエンド: `vitest` 全件 + `tsc --noEmit` + `eslint`
- PR前セルフチェック（`.claude/rules/pr-self-check.md`）

### Task 8: 動作確認（Step 5）

- 確認方法をIKさんに選択してもらう（手動 / Playwright MCP）
- 確認観点: グリッド表示・検索速度（全ジャンルで数秒）・記録時の説明補完・詳細ページでの説明表示

### Task 9: PR作成（Step 6）

- Conventional Commits形式でコミット整理
- PR本文で #208 #209 をクローズ
