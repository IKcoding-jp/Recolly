# ランディングページ — 設計仕様書

**作成日**: 2026-04-14
**背景文書**: `docs/product-marketing-context.md`、`docs/TODO.md` フェーズ5「ランディングページ」
**関連 PR**: #145 (analytics-tracking Phase 1 — PostHog 導入済み)

---

## 1. 概要

### 1.1 目的

未ログインユーザーが `/` を訪問したときに表示される、Recolly の訴求ページを新設する。現状 `/` は `RootRedirect` コンポーネントで未ログイン時に即座に `/login` へリダイレクトされており、**訴求面がゼロの状態**。このままでは SEO 流入・SNS リンク・口コミ流入のどれも受け皿がなく、PR #145 で導入した PostHog の計測も意味をなさない。

本 LP はその「受け皿」を作ることが目的。

### 1.2 ゴール指標

PR #145 で導入した PostHog イベントで以下を計測する:

| 指標 | 定義 | 備考 |
|---|---|---|
| LP 訪問数 | `$pageview` で `/` がログイン済みではない状態で表示された回数 | SPA pageview は既に実装済み |
| LP → 登録フォームクリック率 | `signup_completed` / `$pageview('/')` | PR #145 で `signup_completed` 実装済み |
| LP → 初回記録到達率 | `record_created` ユーザー / `signup_completed` ユーザー | 既存イベントのファネル |

### 1.3 スコープ

本仕様の対象:
- `/` ルートの未ログイン時の挙動変更（LP 表示）
- LP の UI 実装（セクション構成、コピー、スタイル、アニメーション）
- 既存 Footer コンポーネント との接続
- 認証状態に応じたリダイレクト維持（ログイン済み → `/dashboard`）

本仕様の対象外（Out of Scope）:
- A/B テスト基盤の導入
- LP 専用の OG 画像・favicon 差し替え（別タスク）
- 多言語対応（英語 LP 等）
- `/welcome` のような LP 専用 URL への別配置
- Phase 2 差別化機能（非公開モード、per-media レコメンド）の訴求
- README へのマネタイズ約束文追記（別タスクで対応）

---

## 2. 訴求戦略

### 2.1 ポジショニング

Recolly の差別化軸は `product-marketing-context.md` セクション 6 で定義されている 4 点:

1. **6 ジャンル横断の一元管理**（唯一無二の強み）
2. 統一 10 点評価
3. ワンクリック進捗更新
4. クリーン UI

本 LP では **「1. 6 ジャンル横断」を訴求の主軸**に据え、2〜4 を補助的に説明する構成とする。

### 2.2 問題提起の切り口

brainstorming の過程で、以下の教訓を得た:

- **「進捗忘れ」問題は使わない** — Netflix / Hulu / Amazon Prime / Kindle / Steam などの既存サービスは「続きから再生」や自動同期で既に解決している。Recolly がこれを差別化軸として訴求しても意味がない。
- **「マルチアプリ疲労」問題は使わない** — 極めて狭いセグメントで、自覚していない層には刺さらない。product-marketing-context.md のビーチヘッドとして定義されているが、LP の問題提起としては前面に出さない。
- **「履歴の散在」問題を使う** — Netflix / Kindle / Steam は便利だが、ジャンルをまたいで一箇所で振り返れる場所がない、という**補完関係**の問い。既存サービスへの敬意を保ったまま Recolly のポジションを提示できる。

### 2.3 避けるべき言葉遣い

既存サービス（Netflix / Kindle / Steam / Annict / Filmarks / 読書メーター 等）への**批判的言及は一切しない**。具体的には:

- ❌ 「切り替え疲れ」
- ❌ 「二度手間」
- ❌ 「評価基準がバラバラで困る」
- ❌ 「散らばって鬱陶しい」

代わりに以下のトーンで書く:

- ✅ 「Netflix に視聴履歴、Kindle に読書履歴、Steam にプレイ時間。一つ一つは便利なのに、ジャンルをまたいで一箇所で振り返れる場所がない」
- ✅ 「既存の配信・電子書籍サービスで味わった作品を、まとめて記録し振り返る場所」
- ✅ 「視聴や読書はこれまで通り既存のサービスで、記録と振り返りは Recolly で」

