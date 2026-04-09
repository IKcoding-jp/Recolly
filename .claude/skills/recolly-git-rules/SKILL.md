---
name: recolly-git-rules
description: RecollyプロジェクトのGit運用ルール（コミット規約、マージ戦略、PRルール、コードレビュー）。以下の場面で使うこと：(1) コミット作成時、(2) PR作成時、(3) マージ時、(4) コードレビュー対応時、(5) `superpowers:finishing-a-development-branch` の発動時。
---

# Recolly Git運用ルール

## コミットメッセージ

Conventional Commits（日本語）:

```
feat: ユーザー登録機能を追加
fix: ログイン時のバリデーションエラーを修正
chore: RuboCopの設定を更新
test: 作品検索のテストを追加
docs: API仕様書を更新
refactor: 認証ロジックを整理
```

## マージ戦略

- **全PRをMerge commitで統一する**
- Squash and merge は使用しない
- Rebase and merge は使用しない
- mainへの直接プッシュは禁止。ドキュメントのみの変更でも必ずブランチを切ってPR経由でマージする

## PRルール

- PRタイトルはConventional Commits形式（例: `feat: ○○`, `fix: ○○`, `docs: ○○`）

## コードレビュー

### 初回レビュー（自動）

PR を open すると、`.github/workflows/claude-code-review.yml` により Claude Code Review が自動で走る。トリガーは `pull_request: opened / ready_for_review / reopened` イベントのみ。

### 再レビュー（手動、@claude メンションで発動）

**subsequent push では自動レビューは走らない**。これは設計上の意図：

- 再レビューのいたちごっこ（ping-pong）を防ぐ
- 些細な修正まで毎回レビューすると API コストと待ち時間が無駄
- 「人間が見てほしいと判断したタイミング」で走らせる方がノイズが少ない

再レビューは PR コメントで `@claude` メンションして依頼する。これで `.github/workflows/claude.yml` が発動し、コメントの指示内容に従って GH Actions 上の Claude がアクションする。

### レビュー対応のフィードバックループ（推奨運用）

GH Actions Claude の指摘に対する対応は、以下の分業で進める：

```
[1] PR 作成
     ↓
[2] claude-code-review.yml が初回レビュー → 指摘コメントを投稿
     ↓
[3] IK さんが指摘内容を local Claude（この環境の Claude Code）に共有
     ↓
[4] local Claude が指摘の技術的妥当性を検証（← 重要なゲート）
     │   - 指摘は正しいか？
     │   - 本当に修正が必要か？
     │   - 指摘が誤りなら IK に説明して反論検討
     │   ※ superpowers:receiving-code-review の精神に沿って「盲従しない」
     ↓
[5] 妥当と判断した指摘のみ修正コミット + push
     ↓
[6] local Claude が gh pr comment で「修正報告 + @claude メンション」を投稿
     │   例: 「指摘の X と Y を Z で修正しました。@claude 再確認お願いします」
     ↓
[7] claude.yml が発動 → GH Actions Claude が差分を再確認
     ↓
[8] OK ならマージ（IK さん判断）、追加指摘があれば [3] に戻る
```

**役割分担**:

| ステップ | 担当 |
|---|---|
| 指摘の技術的妥当性検証 | **local Claude**（盲従ゲートキーパー） |
| 修正実装 | local Claude |
| `@claude` メンションコメントの投稿 | **local Claude**（`gh pr comment` で代行） |
| マージ判断 | IK さん |
| レビュー実行 | GH Actions Claude |

**IK さんの手間**:

- 指摘内容を local Claude に共有する（スクショ貼付 or 内容を伝える）
- 「修正 OK、`@claude` 再依頼して」と指示する
- マージボタンを押す

**IK さんがやらないこと**:

- `@claude` という文字列を手でタイプしてコメントを書く（local Claude が `gh pr comment` で代行）
- 指摘を全部そのまま修正に反映する（妥当性は local Claude が先に検証）

### 再レビュー依頼コメントの例（local Claude が `gh pr comment` で投稿）

**一般的な再レビュー依頼**:

```
@claude 直近のコミットを再レビューしてください
```

**修正報告とセットでの再確認依頼**:

```
指摘ありがとうございます。L42 の nil ガードと L78 のエラーハンドリングを追加しました（commit abc1234）。

@claude 修正内容が意図通りになっているか再確認お願いします。
```

**特定ファイル / 観点を限定**:

```
@claude Gemfile の変更だけ見てください。依存 gem の順序が正しいか、バージョン固定が妥当か確認してほしい
```

### フロー（簡略版）

1. ローカルで実装 + テスト + コミット
2. `git push` + PR 作成
3. **claude-code-review.yml が初回レビュー**（自動）
4. 指摘があれば上記「レビュー対応のフィードバックループ」に従って対応
5. CI 全パス + レビュー指摘解消 → マージ

### ルール

- 全 PR の **初回に** Claude Code Review を必須とする（CI 経由で自動実行）
- レビュー指摘を全て解消してからマージする
- **subsequent push で自動レビューは走らない**（意図的）。必要なら `@claude` で明示的に再依頼
- 指摘への対応は **local Claude が技術的妥当性を検証** してから反映する（盲従禁止）
- 再レビュー依頼の `@claude` コメント投稿は **local Claude が `gh pr comment` で代行** する（IK さんが手でタイプしなくて良い）

### レビュー観点

| 観点 | チェック内容 |
|------|------------|
| CLAUDE.md準拠 | コーディング規約、命名規則、ファイルサイズ（200行以内）等 |
| コード品質 | DRY / YAGNI原則、ベストプラクティス |
| バグ・セキュリティ | SQLインジェクション、XSS、認証漏れ、Strong Parameters |
| パフォーマンス | N+1クエリ、不要な再レンダリング、メモリリーク |
| 保守性・可読性 | 変数名、コメント（「なぜ」の説明）、ファイル分割 |
| テスト | カバレッジ、エッジケース、TDD遵守 |
| 設計・アーキテクチャ | thin controller、コンポーネント設計、責務の分離 |

### 設定ファイル

- 初回レビュー: `.github/workflows/claude-code-review.yml`（`pull_request: opened / ready_for_review / reopened`）
- オンデマンドレビュー: `.github/workflows/claude.yml`（`@claude` メンションで発動）

## PR前セルフチェック

PR作成前に [references/pr-self-check.md](references/pr-self-check.md) のチェックリストを確認すること。
