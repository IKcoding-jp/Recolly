# ADR-0041: プロダクト分析ツールに PostHog を採用

## ステータス
承認済み

## 背景
Recolly はフェーズ 0〜4 の機能開発を終え、フェーズ 5 「マーケティング & マネタイズ」
に入った。`docs/product-marketing-context.md` で定義したマーケ指標（登録ユーザー数、
記録件数、**ジャンル横断率**、継続率、DAU/WAU/MAU）を実データで計測するための基盤が
必要になった。

現状、Recolly には計測ツールが一切入っていない（`frontend/index.html` には
Google Identity Services の OAuth 用スクリプトしか無く、バックエンドにも計測用 gem は
存在しない）。

この段階でプロダクト分析ツールを選定し、マーケ判断・施策評価の土台を作る。

## 選択肢

### A案: GA4（Google Analytics 4）
- **これは何か:** Google の公式 Web 分析ツール。世界で最も使われている。無料。
  pageview ベースのトラフィック分析が主目的。
- **長所:**
  - 完全無料
  - 業界標準。知名度が高く、面接や履歴書での通用性が高い
  - Google 広告との連携がスムーズ
  - BigQuery エクスポート機能
- **短所:**
  - UI が複雑で学習コストが重い
  - プロダクト分析（リテンション、カスタム指標、ファネル）は苦手
  - カスタム指標の実装が冗長（4 階層のパラメータ設定が必要）
  - EU では Cookie 同意バナーが事実上必須
  - データのサンプリングが発生する

### B案: PostHog
- **これは何か:** オープンソースのプロダクト分析ツール。イベントベース。
  React 用 SDK (`posthog-js`) があり、無料枠が広い（100 万イベント/月）。
  セルフホストも可能。
- **長所:**
  - プロダクト分析が本業。リテンション・ファネル・カスタム指標の導出が素直
  - React SDK が使いやすく `posthog.capture('event', props)` で発火できる
  - 無料枠が 100 万イベント/月と広い（個人開発では事実上無制限）
  - 「ジャンル横断率」のようなカスタム指標が Insight として定義しやすい
  - Cookie 同意バナーを避けた運用が可能（identify 前は匿名、identify で紐付け）
  - セッション録画・機能フラグ・A/B テストも同一プロダクトに統合されている
- **短所:**
  - 知名度は GA4 に劣る（面接では説明が必要）
  - アカウント登録が必要
  - 日本語ドキュメントが少ない

### C案: Plausible / Umami
- **これは何か:** プライバシー重視のシンプルな計測ツール。Cookie を使わず
  個人特定もしない。pageview 計測が中心。
- **長所:**
  - Cookie 同意バナー不要
  - UI がシンプル
  - プライバシー対応が完璧（GDPR/APPI ノータッチ）
  - Umami はオープンソースで自前ホスティング可
- **短所:**
  - イベント計測・リテンション分析が弱い
  - カスタム指標の表現力が低い
  - Plausible は有料（$9/月〜）
  - ファネル分析ができない
  - 目的である「ジャンル横断率」の計測が実質不可能

### D案: Mixpanel / Amplitude
- **これは何か:** 大規模 SaaS 向けのプロダクト分析ツール。イベントベースで
  高度なコホート分析・ファネル分析ができる。
- **長所:**
  - プロダクト分析の表現力が最強
  - 大規模企業での採用実績が豊富
- **短所:**
  - 無料枠が狭い（Mixpanel: 10 万 MTU、Amplitude: 5 万 MTU）
  - 個人開発では過剰スペック
  - 実装の学習コストも重い

### E案: GA4 + PostHog 併用
- **これは何か:** GA4 でトラフィック分析・広告アトリビューション、PostHog で
  プロダクト分析を行う 2 ツール構成。
- **長所:**
  - 両ツールの良いところ取り
  - 広告運用を始める段階で GA4 の恩恵を受けられる
- **短所:**
  - 実装コストが 2 倍
  - 個人開発・初期段階では過剰
  - ユーザー体験に Cookie 同意バナーが必要になる（GA4 側の都合）

## 決定
**B案: PostHog を採用する。**

スコープは Phase 1 の 4 イベント（`$pageview`, `$identify`, `signup_completed`,
`record_created`）に限定する。Phase 2 以降の詳細イベントは運用開始後に追加する。

詳細な実装設計は
`docs/superpowers/specs/2026-04-13-analytics-tracking-design.md`
を参照。

## 理由

- **計測目的との整合性**: Recolly が必要としている指標（ジャンル横断率、
  継続率、DAU/WAU/MAU、登録→初回記録ファネル）はすべてプロダクト分析の
  得意領域。GA4 で同じことをやろうとすると実装が冗長で運用が重い。