### 2.4 ブランドボイス

`product-marketing-context.md` セクション 10 の「静か・上品・落ち着き」は継承するが、brainstorming で「**文芸調・エディトリアル調はキザでうざい**」という学びを得たため、以下のトーンに着地させる:

- 普通の日本語。詩的でも衒学的でもない
- 「Chapter I」「ローマ数字 i. ii. iii.」のような装飾表現は使わない
- 強い言葉（最強・革命・神）も、絵文字も使わない
- 機能の具体説明ベースで書く

---

## 3. 画面構成

### 3.1 セクション一覧

| # | セクション | 主目的 | 背景色 |
|---|---|---|---|
| — | ナビゲーション（固定ヘッダー） | ブランド表示 / 特徴・使い方・FAQ リンク / CTA | 半透明白（スクロールで罫線追加） |
| — | ヒーロー | 主訴求とメイン CTA | `--color-bg`（オフホワイト） |
| 01 | 問題提起 — 散らばる履歴 | 既存サービス併用者の「俯瞰できない」問題を言語化 | `--color-bg-paper`（ベージュ） |
| 02 | できること（ソリューション） | 4 特徴を 2×2 で提示 | `--color-bg`（白） |
| 03 | 使い方（How it works） | 3 ステップで体験を見せる | `--color-bg-paper`（ベージュ） |
| 04 | 数か月後、数年後に（振り返り） | 長期価値（ライブラリとしての資産性）を説明 | `--color-bg`（白） |
| 05 | Creator's Note — なぜ作ったか | 作者の視点で共感を得る、既存サービスに敬意 | `--color-bg`（白） |
| 06 | 約束 — 永久無料 | マネタイズ方針を先出しして信頼を得る | `--color-text`（黒背景、白文字） |
| 07 | FAQ | 「Netflix との違い」「移行可否」等の 4 問答 | `--color-bg`（白） |
| — | 最終 CTA | 再掲 CTA | `--color-bg-paper`（ベージュ） |
| — | フッター | 既存 `Footer` コンポーネント（`/privacy` リンク含む） | `--color-bg`（白） |

### 3.2 ナビゲーション

- **位置**: `position: fixed` で常時画面上部に固定
- **スクロール挙動**: `scrollY > 20` で下部に罫線（`--color-border-light`）が現れる
- **ブランド名**: `Recolly`（Zen Kaku Gothic New Bold）
- **右側リンク**: 「特徴」「使い方」「FAQ」「ログイン」「無料で始める」
  - 前 3 つはページ内アンカー
  - 「ログイン」は `/login`
  - 「無料で始める」は `/signup`（黒背景ボタン）
- **非認証者専用**: この LP ナビは `/` の未ログイン状態のみ。ログイン済みなら `/dashboard` へリダイレクトされてこのページ自体を見ない。

### 3.3 ヒーロー

**レイアウト**: 2 カラム（左 1.15 : 右 1、最大幅 1200px）

**左カラム**:
- アイブロウ（罫線付き極小ラベル）: 「ジャンルをまたぐ、あなたの記録のための場所」
- メイン見出し（Zen Kaku Gothic New Bold、`clamp(32px, 3.8vw, 54px)`、3 行）:
  ```
  観たもの、読んだもの、
  プレイしたもの。
  全部ひとつの棚に。
  ```
- サブコピー: 「アニメ、映画、ドラマ、本、漫画、ゲーム。ジャンルをまたいで作品を記録・振り返りできるアプリです。」
- CTA: 「無料で始める」（黒背景ボタン、矢印付き）+ 「永久無料・カード不要」注記

**右カラム**: 3 枚の作品カードが浮遊するスタック装飾

- 各カードは以下の構成:
  - ジャンル色ドット + ジャンル名 + 連番（例: `#023`）
  - 作品タイトル（Bold）
  - 進捗バー（`::after` で `width: var(--p)` 指定）
  - 評価スコア（Fraunces 数字表示、例: `9.2 / 10`）
