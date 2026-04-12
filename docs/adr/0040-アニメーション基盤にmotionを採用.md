# ADR-0040: アニメーション基盤に motion を採用

## ステータス
承認済み

## 背景
Recollyのフロントエンドは現在、純粋なCSS（CSS Modules + tokens.css）のみで構築されており、
アニメーションは「ホバー時の色変化」など、最低限のCSS transitionにとどまっている。
49ファイルでtransition/transformが使われているが、ページ遷移、モーダルの消える瞬間、
リスト並べ替え時のスムーズな移動といった「現代的でおしゃれなWebアプリらしい動き」は
一切実装されていない。

「フロントエンド全体にアニメーションを追加し、おしゃれでモダンなページを実現する」という
目標を達成するため、アニメーション実装の基盤技術を選定する必要がある。

## 選択肢

### A案: 純CSS（追加ライブラリなし）
- **これは何か:** 既存どおりCSS Modulesに `transition` と `@keyframes` を追記して
  アニメーションを実装する。新規ライブラリは入れない。
- **長所:**
  - バンドルサイズの増加ゼロ
  - 既存49ファイルとの一貫性が完璧
  - 学習コストゼロ（既知の技術のみ）
  - パフォーマンスが最も良い
- **短所:**
  - Reactでコンポーネントが消える瞬間（`{cond && <X />}`）のフェードアウトが綺麗にできない
    （DOMから即座に削除されるため）
  - ページ遷移時のクロスフェード等、ルーター連動のアニメが実質不可能
  - リスト並べ替え時のスムーズな移動アニメ（FLIPテクニック）の実装が複雑

### B案: motion（旧 Framer Motion）を導入
- **これは何か:** Reactコンポーネントに動きをつけるための専用ライブラリ。
  `<motion.div animate={{opacity: 1}}>` のような書き方で宣言的にアニメーションを定義できる。
  2024年に開発元（Framer社）から独立し、`motion` パッケージ名に変更された。
  Framer Motionの後継であり、React 19を公式サポートしている。
- **長所:**
  - `<AnimatePresence>` で要素削除時のフェードアウトが綺麗にできる
  - `layout` プロパティでリスト並べ替えのスムーズな移動が自動化される
  - ページ遷移のクロスフェードが簡単に実装できる
  - React開発者の事実上の標準。学習資料・StackOverflow回答が豊富
  - 宣言的な書き方でReactのメンタルモデルと馴染む
- **短所:**
  - バンドルサイズ +約60KB（gzipped）。ただしPWAでキャッシュされるので2回目以降は影響なし
  - 新しい書き方を覚える必要がある（`motion.div`、`AnimatePresence`、`useAnimate` 等）
  - 既存のCSS Modulesと「アニメーションの実装場所」が混在する設計上の判断が必要

### C案: React Spring
- **これは何か:** 物理ベース（バネ）のアニメーション計算を強みとするライブラリ。
  hookベースのAPIで、自然な動きが得意。
- **長所:**
  - 物理ベースの本格的なバネアニメ
  - 軽量寄り
- **短所:**
  - `<AnimatePresence>` 相当の機能は弱い（`useTransition` で代替可能だがやや煩雑）
  - layout アニメ機能がない
  - Motion ほど学習資料が多くない
  - Reactユーザー数では Motion に大きく差を付けられている

### D案: React Transition Group
- **これは何か:** Reactの古くからあるトランジション補助ライブラリ。
  `<CSSTransition>` でクラスの付け替えタイミングを管理する。
- **長所:**
  - 軽量（約10KB）
  - 歴史が長く安定
- **短所:**
  - 機能が少ない（layoutアニメ・物理ベースなし）
  - 書き方が古く、現代的なReactパターンと相性がやや悪い
  - 「おしゃれでモダン」の到達点が低い

## 決定
**B案: motion を導入する。**

ただし、既存49ファイルのCSSは触らず、以下の役割分担とする：
- **CSS（既存）:** 静的なtransition、ホバー反応、シンプルな登場アニメ、
  デザイントークン管理
- **motion（新規）:** Reactコンポーネントの登場・退場、ページ遷移、
  リスト並べ替え、モーダル/ドロップダウンの開閉アニメ

## 理由

- **「おしゃれでモダン」の達成に必要不可欠な機能をmotionが持っている。**
  特に `AnimatePresence`（消える瞬間のアニメ）と `layout` プロパティ
  （並べ替え時のスムーズ移動）は、純CSSでは事実上実現できない。これら抜きでは
  「現代的なWebアプリらしさ」が出せない。

- **A案を選ばなかった理由:** 純CSSは整合性は完璧だが、ページ遷移や要素削除時の
  アニメが実装できないため、目標である「フロントエンド全体のアニメーション」の
  半分しか達成できない。

- **C案を選ばなかった理由:** React Spring の物理ベースアニメは魅力的だが、
  Recollyで採用するアニメーションキャラクター「Editorial Calm × Snappy Modern」は
  バネ感を必要としない。AnimatePresence や layout アニメといった必須機能が弱いため
  Motionより不利。

- **D案を選ばなかった理由:** 機能不足。layoutアニメや物理ベースが無く、
  到達点が低すぎる。

- **モノレポ全体の方針との整合性:** Recollyは React 19 採用済みで（ADR-0002）、
  React 19 を公式にサポートしている主要なアニメーションライブラリは現状 motion のみ。

- **IKさんの転職活動への副次効果:** Motion（Framer Motion）はReactの求人票で
  頻繁に名前が出るスキル。学習することで履歴書に書ける武器が増える。

## 影響

### コードベース
- `frontend/package.json` に `motion` を追加
- `frontend/src/lib/motion/` に共通モーショントークン（duration, easing, variants）を集約
- 既存のCSS Modulesは原則そのまま。motionは「新規追加するアニメ」と
  「既存CSSでは実現できないアニメ」のみに使用
- `tokens.css` のトランジショントークン（`--transition-fast`, `--transition-normal`）は
  motion側の duration トークンと**同じ値で連動**させる（一貫性保持のため）

### 学習負荷
- IKさんが新しく学ぶこと: `motion.div`、`<AnimatePresence>`、`variants`、
  `transition` プロパティ、`layout` プロパティ、`useReducedMotion` フック
- 学習ノート（`docs/learning/`）の作成を推奨

### パフォーマンス
- バンドルサイズ +約60KB（gzipped）
- PWAキャッシュにより2回目以降は影響なし
- `transform` と `opacity` 中心のアニメに限定すればGPUアクセラレーション可能で
  60FPS維持に問題なし

### アクセシビリティ
- 必ず `useReducedMotion` フックで `prefers-reduced-motion` 設定を尊重する
  （現状Recollyにはこの対応がゼロなので、motion導入と同時に全面対応する）

### テスト
- Vitest + React Testing Library での既存テストパターンは維持
- アニメーションの動作テストは原則不要（視覚的品質のため）。
  ただし `AnimatePresence` で表示/非表示が切り替わる要素は、
  「最終状態の表示有無」をテストすること

### 関連ADR
- ADR-0002（React + TypeScript採用）— motion はこのスタックに依存
- ADR-0006（CSS Modules + CSS変数採用）— motion はこれを置き換えるのではなく補完する
- ADR-0031（フォント選定とデザイントークン体系）— motion のdurationトークンは
  tokens.css と連動させる
