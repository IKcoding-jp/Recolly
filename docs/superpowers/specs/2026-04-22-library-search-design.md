# ライブラリ検索機能 設計書

- 作成日: 2026-04-22
- 対象ページ: `/library`（マイライブラリ）
- 関連 Issue: 未作成（本 spec 承認後に起票）

## 1. 背景と目的

マイライブラリには現在、ステータス・ジャンル・並び替え・タグの絞り込み手段しかなく、タイトルから記録を探す方法がない。記録件数が増えるほど「あの作品どこだっけ」という探索ニーズが発生する。

本機能で、**タイトルの部分一致によるキーワード検索**をライブラリに追加する。

### 非ゴール

- 感想文（`review_text`）横断検索 — YAGNI。需要が見えたら拡張
- タグ名での検索 — 既存のタグチップ UI で代替可能
- 英語タイトル（`metadata.title_english` / `title_romaji`）検索 — JSONB クエリになり複雑化。後から段階的に追加可能
- 全文検索エンジン（pg_trgm / Elasticsearch）— 記録件数規模では ILIKE で十分

## 2. 要件

### 2.1 機能要件

- `works.title` に対するキーワードの**部分一致**・**大文字小文字無視**での検索
- 既存フィルタ（status / media_type / tag）と **AND** で組み合わせ可能
- URL クエリパラメータ（`?q=xxx`）と同期。リロード・ブックマーク・戻る操作で復元
- デバウンス（300ms）により、入力確定後のみ API を呼ぶ
- キーワード変更時はページを 1 にリセット（既存のフィルタ変更挙動と同一）
- クリアボタン（`×`）で即時に検索解除

### 2.2 非機能要件

- レスポンス時間: 記録 1,000 件規模で 200ms 以内（ILIKE + 既存インデックス）
- フロントエンド追加バンドルサイズ: 最小限（新規依存ライブラリなし）
- アクセシビリティ: `aria-label` 必須、キーボードで検索・クリア可能

## 3. UI 配置

SectionTitle「マイライブラリ」の直下、filters 行の上に専用バーとして配置。

```
┌ マイライブラリ ─────────────────────────┐
│                                           │
│ [🔍 タイトルで検索...            ] [×]   │  ← 新規
│                                           │
│ [ステータス▾] [ジャンル▾] [並び替え▾]    │
│ タグ: #SF  #泣いた                       │
│ [レイアウト切替]                          │
│                                           │
│ 記録カード一覧                            │
└───────────────────────────────────────────┘
```

### 空状態の扱い

| 状態 | 検索バー表示 |
|------|-------------|
| 記録が 1 件もない（`isUnfilteredEmpty`） | **非表示**。既存の「作品を探して記録しましょう」ガイドを優先 |
| フィルタで 0 件 | 表示。検索で絞り込めることを示す |
| 検索で 0 件 | 表示し続ける。メッセージ「条件に一致する記録がありません」を流用 |

## 4. 実装設計

### 4.1 バックエンド

**変更ファイル**: `backend/app/controllers/concerns/record_filterable.rb` のみ

```ruby
def apply_filters(records)
  records = filter_by_status(records)
  records = filter_by_media_type(records)
  records = filter_by_work_id(records)
  records = filter_by_keyword(records)   # 追加
  filter_by_tags(records)
end

def filter_by_keyword(records)
  return records if params[:q].blank?

  keyword = params[:q].to_s.strip
  return records if keyword.empty?

  records.joins(:work).where(
    'works.title ILIKE ?',
    "%#{Work.sanitize_sql_like(keyword)}%"
  )
end
```

**設計判断**:

- `ILIKE` を採用: PostgreSQL 標準。大文字小文字無視で日本語も扱える
- `sanitize_sql_like`: LIKE メタ文字（`%`, `_`）のエスケープでユーザー入力の意図しない挙動を防ぐ
- `joins(:work)` は `filter_by_media_type` と重複するが、Rails は同じ join を重複追加しないため問題なし
- `params[:q].to_s.strip.empty?` チェック: 空白のみ入力で絞り込まないようにする
- インデックス追加は**しない**: 個人規模の記録件数では ILIKE フルスキャンでも十分高速。PostHog の使用実績を見てから判断する