- 各カードに微妙な傾き（-3°, 2°, 1°）と浮遊アニメーション（`@keyframes float-1/2/3`、6〜8s）
- カードの作品サンプル:
  - Card 1: アニメ「葬送のフリーレン」9.2 / 10
  - Card 2: 本「コンビニ人間」8.6 / 10
  - Card 3: ゲーム「Outer Wilds」9.8 / 10
- サンプル作品は **ジャンル横断の具体例**として機能。アニメ・本・ゲームの 3 ジャンルを例示して多メディア対応をビジュアルで示す。

**下部**: ジャンル一覧（色ドット付き 6 個）
- アニメ / 映画 / ドラマ / 本 / 漫画 / ゲーム
- 各ジャンルの `--color-anime` 〜 `--color-game` トークンを使用

### 3.4 問題提起（01）

**レイアウト**: 2 カラム（左 1 : 右 1.3、最大幅 1200px、ベージュ背景）

**セクションラベル**: `01 散らばる履歴`

**左カラム見出し**（Zen Kaku Gothic Bold、4 行）:
```
観たドラマも、
読んだ本も、
プレイしたゲームも、
全部、別の場所。
```

**右カラム本文**:
> Netflix に視聴履歴、Kindle に読書履歴、Steam にプレイ時間。一つ一つは便利なのに、ジャンルをまたいで「自分が何を味わってきたか」を一箇所で振り返れる場所はありません。
>
> 好きだった作品に、メディアをまたいで戻れる場所を。

### 3.5 ソリューション（02）

**レイアウト**: 最大幅 1200px、白背景

**セクションラベル**: `02 できること`

**見出し**: 「ジャンルの壁を越えて、作品を記録する。」

**4 特徴カード**（2×2 グリッド、薄いボーダーで区切り）:

| # | タイトル | 説明 |
|---|---|---|
| 01 | 6 ジャンルをまとめて記録 | アニメ、映画、ドラマ、本、漫画、ゲーム。すべての作品を同じ使い心地で、一箇所に記録できます。 |
| 02 | 評価は 10 点満点で統一 | サービスごとに評価基準が違う問題をなくします。全作品を同じ尺度で並べられるので、過去の蓄積がそのまま比較可能な資産になります。 |
| 03 | いつでも振り返れるライブラリ | 「去年観たドラマってなんだっけ」にすぐ答えられます。タグや検索で、過去の記録に戻れます。 |
| 04 | シンプルで静かな UI | 派手な通知もランキング競争もありません。自分のペースで、落ち着いて使える場所です。 |

**重要な判断**: Phase 1 差別化点のうち「ワンクリック進捗更新」は特徴カードから外した。既存サービスが「続きから再生」で既に解決している問題のため、**差別化軸にならない**。機能としては実在するため、How it works（03）の「記録する」ステップの説明文に吸収する。

### 3.6 使い方（03）

**レイアウト**: 3 カラム、ベージュ背景、最大幅 1200px

**セクションラベル**: `03 使い方`

**見出し**: 「三ステップで、ライブラリが育つ。」

**3 ステップ**:

1. **探す** — 作品のタイトルで検索して、自分の棚に加えます。アニメも本もゲームも、入り口は一つ。
2. **記録する** — 観終わったら、読み終わったら、クリアしたら、評価とメモを残します。一言だけでも十分です。
3. **振り返る** — ライブラリや検索で、過去の作品にいつでも戻れます。ジャンルをまたいで、好きだったものを見返せます。

各ステップは Fraunces 数字（`1.` `2.` `3.`）+ 罫線見出し + 本文の構成。

### 3.7 振り返り（04）

**レイアウト**: 2 カラム、白背景、最大幅 1200px

**セクションラベル**: `04 数か月後、数年後に`

**左カラム見出し**:
```
続けていると、
自分の好みが
見えてくる。
```

**右カラム本文**:
> 記録を続けていると、ジャンルをまたいだ自分の好みが見えてきます。「去年一番よかったのは何だっけ」「最近こういうの観てるな」——過去の蓄積が、これからの作品選びのヒントになります。
>
> Recolly は、記録そのものよりも、振り返れるようになった後に価値が出るツールです。

**役割**: ソリューションの「スナップショット的価値」に対し、このセクションは **長期利用価値** を言語化する。短期的なメリット（横断記録）と、長期的なメリット（自分の好みの可視化）を両面で押さえる。

