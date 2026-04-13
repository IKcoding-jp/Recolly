# 作品詳細ページ 感想タブ 表示/編集モード化 設計

**日付:** 2026-04-14
**対象機能:** 作品詳細ページ（`/works/:id`）の「感想」タブ内 `ReviewSection` コンポーネント
**スコープ:** フロントエンドのみ（バックエンド変更なし）

---

## 背景

現状、作品詳細ページの「感想」タブに配置されている `ReviewSection` コンポーネントは、`FormTextarea`（`rows=4` 固定）で感想を表示・編集している。長文の感想を書くと、テキストエリア内でスクロールが発生し、全文を一覧できない。

ユーザーからの要望:

> 動的に自分の感想が全部表示されるようにしたい。

この「全部表示」を満たすため、感想を **表示モード（全文展開）** と **編集モード（テキストエリア）** に分離する。データモデル（`records.review_text` カラム）は変更しない。

## 非目標

以下は今回のスコープ外：

- 複数の感想を時系列で保存する機能（1作品1感想を維持）
- Markdown 等の書式対応
- リッチテキストエディタ
- 感想のバージョン履歴
- 感想の公開/非公開設定
- バックエンドのデータモデル変更

## 要件

### 機能要件

1. **表示モード**: 感想がある場合、本文を全文展開して表示する。スクロールさせない。
2. **編集モード**: 「編集」ボタンから切り替え、`FormTextarea` で編集できる。
3. **空状態**: 感想が未記入（`null` または空文字）の場合、「まだ感想が書かれていません」メッセージと「感想を書く」ボタンを表示する。
4. **改行保持**: プレーンテキストの改行を表示モードで保持する（`white-space: pre-wrap`）。
5. **保存**: 編集モードで「保存」ボタンを押すと既存の `onSave` プロップを介してバックエンドに保存する。
6. **キャンセル**: 編集モードで「キャンセル」ボタンを押すと、編集内容を破棄して元のモード（空状態 or 表示モード）に戻る。確認ダイアログは表示しない。
7. **エラーハンドリング**: 保存失敗時はエラーメッセージを表示し、編集モードに留まる（入力内容を失わない）。

### 非機能要件

- **API互換性**: `ReviewSection` の外部Props（`reviewText`, `onSave`）は変更しない。
- **バックエンド非変更**: `records.review_text` カラムと `PATCH /api/v1/records/:id` は変更しない。
- **デザイントークン遵守**: すべてのスタイル値は `tokens.css` の CSS 変数を使用する（CLAUDE.md 参照）。
- **ファイルサイズ**: `ReviewSection.tsx` は 200 行以内に収める（CLAUDE.md 参照）。
- **レスポンシブ**: モバイル（〜768px）でも自然に動作する。タッチターゲット 44px 以上。

---

## コンポーネント構造（方針1: 単一コンポーネント内での状態分岐）

### 変更対象ファイル

- `frontend/src/components/ReviewSection/ReviewSection.tsx`（機能拡張）
- `frontend/src/components/ReviewSection/ReviewSection.module.css`（スタイル追加）
- `frontend/src/components/ReviewSection/ReviewSection.test.tsx`（テスト書き換え + 追加）

### 変更しないファイル

- `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`
- `frontend/src/pages/WorkDetailPage/useWorkDetail.ts`
- バックエンドのファイル全般

### Props（変更なし）

```typescript
type ReviewSectionProps = {
  reviewText: string | null
  onSave: (text: string) => Promise<void> | void
}
```

### 内部状態

```typescript
type Mode = 'empty' | 'view' | 'edit'

const [mode, setMode] = useState<Mode>(initialMode)
const [draft, setDraft] = useState<string>(reviewText ?? '')
const [isSaving, setIsSaving] = useState<boolean>(false)
const [saveError, setSaveError] = useState<string | null>(null)
```

初期モードは `reviewText` の値から計算する：

```typescript
const initialMode: Mode = reviewText ? 'view' : 'empty'
```

### 状態遷移

```
empty  --[「感想を書く」クリック]-------------------->  edit
view   --[「編集」クリック]-------------------------->  edit
edit   --[保存成功（reviewText が更新される）]------->  view
edit   --[キャンセル]----------------------------->  元のモード（empty or view）
edit   --[保存失敗]---------------------------------->  edit（エラー表示）
```

### 親データ同期

```typescript
useEffect(() => {
  // 編集中でなければ、親の値に mode と draft を追従させる
  if (mode !== 'edit') {
    setMode(reviewText ? 'view' : 'empty')
    setDraft(reviewText ?? '')
  }
}, [reviewText])
```