- **A 案（GA4）を選ばなかった理由**: UI の複雑さとプロダクト分析の弱さ。
  「ジャンル横断率」のようなカスタム指標を定義するには GA4 では
  カスタムディメンション + 探索レポート + セグメントを組み合わせる必要があり、
  個人開発者にとって運用コストが高すぎる。面接受けは良いが、実用性で不利。

- **C 案（Plausible/Umami）を選ばなかった理由**: 機能不足。
  Recolly の差別化点である「ジャンル横断率」を計測できないなら、
  計測基盤として成立しない。

- **D 案（Mixpanel/Amplitude）を選ばなかった理由**: 無料枠が狭すぎる。
  Recolly の規模感では PostHog の無料枠で必要十分。

- **E 案（併用）を選ばなかった理由**: 実装コスト 2 倍の見返りが現段階では
  見合わない。広告運用を本格化するフェーズで再検討する。

- **プライバシー対応の相性**: PostHog は identify 前は匿名でイベント収集でき、
  日本の APPI 対応として「プライバシーポリシー提示 + 自動計測」のアプローチと
  相性が良い（`docs/product-marketing-context.md` の方針と一致）。

- **将来の拡張余地**: PostHog はセッション録画・機能フラグ・A/B テスト・
  サーベイ機能まで統合されており、マーケ施策が進むにつれて活用範囲を
  広げられる。

## 影響

### コードベース
- `frontend/package.json` に `posthog-js` を追加
- `frontend/src/lib/analytics/` を新設（`posthog.ts`, `events.ts`, テスト）
- `frontend/src/main.tsx` で PostHog を初期化
- `frontend/src/contexts/AuthContext.tsx`（または `useAuth`）で
  ログイン時に `identify`、ログアウト時に `reset`
- `frontend/src/pages/SignUpPage/SignUpPage.tsx` で `signup_completed` を発火
- 記録作成のフック（`useRecordCreate` 等）で `record_created` を発火
- `App.tsx` 内で React Router の location 変化時に `$pageview` を手動発火
- `frontend/src/pages/PrivacyPage/` を新設してプライバシーポリシーを配置
- フッターに `/privacy` へのリンクを追加

### 環境変数
- `VITE_POSTHOG_KEY`（Project API Key、公開 OK）
- `VITE_POSTHOG_HOST`（`https://us.i.posthog.com`）
- 開発: `frontend/.env.local`
- 本番: AWS SSM Parameter Store → CI/CD ビルドステップで注入

### プライバシー
- 日本の APPI 対応として、Cookie 同意バナーは実装しない
- プライバシーポリシーページ（`/privacy`）で計測内容を明記する
- PII（メールアドレス、パスワード、感想本文、コメント本文、bio）は
  PostHog に送信しない
- EU からのアクセスには厳密な GDPR 対応は後回し（Recolly のターゲットが
  日本中心のため）

### パフォーマンス
- `posthog-js` は非同期ロードされ、メインスレッドをブロックしない
- 初期化失敗時も Recolly 本体は継続動作する
- バンドルサイズ +約 40KB（gzipped）

### 学習負荷
- IK さんが新しく学ぶこと: PostHog の基本概念（イベント、プロパティ、
  distinct_id、User Properties、Insight）、`posthog-js` の API
- PostHog 導入後に学習ノート（`docs/learning/`）を作成することを推奨

### テスト
- `posthog-js` を `vi.mock('posthog-js')` でモックしてユニットテスト
- 統合テストで主要イベント（`signup_completed`, `record_created`）の発火を検証
- 手動検証: PostHog Live events ページで開発環境のイベント到達を確認

### コスト
- PostHog 無料枠（100 万イベント/月）内で運用。有料化の判断は
  無料枠超過が見えた時点で別途検討する

### 関連 ADR
- ADR-0002（React + TypeScript 採用）— `posthog-js` の React SDK 経由で使用
- ADR-0012（本番インフラに AWS フル構成 + Terraform 採用）— 本番環境の
  環境変数は SSM Parameter Store で管理
- ADR-0017（フロントエンド API クライアントに fetch + 独自ラッパー採用）—
  PostHog SDK は本 API クライアントには干渉しない

### 関連文書
- `docs/product-marketing-context.md` — マーケ戦略の土台
- `docs/superpowers/specs/2026-04-13-analytics-tracking-design.md` — 実装設計仕様
- `docs/TODO.md` フェーズ 5「マーケティング & マネタイズ」