### 3.8 Creator's Note（05）

**レイアウト**: 中央寄せ、最大幅 720px、白背景

**セクションラベル**: `05 なぜ作ったか`

**本文**:
> 作者の IK です。好きな作品を振り返りたくなったとき、Netflix の視聴履歴を開き、Kindle のライブラリを開き、Steam のプレイ時間を見る——そんなことを何度もしていました。どれも便利なサービスです。
>
> でも、ジャンルをまたいで「自分が味わってきたもの」を一箇所で俯瞰する場所は、どこにもありませんでした。Recolly は、そのための場所として作りました。

**署名**: `— IK, 作者`

**役割**: プルーフ（実ユーザーの声）がゼロの段階で、**作者自身の動機**を明示することで最低限の説得力を担保する。既存サービスを「便利」と明示的に肯定することで、敵対的な構図を避ける。

### 3.9 永久無料の約束（06）

**レイアウト**: 最大幅 1200px、`--color-text`（黒）背景、`--color-bg` 文字

**セクションラベル**: `06 約束`（色は文字色 soft）

**見出し**: 「基本機能は、これから先も無料で使えます。」

**本文**:
> Recolly の**記録・ライブラリ・検索・おすすめ**は、これから先も無料で使えます。将来、詳細統計やデータエクスポートのような付加価値機能のみ有料化する可能性はありますが、あなたの日々の記録を人質にすることはありません。

**役割**: `product-marketing-context.md` セクション 12 の「永久無料 + 付加価値のみ有料化」方針を LP に明記する。マネタイズに対する不安を先回りして解消する、信頼醸成のためのセクション。

### 3.10 FAQ（07）

**レイアウト**: 最大幅 1200px、白背景

**セクションラベル**: `07 よくある質問`

**見出し**: 「よくある質問」

**Q&A 4 件**（罫線区切り）:

| # | Q | A |
|---|---|---|
| Q1 | Netflix や Kindle のような視聴・読書サービスとは何が違いますか？ | Recolly は、視聴や読書そのものを提供するサービスではありません。既存の配信・電子書籍サービスで味わった作品を「まとめて記録し、振り返る」ための場所です。視聴や読書はこれまで通り既存のサービスで、記録と振り返りは Recolly で、という使い方になります。 |
| Q2 | 他のサービスの記録は Recolly に移行できますか？ | 現状、エクスポート／インポート機能は対応していません。今後の検討事項として、ユーザーの声を見ながら判断していきます。 |
| Q3 | スマホと PC どちらでも使えますか？ | 両方で使えます。PWA に対応しているので、スマホのホーム画面に追加すればアプリのように起動できます。 |
| Q4 | 記録は他の人に公開されますか？ | プロフィールの一部は公開ベースの設計になっています。将来、より細かく公開範囲を選べる非公開モードを追加する予定です。 |

### 3.11 最終 CTA

**レイアウト**: 中央寄せ、ベージュ背景

**見出し**:
```
あなたの観たもの、読んだもの、プレイしたもの。
全部、ひとつの棚に。
```

**CTA**: 「無料で始める」（黒背景ボタン）+ 「永久無料・カード不要」注記

### 3.12 フッター

**既存の `components/ui/Footer/Footer` コンポーネントを再利用する**。LP 専用のフッターは作らない。

---

## 4. 実装設計

### 4.1 ファイル構成

**新規作成**:

- `frontend/src/pages/LandingPage/LandingPage.tsx` — LP 本体コンポーネント
- `frontend/src/pages/LandingPage/LandingPage.module.css` — LP 専用スタイル
- `frontend/src/pages/LandingPage/LandingPage.test.tsx` — LP のテスト
- `frontend/src/pages/LandingPage/sections/HeroSection.tsx` — ヒーロー
- `frontend/src/pages/LandingPage/sections/ProblemSection.tsx` — 問題提起
- `frontend/src/pages/LandingPage/sections/SolutionSection.tsx` — ソリューション
- `frontend/src/pages/LandingPage/sections/HowItWorksSection.tsx` — 使い方
- `frontend/src/pages/LandingPage/sections/ReflectSection.tsx` — 振り返り
- `frontend/src/pages/LandingPage/sections/CreatorNoteSection.tsx` — Creator's Note
- `frontend/src/pages/LandingPage/sections/PromiseSection.tsx` — 永久無料
- `frontend/src/pages/LandingPage/sections/FaqSection.tsx` — FAQ
- `frontend/src/pages/LandingPage/sections/FinalCtaSection.tsx` — 最終 CTA
- `frontend/src/pages/LandingPage/sections/LandingNav.tsx` — LP 専用ナビゲーション
- `frontend/src/pages/LandingPage/sections/useScrollReveal.ts` — Intersection Observer によるスクロール・リビール用 hook

