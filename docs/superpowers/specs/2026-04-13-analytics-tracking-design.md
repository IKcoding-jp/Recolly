# Analytics Tracking — 設計仕様書

**作成日**: 2026-04-13
**背景文書**: `docs/product-marketing-context.md`（フェーズ5: マーケティング & マネタイズ）

---

## 1. 概要

### 1.1 目的

Recolly にプロダクト分析基盤を導入し、マーケティング判断・施策評価に必要な定量データを取得できる状態にする。

具体的には `docs/product-marketing-context.md` セクション 11 で定義した以下の指標を計測できるようにする：

- 登録ユーザー数
- 記録件数の累計
- **ジャンル横断率**（2 ジャンル以上を記録するユーザー比率 = 差別化の動かぬ証拠）
- 継続率（Day 1 / 7 / 30）
- DAU / WAU / MAU

### 1.2 選定ツール: **PostHog**

`analytics-tracking` スキルでの検討の結果、以下の理由で PostHog を採用する：

1. **プロダクト分析が本業**: Recolly が重要視する指標（リテンション、カスタム指標、ファネル）はプロダクト分析ツールの得意領域
2. **無料枠が広い**: 100 万イベント/月（初期段階では十分）
3. **実装が素直**: React 用 SDK (`posthog-js`) があり、`posthog.capture('event_name', { property: value })` で記録可能
4. **カスタム指標に強い**: 「ジャンル横断率」のようなカスタム指標は PostHog の insight で定義しやすい
5. **Cookie 同意バナーが不要な形で運用できる**: identify 前は匿名、identify 後にユーザーに紐付けというフローで日本の APPI に対応できる

**採用しなかった選択肢**:

| ツール | 不採用理由 |
|---|---|
| GA4 | UI 複雑、プロダクト分析（リテンション・ファネル）が苦手、カスタム指標の実装が重い |
| Plausible / Umami | イベント計測・リテンション分析が弱い。pageview 中心すぎて目的に合わない |
| Mixpanel / Amplitude | 有料枠が前提。個人開発では過剰 |
| GA4 + PostHog 併用 | 個人開発では実装コスト 2 倍になり過剰 |

### 1.3 スコープ

本仕様は **Phase 1: MVP** のイベント 4 種類を対象とする。Phase 2・3 は本仕様の対象外（別仕様で扱う）。

---

## 2. 計測プラン

### 2.1 イベント一覧（Phase 1）

| # | イベント名 | 発火場所 | プロパティ | 目的 |
|---|---|---|---|---|
| 1 | `$pageview` | PostHog SDK 自動 | `$current_url`, `$referrer`（自動） | トラフィック分析 |
| 2 | `signup_completed` | 新規登録成功時 | `method` (`email` / `google`) | 登録 CV |
| 3 | `record_created` | 記録作成成功時 | `media_type` (`anime` / `movie` / `drama` / `book` / `manga` / `game`) | アクティベーション + **ジャンル横断率** |
| 4 | `$identify` | ログイン成功時 | `distinct_id` = user_id、`$set`: `signup_method`, `signup_date` | 匿名ユーザーとログイン済みユーザーを紐付け、リテンション分析を可能にする |

### 2.2 User Properties（identify 時に `$set` するプロパティ）

| プロパティ名 | 値 | 由来 |
|---|---|---|
| `signup_method` | `email` / `google` | `User.provider` から取得 |
| `signup_date` | ISO 8601 文字列 | `User.created_at` から取得 |

### 2.3 計測できるようになる指標と導出方法

| 指標 | 導出方法 |
|---|---|
| 登録ユーザー数 | `signup_completed` の unique user count |
| 記録件数 | `record_created` の total count |
| **ジャンル横断率** | `record_created` の `media_type` が distinct で 2 以上のユーザー / 全 identify 済みユーザー |
| DAU / WAU / MAU | PostHog 自動（`$pageview` + `$identify` ベース） |
| 継続率（Day 1/7/30） | PostHog 自動（retention insight） |
| 登録 → 初回記録ファネル | `signup_completed` → `record_created` ファネル |

