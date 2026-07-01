# Recolly — プロジェクトルール

## 概要

Recollyは物語性のあるメディア（アニメ、映画、ドラマ、本、漫画、ゲーム）をジャンル横断で記録・分析・共有するWebアプリケーション。

仕様書: `docs/superpowers/specs/2026-03-20-recolly-design.md`

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| バックエンド | Ruby 3.3 / Rails 8（APIモード） |
| フロントエンド | React 19 / TypeScript / Vite |
| データベース | PostgreSQL 16 |
| テスト（BE） | RSpec |
| テスト（FE） | Vitest + React Testing Library |
| リンター（BE） | RuboCop |
| リンター（FE） | ESLint + Prettier |
| インフラ | Docker Compose（開発）/ AWS（本番） |

## ディレクトリ構成

```
recolly/
├── backend/        ← Rails API
├── frontend/       ← React + TypeScript
├── infra/          ← AWS設定
├── docs/           ← 仕様書・設計ドキュメント
├── CLAUDE.md       ← このファイル
└── docker-compose.yml
```

## 開発スタイル：バイブコーディング（Claude Code主体）

Claude Codeがすべての実装を担当する。IKさんは製品・設計の判断のみ行う。
汎用のsuperpowersスキルは通常通り使う。Recolly固有のルールは `.claude/rules/` を直接参照する（スキルの自動発動判定は経由しない）。

### ワークフロー（機能規模で3段階）

| 規模 | 判断基準 | プロセス |
|------|---------|---------|
| 大 | 新機能・画面追加・DB変更 | 仕様書 → 計画 → TDD → PR |
| 小 | 既存機能の改善・軽微な変更 | Issue → 実装 → PR |
| 修正 | バグ修正・コピー変更等 | 直接実装 → PR |

詳細フロー: `.claude/rules/workflow.md`

### IKさんが判断する場面（Claude は必ず確認を取る）

1. **UIデザインの変更** — コンポーネントの追加・見た目の大きな変更
2. **PRのマージ・本番デプロイ** — IKさんが承認して初めて実行

### 常時参照するルール

| ルール | 参照するタイミング |
|--------|-------------------|
| `.claude/rules/git-rules.md` | コミット・PR作成・マージ・コードレビュー対応時 |
| `.claude/rules/workflow.md` | 機能開発・バグ修正・リファクタリングの指示を受けた時 |
| `.claude/rules/comprehension-guard.md` | 新技術導入・設計判断・構造変更の前 |
| `.claude/rules/adr.md` | 設計判断が確定したとき（「ADRを書きますか？」と聞かず自動作成） |
| `.claude/rules/learning-note.md` | 技術解説・学習ノート作成を求められた時 |

### `/clear`後のコンテキスト復元

以下を順に読むことでコンテキストを復元する：

1. `CLAUDE.md`（プロジェクトルール）
2. `docs/TODO.md`（全体進捗）
3. 該当タスクの spec（`docs/superpowers/specs/`）+ plan（`docs/superpowers/plans/`）
4. `git log`（直近の作業内容）

### ドキュメント管理

- ドキュメントは `docs/superpowers/` に一元管理（specs/, plans/）

## コーディング規約

### 共通

- 1ファイル200行以内を目安。超える場合は分割を検討
- コメントは「なぜそうしているか」を書く（何をしているかではない）
- 未使用のimport・変数・関数を残さない
- マジックナンバー禁止。定数として定義する
- APIキー・シークレットは環境変数で管理。ハードコード禁止
- コメント・コミットメッセージは日本語
- 自動生成された設定ファイル（gem generator等）は未使用コメントを削除し、変更した設定のみ残す

### Ruby / Rails