**修正**:

- `frontend/src/App.tsx`
  - `RootRedirect` の未ログイン分岐を `/login` → `<LandingPage />` 直接描画に変更
  - 新規ルート `/` 用の lazy import を追加
- `frontend/src/styles/tokens.css`
  - `--color-bg-paper` (`#f4f0e6`) を追加
  - 必要に応じて `--color-text-soft` (`#9a9a9a`) を追加（既存の `--color-text-muted` では足りない場合）
  - `--color-accent` (`#c85a3f`) の追加可否は実装時に判断（現状は CTA ホバー等で使用）

**変更しない**:

- `frontend/index.html` — Fraunces + Zen Kaku Gothic New は既に読み込み済み、weight も十分
- `components/ui/Footer/` — 既存を再利用
- `components/ui/Button/` — 既存の Button に `variant="primary"` があれば再利用、ない場合は LP 専用 `btn-primary` クラスで対応（実装時判断）

### 4.2 ルーティング変更

現状:
```tsx
function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <div>読み込み中...</div>
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
}
```

変更後:
```tsx
function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <div>読み込み中...</div>
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <LandingPage />
}
```

- 関数名は `RootRedirect` → `RootRoute` に変更（リダイレクトではなくなるため）
- `/login` への自動リダイレクトを廃止
- `LandingPage` は `lazy()` 経由でコード分割

### 4.3 コンポーネント設計方針

- **単一ファイルにしない**: `LandingPage.tsx` は各セクションコンポーネントを並べるだけの薄いラッパーにする。セクションごとにファイル分割して、1 ファイル 150 行以内を目安にする（CLAUDE.md の規約）。
- **セクションは presentational**: データフェッチ・状態管理は一切なし。純粋に props のみで動くように設計する。
- **`useScrollReveal`** フック: Intersection Observer のロジックを hook として切り出し、各セクションで使える。複数のセクションで同じ observer インスタンスを共有してもよいが、`LandingPage.tsx` 側で 1 つ用意する。
- **既存のデザイントークン厳守**: `tokens.css` の CSS 変数のみ使用。新規トークンは `tokens.css` に追加してから使用する。
- **CSS Modules**: 各セクションごとに `.module.css` を持つ、または全体を `LandingPage.module.css` 1 ファイルにまとめる（実装時判断）。

### 4.4 アニメーション

- **スクロール・リビール**: `.reveal` クラス + Intersection Observer（`threshold: 0.12`、`rootMargin: '0px 0px -10% 0px'`）
- **ヒーローの初回表示**: `DOMContentLoaded` 後、`.hero .reveal` を順次 `in` クラスを付与してフェードインさせる
- **カードの浮遊**: CSS `@keyframes float-1/2/3`（6〜8s ease-in-out infinite）
- **`prefers-reduced-motion` への配慮**: 既存の `tokens.css` と同様、reduced-motion 設定のユーザーにはアニメーションを短縮または停止する。実装詳細は実装時に `useRecollyMotion` hook との整合性を見て判断。

### 4.5 レスポンシブ

- デスクトップ（>= 900px）: 上記の 2 カラム / 3 カラムレイアウト
- モバイル（< 900px）:
  - ナビは padding 圧縮、リンクは簡略化（ログイン / 無料で始めるのみ表示、または hamburger に対応。実装時判断）
  - すべての 2 カラム / 3 カラムは 1 カラムに折りたたむ
  - ヒーロー右側の 3 カード・スタックは縦に並べる、または高さを圧縮
  - section padding を `120px 48px` → `80px 24px` に縮小