### 2.4 Phase 2 以降（本仕様の対象外だが、意図を残す）

Phase 2（V1 運用開始後に追加する）:
- `search_performed`
- `episode_progress_updated`
- `record_status_changed`
- `recommendation_clicked`

Phase 3（必要になったら）:
- `discussion_created`, `comment_posted`
- `work_detail_viewed`
- `library_filtered`
- `tag_added`

---

## 3. 実装設計

### 3.1 依存追加

`frontend/package.json` に以下を追加する：

```json
{
  "dependencies": {
    "posthog-js": "^1.x"
  }
}
```

### 3.2 環境変数

| 変数名 | 値 | 保存先 |
|---|---|---|
| `VITE_POSTHOG_KEY` | `phc_xxx` (Project API Key) | 開発: `.env.local`、本番: AWS SSM Parameter Store |
| `VITE_POSTHOG_HOST` | `https://us.i.posthog.com` | 同上 |

`.env.example` には両方のプレースホルダーを追加済み。

### 3.3 モジュール構成

```
frontend/src/lib/analytics/
├── posthog.ts           ← PostHog 初期化 + ラッパー API
├── events.ts            ← イベント名の定数定義（tagged union 型）
└── posthog.test.ts      ← ユニットテスト
```

### 3.4 `posthog.ts` の責務

- 初期化（`posthog.init(key, { api_host })`）
- 環境変数が未設定なら何もしない（ローカル環境でも起動を妨げない）
- プライバシー設定: `capture_pageview: true`, `persistence: 'localStorage+cookie'`
- 公開 API:
  - `identify(user: User)` — ログイン成功時に呼ぶ
  - `reset()` — ログアウト時に呼ぶ
  - `capture(eventName, properties)` — イベント送信（薄いラッパー）
  - `capturePageview()` — SPA の pageview を手動でトリガー（Vite + React Router 対応のため）

### 3.5 イベント発火ポイントの改修

| イベント | 発火ポイント | 改修対象ファイル |
|---|---|---|
| `$pageview` | React Router の location 変化時 | `frontend/src/App.tsx` または router 近辺 |
| `$identify` | `useAuth` の login 成功時 | `frontend/src/contexts/AuthContext.tsx`（または `useAuth` の実装） |
| `$reset` | `useAuth` の logout 成功時 | 同上 |
| `signup_completed` | `SignUpPage` の登録成功時、および OAuth コールバック成功時 | `frontend/src/pages/SignUpPage/SignUpPage.tsx`、OAuth コールバック処理 |
| `record_created` | 記録作成 API 成功レスポンス後 | 記録作成フック（`useRecordCreate` 等） |

### 3.6 初期化タイミング

`frontend/src/main.tsx` で `posthog.init()` を呼ぶ。ただし環境変数が未設定なら初期化しない（ローカル開発で空の `.env.local` でも動くように）。

### 3.7 SPA の pageview ハンドリング

PostHog の `capture_pageview: true` は初回ロードの pageview しか拾わない。React SPA の経路遷移は手動で `posthog.capture('$pageview')` する必要がある。

実装方針:
- `App.tsx` 内で `useLocation()` を監視し、location 変化時に `capturePageview()` を呼ぶ
- 初回ロードは PostHog の init で自動発火される（重複しないように注意）

---

## 4. プライバシー対応

### 4.1 方針: **プライバシーポリシー提示 + 自動計測**

`product-marketing-context.md` での検討結果（選択肢 Y）に従う。

- Cookie 同意バナーは表示しない
- フッターに「プライバシーポリシー」ページへのリンクを追加
- プライバシーポリシーページでは以下を明記:
  - PostHog を使用していること
  - 計測している内容（ログイン状態・操作イベント・PV）
  - 匿名性を担保するために個人を特定できる情報（email 本文・パスワード・作品の感想本文等）は送信しないこと
  - ユーザーが希望すれば計測を拒否できる方法（PostHog の opt-out）

