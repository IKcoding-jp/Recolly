# motion（旧 Framer Motion）— 学習ノート

## これは何か

React コンポーネントに「動き」をつけるための専用ライブラリ。
`<motion.div animate={{ opacity: 1 }}>` のように、HTML タグの代わりに専用のタグを使うと、そのタグに指定した「動かし方」が自動で実行される。

2024 年に Framer 社から独立し、`motion` というパッケージ名になった。それまでは `framer-motion` という名前だった。**求人票で「Framer Motion 使えます」と書かれているのは、ほぼ同じもの**と思ってよい。

### まず「なぜアニメーションライブラリが必要か」から

React だけではうまく実装できない動きが 2 つある：

**問題 1：要素が「消える瞬間」のアニメが作れない**

React の一般的な書き方：

```tsx
{showBanner && <Banner />}
```

`showBanner` が `false` になった**瞬間**、`<Banner />` は DOM から消える。CSS で `transition: opacity 0.3s` を書いていても、要素自体がなくなっているので効かない。**消える瞬間をアニメするには、「消えたあと少しだけ DOM に残す」仕掛けが必要**で、これは CSS だけでは実現できない。

**問題 2：リスト並べ替えのスムーズな移動ができない**

並び替えボタンを押したら、記録カードが「スッ」と新しい位置まで移動する動き。これも DOM を書き換えた瞬間に位置が瞬間移動するだけで、CSS transition では動かない（要素の position が変わるのではなく、DOM 順が変わるため）。

motion はこの 2 つを**専用の仕組み（AnimatePresence と layout プロパティ）**で解決してくれる。これが「入れる理由」。

---

## もう少し詳しく

### 基本の書き方：motion.div と 3 つの状態

motion の中核は `motion.div`（や `motion.button`、`motion.section` など）。普通の `div` と同じだが、`initial` / `animate` / `exit` という 3 つの**状態**を指定できる：

```tsx
<motion.div
  initial={{ opacity: 0, y: 16 }}   // 表示前：透明で16px下にいる
  animate={{ opacity: 1, y: 0 }}    // 表示後：不透明で元の位置
  exit={{ opacity: 0, y: -8 }}      // 消える時：透明で8px上
  transition={{ duration: 0.4 }}    // 動きにかける時間
>
  こんにちは
</motion.div>
```

- `initial` = マウントされる前の初期値
- `animate` = マウント後に向かう目標値
- `exit` = アンマウント時に向かう値（後述の `AnimatePresence` とセット）

「`opacity` が 0 から 1 になる」「`y` が 16 から 0 になる」のような変化を、motion が自動でヌルッと補間してくれる。CSS transition の JavaScript 版と思ってよい。

### variants：動きに名前をつけて再利用する

毎回 `initial` や `animate` に長いオブジェクトを書くのは大変。そこで**動きに名前をつけて使い回す**のが `variants`：

```tsx
const cardVariants = {
  hidden: { opacity: 0, y: 16 },      // ← hidden という名前の状態
  visible: { opacity: 1, y: 0 },      // ← visible という名前の状態
}

<motion.div variants={cardVariants} initial="hidden" animate="visible" />
```

`initial` と `animate` に**状態名（文字列）だけ**渡せばよくなる。同じ `cardVariants` を複数のコンポーネントで使い回せる。

**variants の強力なところ：親 → 子への自動伝播**

親に `initial="hidden"` `animate="visible"` と書くと、子の `motion.div` も**同じ名前の状態に自動で切り替わる**。つまり、

```tsx
<motion.div variants={listVariants} initial="hidden" animate="visible">
  {items.map((item) => (
    <motion.div key={item.id} variants={itemVariants} />
    //                        ↑ initial/animate を書かなくても親に追従する
  ))}
</motion.div>
```

これに `staggerChildren: 0.1` という transition を親に加えると、**子要素が 100ms ずつずれて順番にフェードインしてくる**という定番の演出になる（Recolly のホーム画面の記録カード一覧がまさにこれ）。

### AnimatePresence：消える瞬間を拾う

`{cond && <X />}` で要素が消えても普通は DOM から即座に消える。これを**ラップして監視する**のが `AnimatePresence`：

```tsx
<AnimatePresence>
  {showBanner && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}   // ← これが発動する
    >
      メール認証してください
    </motion.div>
  )}
</AnimatePresence>
```

仕組み：
1. `showBanner` が `false` になる
2. motion が「この子は消されようとしている」と検知
3. すぐに DOM から消さず、`exit` の状態に向かってアニメ
4. アニメが終わったら DOM から削除

**配置の罠**（重要・面接で聞かれそう）：条件分岐は `AnimatePresence` の**内側**に置く。外側に置くと、条件が false になった瞬間に `AnimatePresence` 自体が消えるので、exit アニメが拾えなくなる。

```tsx
// ❌ これだと exit が効かない
{showBanner && (
  <AnimatePresence>
    <motion.div exit={...} />
  </AnimatePresence>
)}

// ✅ こう書く
<AnimatePresence>
  {showBanner && <motion.div exit={...} />}
</AnimatePresence>
```