### 4.6 ダミー作品データの扱い

ヒーロー右側の 3 作品カード（フリーレン、コンビニ人間、Outer Wilds）は**静的な装飾**。実 API からデータを取得せず、JSX にハードコードする。

**重要**: これらの作品名は **外部作品の商標**である可能性がある。LP の公開段階では以下のいずれかの対応を取る:
- A) 架空の作品名に差し替える（例: 「星屑の図書館」など）
- B) 作品名は表示せず「アニメ / 本 / ゲーム」のようなジャンル表示のみにする
- C) 実作品名のまま公開し、商標問題は後から判断する

この判断は**実装段階ではなく、公開準備段階で再確認**する。実装段階ではモック通り実作品名で仮実装しておき、本番公開前に IK さんの判断を仰ぐ。

---

## 5. デザイントークン

### 5.1 追加が必要なトークン

```css
:root {
  /* LP で新規追加 */
  --color-bg-paper: #f4f0e6;  /* セクション背景のベージュ */
  --color-text-soft: #9a9a9a; /* より薄いグレー、注記用 */
  --color-accent: #c85a3f;    /* CTA ホバー等のアクセント（要検討） */
}
```

`--color-text-soft` と `--color-accent` は、既存の `--color-text-muted` や他のトークンで代用できる可能性もある。実装時に本当に必要かを判断する。

### 5.2 既存トークンの使用

すべて既存の `tokens.css` で定義済み:
- `--color-bg`, `--color-bg-white`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-border-light`
- `--color-anime`, `--color-movie`, `--color-drama`, `--color-book`, `--color-manga`, `--color-game`
- `--font-body` (Zen Kaku Gothic New), `--font-heading` (Fraunces)
- `--font-size-*`, `--font-weight-*`, `--line-height-*`
- `--spacing-*`
- `--radius-*`
- `--transition-fast`, `--transition-normal`, `--transition-slow`

モックでは `--font-accent` という別名で Fraunces を参照したが、実装では既存の `--font-heading` をそのまま使う。

### 5.3 フォントの使用方針

- **本文・見出し**: `--font-body`（Zen Kaku Gothic New）。Bold (700) を見出しに使用。
- **アクセント数字のみ**: `--font-heading`（Fraunces）。セクション番号ラベル (`01` `02` ...)、ヒーローカードの評価スコア、使い方の `1.` `2.` `3.`、FAQ の `Q1` `Q2` ... に使用。
- **文芸調の見出し全般での Fraunces 使用は禁止**（キザになるため）。

---

## 6. アクセシビリティ

- セクションには適切なランドマーク（`<section>`、`<nav>`、`<footer>`）を使用する
- 見出しは `<h1>` → `<h2>` の階層を守る。ヒーローが `h1`、各セクション見出しが `h2`、特徴カード見出しが `h3`。
- CTA リンクは `<a>` タグで適切に書く（`<button>` では不可、ルーティングのため）
- カラーコントラストは WCAG AA を満たす。特に黒背景の「永久無料」セクションで `#c8c4b8` の本文色が `--color-text` 背景に対して AA を満たしているかを実装時に検証する。
- `prefers-reduced-motion: reduce` の環境では、スクロール・リビールと浮遊アニメーションを停止する
- スクリーンリーダー向けに、ヒーロー右側の装飾カードが**ただの装飾**であることを明示する（`aria-hidden="true"` を検討）

---

## 7. SEO

- `<title>`: 「Recolly — 観たもの、読んだもの、プレイしたもの。全部ひとつの棚に。」
- `<meta name="description">`: 「アニメ、映画、ドラマ、本、漫画、ゲーム。ジャンルをまたいで作品を記録・振り返りできるアプリです。」
- `<meta property="og:title">` / `<meta property="og:description">` / `<meta property="og:type" content="website">` を追加
- `og:image` は**本仕様の対象外**。別タスクで 1200x630px の画像を作成する。
- Canonical URL: `https://<recolly-domain>/`
- サイトマップ: 既存のサイトマップがあれば `/` を追加（現状未確認、実装時に検証）

---

## 8. テスト戦略

