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

## 開発手法

**SDD（仕様駆動開発）+ TDD（テスト駆動開発）+ Issue駆動開発**
**superpowersスキルを主軸とする。**

詳細なワークフローは `recolly-workflow` スキルを参照。
Git運用ルールは `recolly-git-rules` スキルを参照。

### 自動発動ルール

以下のスキルはワークフローのどの段階でも、条件を満たしたら自動で発動する：

| スキル | 発動条件 |
|--------|---------|
| `comprehension-guard` | 技術選定・設計判断が発生したとき |
| `adr` | comprehension-guardでユーザーが判断を確定したとき。「ADRを書きますか？」と聞かず自動作成する |
| `learning-note` | ユーザーが質問してプロジェクトで初めて使う技術・パターン・ライブラリについて説明したとき。説明後に学習ノートを作成する |

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

## 理解負債防止

- 説明レベルはグローバルCLAUDE.mdの「説明・対話ルール」に従う
- 設計判断は `docs/adr/` に記録、学習は `docs/learning/` に蓄積（自動発動ルール参照）
- PR前セルフチェック → `recolly-git-rules` スキルの references/pr-self-check.md を参照