`mode === 'edit'` の時は親からの `reviewText` 変化を無視する（ユーザーの入力を上書きしないため）。

---

## データフロー

### 保存フロー

1. `edit` モードで `FormTextarea` に入力 → `setDraft(value)`
2. 「保存」ボタンをクリック
3. `setIsSaving(true)`, `setSaveError(null)`
4. `await onSave(draft)` を呼ぶ
5. 成功時: 親が `record.review_text` を更新 → `reviewText` プロップが変化 → `useEffect` が発火 → `mode` が `'view'` に戻る
6. 失敗時: `setSaveError('保存に失敗しました。もう一度お試しください。')`、`mode` は `'edit'` のまま
7. `finally` で `setIsSaving(false)`

### キャンセルフロー

1. `edit` モードで「キャンセル」ボタンをクリック
2. `setDraft(reviewText ?? '')` で編集内容を破棄
3. `setMode(reviewText ? 'view' : 'empty')` で元のモードに戻す
4. `setSaveError(null)` でエラー表示をクリア

### 空状態からの編集開始

1. `empty` モードで「感想を書く」ボタンをクリック
2. `setMode('edit')`, `setDraft('')`

### 表示モードからの編集開始

1. `view` モードで「編集」ボタンをクリック
2. `setMode('edit')`, `setDraft(reviewText ?? '')`

---

## UI 仕様

### 共通ルール

- スタイル値はすべて `tokens.css` の CSS 変数を使用（色、スペーシング、角丸、フォント）
- フォーム入力は `FormTextarea` のみ使用（生の `<textarea>` 禁止）
- ボタンは `Button` コンポーネントを使用

### `empty` モード

- 外枠: 薄い罫線または点線のコンテナ
- メッセージ: 「まだ感想が書かれていません」（`--color-text-secondary` 相当）
- ボタン: `<Button variant="primary" size="sm">感想を書く</Button>`
- 中央揃え、余白は `var(--spacing-*)` で調整

### `view` モード

- 右上に編集ボタン: `<Button variant="secondary" size="sm">編集</Button>`
- 本文エリア: `<p>` または `<div>` に以下のスタイル
  - `white-space: pre-wrap`（改行保持）
  - `line-height`: 読みやすい値（既存トークンを優先、なければ 1.8 程度）
  - `color: var(--color-text)`
  - 背景・余白は既存 section と合わせる
- 本文は最大幅でコンテナに追従、縦は内容に合わせて自動伸張

### `edit` モード

- `<FormTextarea rows={8}>` （従来の `rows=4` から拡大）
- `draft` の値をバインド、`onChange` で `setDraft` を呼ぶ
- エラーメッセージ: `saveError` が非 null の時、テキストエリアの下、ボタンの上に1行表示
- ボタン配置: 右寄せ
  - `<Button variant="secondary" size="sm" onClick={handleCancel}>キャンセル</Button>`
  - `<Button variant="primary" size="sm" disabled={isSaving} onClick={handleSave}>{isSaving ? '保存中...' : '保存'}</Button>`
- 編集モードでは保存ボタンを常に表示（従来の「dirty 時のみ表示」ロジックは廃止）

### レスポンシブ

- スマホ: タッチターゲット 44px 以上を維持（既存の Button コンポーネントで担保）
- テキストエリアの高さはスマホでも十分な領域を確保

---

## エラーハンドリング

### 保存失敗

1. `onSave` が Promise を reject、または例外を throw した場合に `catch` で捕捉
2. `saveError` に日本語メッセージをセット（「保存に失敗しました。もう一度お試しください。」）
3. `mode` は `'edit'` のまま留まる（入力内容を失わない）
4. ユーザーは「保存」ボタンを再度押すことで再試行できる
5. 再試行時は先頭で `setSaveError(null)` を呼び、前回のエラー表示をクリア

### 親ハンドラ側の調整

現状の `useWorkDetail.handleReviewTextSave` が例外を throw するかどうかは実装時に確認する。throw しない場合（エラーが握りつぶされる場合）は、親側で throw するように調整が必要。この調整は実装プラン作成時に判断する。

### 既存のエラー表示コンポーネント再利用

`frontend/src/components/ui/ActionErrorCard/ActionErrorCard.tsx` が既存にある。これが流用できそうなら再利用し、そうでなければシンプルなテキスト要素でエラーを表示する。判断は実装プラン作成時に行う。

---

## テスト観点

### テストフレームワーク

Vitest + React Testing Library + `@testing-library/user-event`。
ファイル: `frontend/src/components/ReviewSection/ReviewSection.test.tsx`（既存拡張）。