### useReducedMotion：アクセシビリティ対応

OS の設定に「視差効果を減らす」（Windows の「アニメーションを表示する」OFF、macOS の「視差効果を減らす」ON）というものがある。**乗り物酔いや三半規管の不調を抱える人にとって、画面の動きは実害がある**ため、OS 設定で動きを抑える仕組みが標準化されている。

これは WCAG（Web アクセシビリティ基準）2.1 の SC 2.3.3 という項目で要求されている。対応しないと「アクセシブルでない」と評価される。

motion は `useReducedMotion` フックで OS 設定を取得できる：

```tsx
import { useReducedMotion } from 'motion/react'

function Banner() {
  const shouldReduce = useReducedMotion()
  const variants = shouldReduce
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }  // フェードのみ
    : { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }  // 通常

  return <motion.div variants={variants} initial="hidden" animate="visible" />
}
```

**原則**：reduced-motion 有効時は、**translate/scale/rotate は使わず、opacity のみ**にする。これが WCAG の慣習。

### layout プロパティ（フェーズ 2 で出てくる予定）

`<motion.div layout>` と書くだけで、**そのコンポーネントの位置・サイズが変わった時に、前の位置から新しい位置まで自動でアニメしてくれる**。

仕組みは「FLIP テクニック」と呼ばれる：
- **F**irst: 変化前の位置を記録
- **L**ast: 変化後の位置を記録
- **I**nvert: 一旦 `transform` で変化前の位置に戻す
- **P**lay: `transform` を 0 に戻すアニメで新位置へ移動

例：並び替え機能。DOM 順を書き換えるだけで、motion が自動で各カードの「ここからここへ」を検出してアニメする。CSS だけでは実質不可能な動き。

Recolly では現時点（フェーズ 1）では未使用。並び替え機能を作る時に出てくる予定。

---

## Recolly でどう使っているか

### lib/motion/ — 共通モーション基盤

全ページでバラバラに variants を書くと統一感が失われる。Recolly では `frontend/src/lib/motion/` に**アニメーションのデザインシステム**を集約：

```
frontend/src/lib/motion/
├── tokens.ts           ← duration (fast/base/slow/slower) と easing の定数
├── variants.ts         ← listContainerVariants, fadeInUpVariants, modalVariants など
├── useRecollyMotion.ts ← reduced-motion 対応ラッパー（後述）
└── index.ts            ← 再エクスポート
```

**tokens.ts**：時間（秒）とイージングカーブを定数化。CSS 側の `tokens.css` の `--transition-*` と**同じ値で連動**させている（一貫性のため）。

```ts
export const duration = {
  fast: 0.16,   // 160ms — ホバー・フォーカス
  base: 0.24,   // 240ms — ボタンクリック
  slow: 0.38,   // 380ms — カード登場・モーダル開閉
  slower: 0.52, // 520ms — ページ遷移（予約）
}

export const easing = {
  snap: [0.32, 0.72, 0, 1],  // Snappy Modern: キビキビ止まる
  calm: [0.16, 1, 0.3, 1],   // Editorial Calm: ゆったり減速（最多）
  exit: [0.7, 0, 0.84, 0],   // 退場用: 最初緩やかで途中加速
}
```

**variants.ts**：よく使う動きに名前を付けた「レシピ集」。

| variant 名 | 用途 | 動き |
|----|----|----|
| `fadeInUpVariants` | リストアイテム登場 | 下 16px から上に移動しながらフェードイン |
| `listContainerVariants` | 上の親コンテナ | `staggerChildren: 0.1` で子を 100ms ずつずらす |
| `modalVariants` | モーダル本体 | opacity + scale + y で「奥から手前に出る」感覚 |
| `overlayVariants` | モーダル背景 | 半透明黒のフェードイン/アウト |
| `dropdownVariants` | ドロップダウン | 上から数 px スライドダウン |
| `toastVariants` | トースト通知 | 画面下からスライドイン |
| `bannerVariants` | ヘッダー下バナー | 上から高さごとスライドダウン |

### useRecollyMotion — reduced-motion 対応を 1 箇所に閉じ込める

各ページで `useReducedMotion()` を呼んで毎回 if 分岐を書くと、抜け漏れが発生する。
Recolly では `useRecollyMotion()` という**ラッパーフック**を作り、**全 variants が reduced-motion に対応した状態で返ってくる**ようにした：

```tsx
// frontend/src/pages/HomePage/HomePage.tsx より（抜粋）
import { motion, AnimatePresence } from 'motion/react'
import { useRecollyMotion } from '../../lib/motion'

export function HomePage() {
  const m = useRecollyMotion()  // ← ここで全 variants を取得

  return (
    <>
      <AnimatePresence>
        {user?.email_missing && <EmailPromptBanner />}
      </AnimatePresence>

      <motion.div variants={m.listContainer} initial="hidden" animate="visible">
        {records.map((record) => (
          <motion.div key={record.id} variants={m.fadeInUp}>
            <RecordCardItem record={record} />
          </motion.div>
        ))}
      </motion.div>
    </>
  )
}
```