### 4.2 法的根拠

- **日本（APPI）**: 個人情報の利用目的を公表すれば Cookie 同意バナーは不要。プライバシーポリシーで十分対応可能
- **EU（GDPR）**: 厳密には Cookie 同意バナーが必要だが、Recolly のターゲットは日本中心のため許容範囲とする。EU ユーザーが主要ターゲットになった時点で consent mode を別途導入する

### 4.3 PII を送信しない方針

以下は PostHog に **送信しない**:

- ユーザーのメールアドレス
- パスワード
- 作品の感想本文（`EpisodeReview.body`）
- 掲示板のコメント本文
- プロフィール bio

以下は **送信する**:

- ユーザー ID（distinct_id として）— これは内部 ID で PII ではない
- `signup_method`, `signup_date`
- `record_created` の `media_type`
- 画面遷移の URL

### 4.4 プライバシーポリシーページ

- ルート: `/privacy`
- 既存の共通コンポーネントを使用して作成
- フッターからリンク

---

## 5. テスト

### 5.1 ユニットテスト（Vitest）

`frontend/src/lib/analytics/posthog.test.ts`:

- 環境変数が未設定のとき、`init` が何もせず例外を投げない
- 環境変数が設定されているとき、`posthog.init` が正しい引数で呼ばれる
- `identify` が呼ばれたとき、`posthog.identify` に正しい引数が渡される
- `reset` が呼ばれたとき、`posthog.reset` が呼ばれる
- `capture` が薄いラッパーとして動作する

モックは `vi.mock('posthog-js')` で置き換える。

### 5.2 統合テスト

- SignUpPage のテストで「登録成功時に `signup_completed` イベントが発火する」を検証
- Login 成功時に `identify` が呼ばれることを検証

### 5.3 手動検証

- PostHog の Live events ページ（`https://us.posthog.com/project/{id}/events`）で開発環境のイベントがリアルタイムに届くか確認
- `$identify` → ユーザーが PostHog の People ページに出現するか確認

---

## 6. 非機能要件

### 6.1 パフォーマンス

- PostHog SDK は非同期ロード（`posthog-js` のデフォルト）
- メインスレッドをブロックしない
- イベント送信失敗時に UI を止めない

### 6.2 失敗時の振る舞い

- PostHog の init / capture が失敗しても、Recolly 本体の機能は継続動作する
- エラーはコンソールに警告ログを出すが、ユーザーには表示しない

### 6.3 環境依存

- **開発環境** (`.env.local`): IK 個人の PostHog プロジェクト
- **本番環境** (AWS EC2): 同じ PostHog プロジェクトを使う
  - 開発と本番でイベントを区別したい場合は PostHog の `properties.environment` で識別する（実装時に追加検討）

---

## 7. Out of Scope（本仕様では扱わない）

- Phase 2 以降のイベント（`search_performed`, `episode_progress_updated` 等）
- A/B テスト機能（PostHog 機能フラグ）
- セッション録画機能
- バックエンド（Rails）側のイベント発火（必要になったら別仕様）
- EU GDPR 対応の Cookie consent banner
- 既存ユーザーデータの PostHog への遡及インポート

---

## 8. 実装後のフォロー（別タスク）

`docs/TODO.md` フェーズ5 に含まれる以下は本仕様の**対象外**だが、実装後に順次着手する：

- 計測データを見るためのダッシュボード作成（PostHog の Dashboard 機能で insight を作成する）
- イベントの定期レビュー（週次 or 月次）
- Phase 2 イベント追加の別仕様書

---

## 9. 関連文書

- 背景: `docs/product-marketing-context.md` セクション 11, 12
- TODO: `docs/TODO.md` フェーズ5「マーケティング & マネタイズ」
- ADR: `docs/adr/0041-プロダクト分析ツールにposthogを採用.md`