### テストケース一覧

#### `empty` モード

1. `reviewText` が `null` の時、「まだ感想が書かれていません」メッセージが表示される
2. `reviewText` が空文字の時、空状態メッセージが表示される
3. 空状態で「感想を書く」ボタンをクリックすると編集モードに切り替わる
4. 空状態では「編集」ボタンも「保存」ボタンも表示されない

#### `view` モード

5. `reviewText` に値がある時、本文が全文表示される
6. `reviewText` に改行を含むテキストが渡された時、改行が視覚的に保持される
7. `view` モードで「編集」ボタンをクリックすると編集モードに切り替わる
8. `view` モードではテキストエリアは表示されない

#### `edit` モード

9. 編集モードでテキストエリアに既存の `reviewText` が入っている
10. テキストを変更して「保存」ボタンをクリックすると `onSave` が新しいテキストで呼ばれる
11. 保存中は「保存」ボタンが「保存中...」表示になり disabled になる
12. 保存成功後、新しい `reviewText` がプロップで渡されると `view` モードに戻る
13. 「キャンセル」ボタンをクリックすると編集内容が破棄され、元のモードに戻る
14. `reviewText` が `null` の状態から編集モードに入り、キャンセルすると `empty` に戻る
15. `reviewText` に値がある状態から編集モードに入り、キャンセルすると `view` に戻る

#### エラーハンドリング

16. `onSave` が例外を投げた場合、エラーメッセージが表示される
17. エラー表示後、もう一度「保存」ボタンを押すとエラーがクリアされて再試行される
18. 保存失敗時は編集モードに留まる（入力内容が失われない）

#### 編集中の親データ同期

19. 編集中（`mode === 'edit'`）に親から `reviewText` が更新されても、`draft` は上書きされない

### 既存テストの取り扱い

現行の `ReviewSection.test.tsx` には 5 つのテストがある。すべて設計変更に伴い書き換える：

- 「感想テキストを表示する」→ 表示モードでの表示確認に変更
- 「未記入時にプレースホルダーを表示する」→ 空状態メッセージ確認に変更
- 「テキスト変更時に保存ボタンを表示する」→ 編集モードで常に保存ボタン表示に変更
- 「テキスト未変更時は保存ボタンを非表示にする」→ 削除（編集モードでは常に表示するため）
- 「保存ボタン押下時に onSave が呼ばれる」→ 編集モードに入ってから実行する流れに変更

### WorkDetailPage.test.tsx の扱い

外部 API が変わらないため、`WorkDetailPage.test.tsx` は変更しない。テストが失敗する場合は方針1の前提（外部 API 不変）が崩れているため、実装プラン段階で警告する。

### Storybook

Recolly は Storybook を導入していないため対応不要。

---

## 実装方針の要約

| 観点 | 決定 |
| --- | --- |
| 要求の解釈 | 単一感想を「表示モード」と「編集モード」に分ける（複数感想や書式対応は別スコープ） |
| 編集モード切替方式 | インライン切替（モーダル/別ページは不採用） |
| 書式対応 | プレーンテキスト + 改行保持（`white-space: pre-wrap`） |
| 空状態 | 「感想を書く」ボタン付きの空状態メッセージ |
| 実装構造 | `ReviewSection` 内で `mode` 分岐（コンポーネント分割せず） |
| バックエンド | 変更なし |
| 外部 API | `ReviewSectionProps` 変更なし |
| エラー時 | 編集モードに留まり、エラーメッセージ表示 |
| キャンセル確認 | なし（無言で破棄） |

---

## 参考: 決定の根拠

- **単一コンポーネント内分岐を選んだ理由**: 今回のタスクは振る舞いの変更であり、再利用性を高める作業ではない。`ReviewSection` の Props を維持すれば呼び出し側の変更が不要で、副作用が最小化される。現行 45 行 → 推定 120 行程度で CLAUDE.md の 200 行ルール内に収まる。将来コンポーネント分割が必要になれば、その時点でのリファクタが可能。
- **プレーンテキストを選んだ理由**: 既存カラム構造の変更不要、ライブラリ追加不要、サニタイズ検討不要で最小実装。Markdown 対応は別イシューとして切り出す方がスコープがブレない（YAGNI）。
- **空状態にボタンを設けた理由**: 誤タップを防ぎ、表示モードと編集モードの境界を明確にする。Recolly 既存の EmptyState パターンとも揃えやすい。
- **キャンセル確認なしを選んだ理由**: Recolly の他の編集 UI と一貫性を保つため。