### 4.2 フロントエンド

#### 新規コンポーネント: `SearchInput`

- パス: `frontend/src/components/ui/SearchInput/`
- 構成:
  - `SearchInput.tsx` — アイコン + `<input>` + クリアボタン
  - `SearchInput.module.css` — `tokens.css` 準拠のスタイル
  - `SearchInput.test.tsx` — ユニットテスト

**Props**:

```ts
type SearchInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  size?: 'sm' | 'md'
  'aria-label'?: string
}
```

**挙動**:

- value / onChange は制御コンポーネント
- value が空でないときのみクリアボタン（`×`）を表示
- クリアボタンで `onChange('')` を呼ぶ
- Enter キー押下時はフォーム送信を防ぐ（`onKeyDown` で `preventDefault`。デバウンスに任せる）
- デザイントークンのみで装飾。ハードコード値なし

#### `useLibrary` フックの拡張

変更点:

- URL パラメータ `q` を読み取り `q` state を公開
- `setQ(value: string)` を公開
- API 呼び出しに `q` パラメータを渡す
- `q` が変わったらページを 1 にリセット（既存 `updateParams` で担保）
- デバウンス処理は**フック内**で実施（`useDebounce` ユーティリティを作成 or インライン `useEffect`）

```ts
// デバウンス用
const [draftQ, setDraftQ] = useState(searchParams.get('q') ?? '')

useEffect(() => {
  const timer = setTimeout(() => {
    updateParams({ q: draftQ.trim() || null })
  }, 300)
  return () => clearTimeout(timer)
}, [draftQ, updateParams])
```

公開する API:
- `q: string`（URL 同期された現在値）
- `draftQ: string`（入力中の値）
- `setDraftQ: (v: string) => void`

#### `LibraryPage` の統合

SectionTitle の直下、filters の上に配置:

```tsx
<SectionTitle>マイライブラリ</SectionTitle>

{!isUnfilteredEmpty && (
  <SearchInput
    value={draftQ}
    onChange={setDraftQ}
    placeholder="タイトルで検索..."
    aria-label="ライブラリ内検索"
  />
)}

<div className={styles.filters}>
  {/* 既存 */}
</div>
```

**注意**: 「記録が1件もない状態」では検索バーを出さない。既存の `isUnfilteredEmpty` 判定に `q` は含めない（`q` だけ入っていて他フィルタなしの状態は「検索絞り込み中」なのでガイダンス非表示が正しい）。

#### `recordsApi` の拡張

```ts
getAll(params: {
  status?: RecordStatus
  mediaType?: MediaType
  sort?: SortOption
  page?: number
  perPage?: number
  tags?: string[]
  q?: string   // 追加
})
```

`q` を `URLSearchParams` に追加するだけ。

## 5. データフロー

```
[入力] ユーザーが SearchInput に入力
   ↓
[即時] setDraftQ で draftQ 更新（表示は即反映）
   ↓
[300ms待機] useEffect のデバウンスタイマー
   ↓
[URL更新] updateParams({ q: trimmed || null, page リセット })
   ↓
[発火] 既存の useEffect が searchParams 変化を検知
   ↓
[API] recordsApi.getAll({ q, status, mediaType, sort, page, perPage, tags })
   ↓
[SQL] ILIKE 絞り込み + AND フィルタ + ORDER + LIMIT/OFFSET
   ↓
[描画] records 更新 or 空状態メッセージ
```

## 6. エッジケースと振る舞い

