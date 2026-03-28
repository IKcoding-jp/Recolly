# UI改善 5項目 — 仕様書

## 概要

フロントエンドの微細なUI改善をまとめて実施する。検索ページ、マイライブラリ、ヘッダー、検索結果カード、作品詳細ページの5箇所を対象とする。

バックエンド変更は不要。すべてフロントエンドの表示制御のみで対応する。

## 改善項目

### 1. 検索ページ — 手動登録セクションのデザイン改善

**現状の問題:**
- `SectionTitle`（「手動登録」）+ ghostボタン（「作品を手動で登録する」）の構成が地味で、何のための機能か分かりにくい。

**改善内容:**
- `SectionTitle`（「手動登録」見出し）を削除する。
- 破線ボーダー（`border: 1px dashed`）のカードで囲む。
- ガイドテキスト「お探しの作品が見つかりませんか？」を追加する。
- ボタンを `ghost` → `secondary`（アウトライン）に変更し、「+ 手動で登録する」に変更する。

**対象ファイル:**
- `frontend/src/pages/SearchPage/SearchPage.tsx`
- `frontend/src/pages/SearchPage/SearchPage.module.css`

### 2. マイライブラリ — 空状態アイコンの改善

**現状の問題:**
- 空状態のアイコンに絵文字（📚）を使用している。OSごとに見た目が異なり、デザインの統一感がない。

**改善内容:**
- 絵文字 `📚` をLucide SVGアイコン（book-open-text相当）に置き換える。
- インラインSVGで実装する（外部ライブラリの追加は不要）。
- アイコンサイズ: 48x48px、色: `var(--color-text-muted)`。

**対象ファイル:**
- `frontend/src/pages/LibraryPage/LibraryPage.tsx`

### 3. ヘッダー — マイページの配置変更

**現状の問題:**
- 「マイページ」がナビゲーションリンクとアバタードロップダウンの両方に存在し、重複している。
- ドロップダウン内の順番が「設定→マイページ」で不自然。

**改善内容:**
- `NAV_ITEMS` から `{ label: 'マイページ', path: '/mypage' }` を削除する。
- `UserMenu.tsx` のドロップダウンで「マイページ」リンクを「設定」リンクの上に移動する（マイページ→設定の順にする）。

**対象ファイル:**
- `frontend/src/components/ui/NavBar/NavBar.tsx`
- `frontend/src/components/ui/UserMenu/UserMenu.tsx`

### 4. 検索結果カード — 「記録する」ボタンの位置統一

**現状の問題:**
- 「記録する」ボタンが `.info` 内のコンテンツフローに従っており、タイトルや説明文の長さによってボタンの縦位置がカードごとにバラバラになる。

**改善内容:**
- ボタン（および「記録済み」テキスト）を `.info` の外に出し、カード右端に独立して配置する。
- カードレイアウトを `カバー画像 | テキスト情報 | ボタン` の3カラム構成に変更する。
- カード全体を `align-items: flex-start` で上揃えにする。
- ボタンに `flex-shrink: 0` を設定し、テキスト領域が自由に伸縮できるようにする。

**対象ファイル:**
- `frontend/src/components/WorkCard/WorkCard.tsx`
- `frontend/src/components/WorkCard/WorkCard.module.css`

### 5. 作品詳細ページ — 単発作品の進捗UI最適化

**現状の問題:**
- すべてのメディアタイプで「進捗（0話）」と「再視聴回数」が表示される。
- ゲーム・映画・本など話数の概念がない作品に「話」が表示されるのは不適切。
- ゲームに「再視聴」と表示されるのも不適切。

**改善内容:**

進捗セクションの表示制御:
- `EPISODE_MEDIA_TYPES`（anime, drama, manga）に含まれるメディアタイプのみ進捗セクションを表示する。
- 映画・本・ゲームでは進捗セクションを非表示にする。

再視聴/再読ラベルの動的変更:

| メディアタイプ | 進捗セクション | 再視聴ラベル |
|--------------|--------------|------------|
| アニメ | 表示（X話 / Y話） | 再視聴回数 |
| ドラマ | 表示（X話 / Y話） | 再視聴回数 |
| 漫画 | 表示（X巻 / Y巻） | 再読回数 |
| 映画 | 非表示 | 再視聴回数 |
| 本 | 非表示 | 再読回数 |
| ゲーム | 非表示 | リプレイ回数 |

ProgressControlの修正:
- `mediaType` プロップを追加し、`mediaTypeUtils.ts` の `UNIT_LABELS` を使って単位（話/巻）を動的に表示する。

再視聴ラベルの実装:
- `mediaTypeUtils.ts` に再視聴ラベルを返す関数を追加する（video→再視聴回数、reading→再読回数、game→リプレイ回数）。

**対象ファイル:**
- `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`
- `frontend/src/components/ui/ProgressControl/ProgressControl.tsx`
- `frontend/src/lib/mediaTypeUtils.ts`

## 対象外

- バックエンドの変更（APIの変更は不要）
- モバイル用BottomTabBarの変更（ナビからマイページを削除するのはPC版のみ。モバイルは別途検討）
- フィルタUIのスタイル変更（今回のスコープ外）