`useRecollyMotion` の中で `useReducedMotion` を呼んでいて、**有効なら全 variants が opacity のみの簡易版にすり替わる**。各ページは「reduced-motion のことを考えなくていい」状態になっている。これはデザインパターンで言うと「Adapter パターン」に近い。

### 現時点での使用箇所（フェーズ 1）

- **HomePage**: 記録一覧の staggered fade-in
- **WorkDetailPage**: 作品詳細のフェード登場
- **UserMenu / DropdownMenu**: ドロップダウン開閉の AnimatePresence
- **DiscussionSection**: モーダル開閉の modal/overlay variants
- **EmailPromptBanner**: バナー登場/退場の bannerVariants
- **UpdatePrompt**: toast アニメ
- **App.tsx**: 全体ルートに `AnimatePresence mode="wait"` を配置（ページ遷移のため、フェーズ 2 で活用予定）

---

## なぜこれを選んだか

→ [ADR-0040: アニメーション基盤に motion を採用](../adr/0040-アニメーション基盤にmotionを採用.md)

要約：

- 純 CSS（選択肢 A）では、**消える瞬間のアニメ**と**並べ替えのスムーズ移動**が実質不可能。この 2 つ抜きでは「モダンな Web アプリらしさ」が出せない
- React Spring（選択肢 C）も候補だったが、AnimatePresence と layout アニメが弱い
- React Transition Group（選択肢 D）は機能不足
- **motion は React 19 を公式サポートしている唯一の主要ライブラリ**（ADR-0002 で React 19 採用のため重要）
- 転職活動への副次効果：求人票で「Framer Motion」はよく名前が出るスキル

バンドルサイズが +60KB（gzipped）増える短所はあるが、PWA キャッシュで 2 回目以降は影響なしとして許容した。

---

## 注意点・ハマりやすいポイント

### 1. AnimatePresence と条件分岐の配置（再掲）

**条件分岐は AnimatePresence の内側**に書く。外側だと exit アニメが拾えない。

```tsx
// ❌ NG
{show && <AnimatePresence><motion.div exit={...} /></AnimatePresence>}
// ✅ OK
<AnimatePresence>{show && <motion.div exit={...} />}</AnimatePresence>
```

### 2. key プロパティを必ずつける

`AnimatePresence` 内の `motion.div` には `key` が必須。key がないと「同じ要素が動いているのか、別物に入れ替わったのか」を React が判別できず、exit アニメがスキップされる。

```tsx
<AnimatePresence>
  {items.map((item) => (
    <motion.div key={item.id}>  {/* ← 必須 */}
      {item.name}
    </motion.div>
  ))}
</AnimatePresence>
```

### 3. height をアニメーションするのは例外扱い

motion は原則 `transform`（位置・回転・拡縮）と `opacity` だけでアニメすべき。**これらは GPU で処理されて 60FPS 維持しやすい**が、`width`/`height`/`top`/`left` の変更はレイアウト再計算（reflow）を引き起こして重い。

Recolly では `bannerVariants` が唯一 `height` をアニメしている例外で、これは「バナーが閉じた時に下のコンテンツが上にズレてきてほしい」という要求があるため。**意図的に例外として許容**しており、`variants.ts` のコメントにもその旨が書かれている。

### 4. reduced-motion 対応を忘れない

新しいアニメを追加するたびに `useReducedMotion` or `useRecollyMotion` を忘れずに使う。対応しないと OS 設定を無視してしまい、視差過敏の人には実害が出る。**面接では「アクセシビリティ対応はどうしている？」と聞かれると思って備えておくとよい**。

### 5. テストでの扱い

motion の動きは視覚的品質のためで、**アニメーションそのものをテストする必要はない**。ただし `AnimatePresence` で表示/非表示が切り替わる要素は、「最終状態で表示されているか / されていないか」は Vitest + React Testing Library でテストすること。

Recolly では `frontend/src/test-setup.ts` で motion のテスト用設定を入れている（`AnimatePresence` のアニメ完了を待たずに即座に DOM を更新する設定）。

### 6. 「Framer Motion」と検索しても出てくる

2024 年に名前が変わったので、古い記事・Stack Overflow 回答は `framer-motion` という名前で書かれている。**API はほぼ完全に同じ**なので、見つけた資料はそのまま使える。ただし `import` 文だけ違う：

```tsx
// 古い: import { motion } from 'framer-motion'
// 新しい: import { motion } from 'motion/react'
```

---

## もっと知りたいとき

- [motion 公式ドキュメント](https://motion.dev/docs/react)
- [AnimatePresence のドキュメント](https://motion.dev/docs/react-animate-presence)
- [useReducedMotion のドキュメント](https://motion.dev/docs/react-use-reduced-motion)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/ja/docs/Web/CSS/@media/prefers-reduced-motion)
- [WCAG 2.1 SC 2.3.3: Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
- Recolly 内部資料：
  - [ADR-0040](../adr/0040-アニメーション基盤にmotionを採用.md)
  - 実装: `frontend/src/lib/motion/`
  - 使用例: `frontend/src/pages/HomePage/HomePage.tsx`
