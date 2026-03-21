# コードレビュー指摘の再発防止策 — 設計書

Issue: #16

## 背景

PR #15（メール+パスワード認証）で計11件のレビュー指摘を受けた。パターン分析の結果、DRY違反(3件)、CLAUDE.md違反(2件)、REST規約違反(1件)、バグ(2件)、dead code(1件)、環境依存(1件)、UX改善漏れ(1件)に分類された。これらの再発を防止する。

## 変更内容

### A: CLAUDE.md コーディング規約の強化

以下のルールを追加する:

**共通セクション:**
- 設定ファイル（gem generator等で自動生成）は未使用コメントを削除し、変更した設定のみ残す

**Ruby / Rails セクション:**
- POSTで新規リソースを作成するAPIは `201 Created` を返す
- 同一メソッドを複数コントローラーに定義しない。共通メソッドは `ApplicationController` または concern に定義

**TypeScript / React セクション:**
- async関数を `onClick` に直接渡さない。`() => void fn()` でラップするか try/catch で囲む
- try/catch では `finally` ブロックの使用を検討する
- フォーム送信前にクライアントサイドで事前チェック可能なバリデーションを実施する

### B: pr-review スキルのチェックリスト改善

`references/checklist.md` に「Claudeセルフチェック」セクションを追加する。PR作成前にClaude（AI）が自動で確認する項目:

- コード品質: DRY重複（メソッド/CSS）、ファイルサイズ200行、ハードコード値
- API: REST準拠のステータスコード、dead code/未使用設定
- フロントエンド: async onClick、try/catch/finally、クライアントバリデーション
- 環境: OS固有パスのコミット混入

pr-review スキル本体にも反映し、理解度チェックの前にセルフチェックを自動実行するフローにする。

### C: Claude Code Review ワークフロー改善

`claude-review.yml` を以下のように変更:

1. **fetch-depth**: `1` → `0`（全履歴取得でコンテキスト確保）
2. **prompt書き換え**:
   - CLAUDE.mdを明示的に読む手順を追加
   - 出力フォーマットをセクション形式に統一（要修正 / 改善推奨 / 問題なし）
   - 全指摘を1つのコメントにまとめて `gh pr comment` で投稿
   - インラインコメント（`mcp__github_inline_comment`）は廃止
3. **allowedTools変更**:
   - `mcp__github_inline_comment__create_inline_comment` を削除
   - `Read` ツールを追加（CLAUDE.md参照用）
   - `Bash(gh pr comment:*)`, `Bash(gh pr diff:*)`, `Bash(gh pr view:*)` を維持

## 出力フォーマット（Claude Code Review）

```markdown
## 要修正（N件）
1. `file:line` — 指摘内容
   理由: ...
   修正案: ...

## 改善推奨（N件）
1. `file:line` — 指摘内容
   理由: ...

## 問題なし
基準を満たしている観点を記載
```

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `CLAUDE.md` | コーディング規約にルール追加 |
| `.claude/skills/pr-review` | スキル本体 + checklist.md にセルフチェック追加 |
| `.github/workflows/claude-review.yml` | fetch-depth, prompt, allowedTools 変更 |