- RuboCopの全ルールに準拠
- APIエンドポイントは `/api/v1/` プレフィックスを使用
- コントローラーはthin controller原則（ロジックはモデルまたはサービスオブジェクトに）
- N+1クエリ対策: `includes` / `eager_load` を必ず考慮
- Strong Parameters を必ず使用
- 全APIエンドポイントに認証チェック必須（ヘルスチェックを除く）
- POSTで新規リソースを作成するAPIは `201 Created` を返す（200ではなく）
- 同一メソッドを複数コントローラーに定義しない。共通メソッドは `ApplicationController` または concern に定義

### TypeScript / React

- ESLint + Prettierの全ルールに準拠
- `any` 型の使用禁止
- コンポーネントは関数コンポーネント + hooks パターン
- 外部APIのレスポンスは必ず型定義・バリデーションする
- デザイントークン（色・フォントサイズ等）はCSS変数のみ使用。ハードコード禁止
- 新規ページ作成時は必ず既存の共通コンポーネントを使用。新規スタイル直書き禁止
- async関数を `onClick` に直接渡さない。`() => void fn()` でラップするか try/catch で囲む
- try/catch では `finally` ブロックの使用を検討する（状態クリア等の「必ず実行すべき処理」がある場合）
- フォーム送信前にクライアントサイドで事前チェック可能なバリデーション（パスワード一致等）を実施する

### フロントエンドUI一貫性ルール

#### デザイントークン（必須）
スタイル値は全て `tokens.css` のCSS変数を使用する。ハードコード禁止。

- 色: `var(--color-*)` のみ
- フォント: `var(--font-size-*)`, `var(--font-weight-*)` のみ
- スペーシング: `var(--spacing-*)` のみ
- 角丸: `var(--radius-*)` のみ
- トランジション: `var(--transition-*)` のみ

tokens.cssに必要な値がない場合は、まずトークンを追加してから使う。

#### フォーム要素（必須）
フォーム入力要素は必ず共通コンポーネントを使用する。

- テキスト入力 → `<FormInput>`
- セレクト → `<FormSelect>`
- テキストエリア → `<FormTextarea>`

HTMLの `<input>`, `<select>`, `<textarea>` を直接使わない。

#### 共通コンポーネント使用（必須）
新しいUIを作る前に `frontend/src/components/ui/` を確認する。
同等の機能を持つ要素を新規CSSで直書きしない。

#### 新しいスタイル値が必要な場合
1. tokens.cssにトークンとして追加
2. 必要に応じて共通コンポーネントに反映
3. その上でページ固有のスタイルを書く

### デザインシステム参照ルール（AI向け）

新しいUIコンポーネント・ページを作るときは必ず以下の順で確認する：

1. `DESIGN.md` を読んで禁止事項・使用ルールを確認する
2. `frontend/src/components/ui/` に同機能のコンポーネントがないか確認する
3. `frontend/src/styles/tokens.css` からCSS変数を使う（値の直書き禁止）
4. 新しいページは `PageLayout` コンポーネントでラップする

### 新しいCSSを書く前のチェック

- px値・rem値・色コードを直書きしない → tokens.css の変数を使う
- tokens.css にない値が必要なときは、まずトークンを追加してから使う
- 既存コンポーネントと見た目が似ているUIを新規作成しない

## テスト

- 全機能にテスト必須
- バックエンド: RSpec（request spec 中心）
- フロントエンド: Vitest + React Testing Library
- テストファイルは対象ファイルと同じディレクトリ構造で配置

## セキュリティ

- パスワードのハッシュ化（bcrypt）
- CSRF対策
- SQLインジェクション対策（Railsのパラメータバインディング）
- XSS対策（Reactのエスケープ + 追加対策）
- 入力バリデーションをコントローラーレベルで必ず実施
- 依存パッケージの脆弱性チェック（bundle audit / npm audit）

## Docker コマンド

→ `docs/docker-commands.md` を参照

## 設計記録

- 設計判断は `docs/adr/` に自動記録（`.claude/rules/adr.md` に従う）
- PR前セルフチェック → `.claude/rules/pr-self-check.md` を参照