| ケース | 挙動 |
|--------|------|
| 空文字 / 空白のみ入力 | `q` パラメータを URL から削除し、絞り込みなしに戻す |
| `%` `_` を含む入力 | `sanitize_sql_like` でエスケープし、リテラルとして扱う |
| 200 文字を超える入力 | `<input maxLength={200}>` で防ぐ |
| API エラー | 既存の `state.error` 表示を流用 |
| 検索中にフィルタ変更 | 既存の `useEffect` 依存配列に従い再フェッチ |
| 記録 0 件のユーザー | 検索バーを非表示にし、既存のガイドを優先 |
| 検索で 0 件 | 「条件に一致する記録がありません」を既存通り表示 |
| 戻る / 進む / リロード | `q` は URL に入っているので復元される |

## 7. テスト方針

### 7.1 Backend（RSpec request spec）

`spec/requests/api/v1/records_search_spec.rb` を新規作成:

- `GET /api/v1/records?q=xxx`: タイトルに xxx を含む records のみ返る
- 大文字小文字無視: `q=attack` で "Attack on Titan" がヒット
- 部分一致: `q=巨人` で『進撃の巨人』がヒット
- LIKE メタ文字エスケープ: `q=100%` がリテラル検索扱い
- `q` + `status=watching` の AND: 両方を満たすものだけ返る
- `q=""` / `q="   "`: 絞り込まれない（全件返る）
- 他ユーザーの記録は返らない（既存の認可維持）

### 7.2 Frontend

**`SearchInput.test.tsx`**（新規）:
- 初期値を表示する
- 入力時に `onChange` が呼ばれる
- value が空でないときクリアボタンが表示される
- クリアボタンで `onChange('')` が呼ばれる
- `aria-label` が付与される

**`LibraryPage.test.tsx`**（拡張）:
- SearchInput が描画される（記録あり時）
- 入力から 300ms 後に API が `q` パラメータ付きで呼ばれる
- クリアで `q` が URL から消える
- 記録 0 件時は SearchInput が表示されない
- 検索結果 0 件時は「条件に一致する記録がありません」が出る

## 8. 影響範囲

### 変更ファイル

| ファイル | 種別 | 概算変更行数 |
|---------|------|-------------|
| `backend/app/controllers/concerns/record_filterable.rb` | 修正 | +10 |
| `backend/spec/requests/api/v1/records_search_spec.rb` | 新規 | ~100 |
| `frontend/src/components/ui/SearchInput/SearchInput.tsx` | 新規 | ~60 |
| `frontend/src/components/ui/SearchInput/SearchInput.module.css` | 新規 | ~40 |
| `frontend/src/components/ui/SearchInput/SearchInput.test.tsx` | 新規 | ~60 |
| `frontend/src/pages/LibraryPage/useLibrary.ts` | 修正 | +30 |
| `frontend/src/pages/LibraryPage/LibraryPage.tsx` | 修正 | +5 |
| `frontend/src/pages/LibraryPage/LibraryPage.test.tsx` | 修正 | +40 |
| `frontend/src/lib/recordsApi.ts` | 修正 | +3 |

全ファイル CLAUDE.md の 200 行目安内に収まる。

### 既存機能への影響

- 既存のフィルタ・ソート・ページネーション・タグ絞り込み: **挙動不変**
- `/api/v1/records` のレスポンス形式: **変更なし**
- 既存のテスト: **破壊しない**（追加のみ）

## 9. セキュリティ

- **SQL インジェクション**: `ILIKE ?` プレースホルダと `sanitize_sql_like` で防御
- **認可**: 既存の `authenticate_user!` と `current_user.records` スコープで担保
- **XSS**: React のデフォルトエスケープで担保。検索ワードをそのまま描画する箇所はなし（ハイライトは本 spec の非ゴール）

## 10. 将来の拡張余地（本 spec の対象外）

- 感想文 `review_text` 横断検索（`OR` で ILIKE を重ねる）
- 英語タイトル（`metadata->>'title_english'`）検索
- 検索ワードのハイライト表示
- 検索履歴（LocalStorage）
- pg_trgm / 全文検索導入（記録件数が数万件規模になった場合）
