# ワークフロースキル化 設計

## 目的

CLAUDE.mdのプロセス系セクション（約100行）をスキルに切り出し、以下を実現する：

1. CLAUDE.mdの肥大化を防ぐ（201行 → 約100行）
2. 必要な時だけコンテキストにロードする
3. チェックポイントゲートで現状の「指示が無視される」問題を解消する

## 現状の問題

- Issue作成がスキップされる（`issue-creator`が発動しない）
- 自動発動スキル（ADR, comprehension-guard, learning-note）が発動しない
- 動作確認でAskUserQuestionを使って聞いてくれない
- TDDスキルが実装中に使われない

## 設計

### 2スキル構成

#### 1. `recolly-workflow`

- **配置:** `.claude/skills/recolly-workflow/SKILL.md`
- **発動条件:** 機能開発・バグ修正など実装作業の指示を受けた時
- **自由度:** Low freedom（チェックポイントゲートで厳密に制御）

**フルフロー（コード変更を伴う全タスク）:**

```
Step 1: brainstorming（要件深掘り + スペック作成）
  ↓ GATE: brainstorming完了を確認
Step 2: Issue作成（issue-creatorスキルで起票）
  ↓ GATE: Issueが作成されるまで次に進まない
Step 3: writing-plans（実装プラン作成）
  ↓ GATE: プランが作成されるまで次に進まない
Step 4: subagent-driven-development（各タスク内でTDDスキルを使用）
  ↓ GATE: 技術選定発生時 → comprehension-guardを発動してから続行
  ↓ GATE: comprehension-guardで判断確定 → ADRを自動作成
  ↓ GATE: 初出技術の説明後 → learning-noteを作成
Step 5: 動作確認
  ↓ GATE: UI/API変更がある場合、AskUserQuestionで確認方法を聞く
  ↓       ドキュメントのみ・設定変更のみの場合はスキップ可
Step 6: finishing-a-development-branch → PR作成 → レビュー → マージ
```

**軽量パス（ドキュメントのみの変更）:**

- Step 1〜3を省略し、Step 4〜6のみ
- コード変更がある場合は軽量パス不可（必ずフルフロー）

**禁止事項:**
- 動作確認対象のタスクで動作確認を省略しない

**ドキュメント管理:**
- ドキュメントは `docs/superpowers/` に一元管理（specs/, plans/）

#### 2. `recolly-git-rules`

- **配置:** `.claude/skills/recolly-git-rules/SKILL.md`
- **発動条件:** コミット・PR作成・マージ時
- **自由度:** Low freedom（規約は厳密に守る）

**SKILL.md 内容:**
- コミットメッセージ規約（Conventional Commits日本語）
- マージ戦略（全PRをMerge commitで統一。Squash / Rebase禁止）
- PRルール（タイトルはConventional Commits形式）
- コードレビューフロー（push → CI → Claude Code Review → 指摘解消 → マージ）
- コードレビュー観点（7観点テーブル）

**references/pr-self-check.md:**
- `docs/pr-self-check.md` から移動
- PR作成前のセルフチェックリスト

### CLAUDE.mdの変更

**削除するセクション:**
- ワークフロー詳細（Step 1〜6）
- 軽量パス
- 禁止事項
- ドキュメント管理
- コードレビュー（全体）
- コミットメッセージ
- マージ戦略
- PRルール

**残すもの:**
- 開発手法セクション（縮小版）:
  ```
  ## 開発手法
  SDD（仕様駆動開発）+ TDD（テスト駆動開発）+ Issue駆動開発
  superpowersスキルを主軸とする。
  詳細なワークフローは `recolly-workflow` スキルを参照。
  Git運用ルールは `recolly-git-rules` スキルを参照。
  ```
- 自動発動ルール（comprehension-guard, adr, learning-note）
- `/clear`後のコンテキスト復元
- 概要、技術スタック、ディレクトリ構成
- コーディング規約、テスト、セキュリティ
- Docker コマンド参照
- 理解負債防止

**削減効果:** 約100行削減（201行 → 約100行）

### ファイル操作

| 操作 | ファイル |
|------|---------|
| 新規作成 | `.claude/skills/recolly-workflow/SKILL.md` |
| 新規作成 | `.claude/skills/recolly-git-rules/SKILL.md` |
| 移動 | `docs/pr-self-check.md` → `.claude/skills/recolly-git-rules/references/pr-self-check.md` |
| 編集 | `CLAUDE.md`（プロセス系セクション削除 + ポインタ追加） |