### 8.1 ユニットテスト（Vitest + React Testing Library）

各セクションコンポーネントに対して以下を検証:

- **LandingPage.test.tsx**
  - 全セクションがレンダリングされる（ヒーローの見出し、01〜07 ラベル、最終 CTA の見出しが画面に存在）
  - CTA ボタン（`/signup` へのリンク）が複数箇所に存在する（ヒーロー + 最終 CTA）
  - ナビの「ログイン」リンクが `/login` を指す
  - Footer が表示される（既存コンポーネント経由）

- **各セクションコンポーネント**
  - 見出しテキストのレンダリング確認
  - 内部リンクの href 確認
  - `reveal` クラスが正しく付与される（`useScrollReveal` のテストと統合）

- **App.tsx の RootRoute**
  - 未ログイン時に LandingPage が表示される
  - ログイン済みで `/dashboard` へリダイレクトされる
  - ロード中に「読み込み中...」が表示される

### 8.2 手動検証

- デスクトップ（1920×1080 / 1440×900）でのレイアウト確認
- モバイル（375×812 / 414×896）でのレイアウト確認
- ダークモード / ライトモードの切り替え（現状 Recolly はライト専用）
- スクロール・リビールが全セクションで発火するか
- ヒーロー初回アニメーションが正しく staggered reveal するか
- PostHog Live events で `/` ページの `$pageview` が届くか
- 「無料で始める」クリックで `/signup` に遷移するか
- `signup_completed` イベントが `method: 'email'` / `'google'` で発火するか（PR #145 の動作維持確認）

### 8.3 Playwright 自動確認（実装後）

- LP が表示される → ヒーロー CTA クリック → `/signup` へ遷移することを E2E で確認
- 各セクションのアクセシビリティ（見出し階層、ランドマーク）の自動検証

---

## 9. 非機能要件

### 9.1 パフォーマンス

- LP は `lazy()` でコード分割する。初回ロードバンドルに含めない。
- 画像アセットは極力使わない（現状ヒーローの装飾カードは全て CSS で描画）
- Google Fonts は既に index.html で読み込み済みなので追加ロードなし
- アニメーションは CSS のみで完結させる（JS は Intersection Observer のみ）
- LCP (Largest Contentful Paint) < 2.5s を目標

### 9.2 ブラウザ対応

既存 Recolly と同じ:
- Chrome / Edge / Safari 最新 2 バージョン
- Firefox 最新バージョン
- iOS Safari / Android Chrome 最新バージョン

### 9.3 失敗時の振る舞い

- LP 自体は完全にクライアントサイド描画のため、外部依存（API）がない。描画失敗は基本的に起きない。
- PostHog の `$pageview` 発火は既に PR #145 で実装されており、失敗してもサイレントに握りつぶされる（`initialized` ガード + try/catch）。LP は影響を受けない。

---

## 10. 実装後のフォロー（別タスク）

本仕様の対象外だが、LP 公開後に実施すべき項目:

- **OG 画像作成**（1200×630px、LP のヒーローを元にしたデザイン）
- **README の更新** — マネタイズ約束文「基本機能は永久無料」を追記（TODO.md フェーズ5 の別項目）
- **ダミー作品名の最終決定** — 架空作品に差し替えるか、実作品のまま公開するかを IK さんと判断
- **PostHog Dashboard 作成** — LP 流入 → signup_completed のファネル Insight
- **初期ユーザーインタビュー** — LP の verbatim を実データで更新
- **A/B テスト基盤**（PostHog 機能フラグ経由、実需要が見えてから）

---

## 11. 関連文書

- **背景**: `docs/product-marketing-context.md` セクション 1, 2, 6, 10, 12
- **TODO**: `docs/TODO.md` フェーズ5「ランディングページ」
- **前提 PR**: #145 (PostHog 導入、`$pageview` / `signup_completed` 実装済み)
- **デザイントークン**: `frontend/src/styles/tokens.css`
- **既存共通コンポーネント**: `frontend/src/components/ui/Footer/`、`frontend/src/components/ui/Button/`
- **モック**: `mockups/landing-page.html`（本仕様書と同じフローで作成した HTML プロトタイプ。実装の視覚的参照用）
