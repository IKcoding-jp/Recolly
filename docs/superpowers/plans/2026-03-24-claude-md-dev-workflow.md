# CLAUDE.md 開発手法セクション見直し — 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CLAUDE.mdの開発手法セクションを仕様書に基づいて書き換え、ワークフローの実態と一致させる

**Architecture:** CLAUDE.mdの「開発手法」セクション（34〜47行目）を削除し、新しい内容に置き換える。ワークフロー、軽量パス、自動発動ルール、禁止事項、`/clear`後の復元手順、ドキュメント管理の6つのサブセクションで構成する。

**Tech Stack:** Markdown（CLAUDE.md編集のみ）

**Spec:** `docs/superpowers/specs/2026-03-24-claude-md-dev-workflow-design.md`

---

### Task 1: 開発手法セクションの書き換え

**Files:**
- Modify: `CLAUDE.md:34-47`

- [ ] **Step 1: 現行の開発手法セクション（34〜47行目）を以下に置き換える**

```markdown
## 開発手法

**SDD（仕様駆動開発）+ TDD（テスト駆動開発）+ Issue駆動開発**
**superpowersスキルを主軸とする。**

### ワークフロー

1. `superpowers:brainstorming`（要件深掘り + スペック作成）
2. GitHub Issue作成（`issue-creator`スキルでスペックからIssue起票）
3. `superpowers:writing-plans`（実装プラン作成）
4. `superpowers:subagent-driven-development`（各タスク内で `superpowers:test-driven-development` を使用）
5. 動作確認（手動 or Playwright MCP自動確認をユーザーに選択させる）
6. `superpowers:finishing-a-development-branch` → ブランチ作成 → PR作成 → Claude Code Review → マージ

※ ステップ5はUI変更またはAPI動作に影響するタスクのみ必須。ドキュメントのみ・設定変更のみの場合はスキップ可。

### 軽量パス

軽微な修正（typo、コメント修正、ドキュメント更新等）はステップ1〜3を省略し、ステップ4〜6のみで可。

### 自動発動ルール

以下のスキルはワークフローのどの段階でも、条件を満たしたら自動で発動する：

| スキル | 発動条件 |
|--------|---------|
| `comprehension-guard` | 技術選定・設計判断が発生したとき |
| `adr` | comprehension-guardでユーザーが判断を確定したとき。「ADRを書きますか？」と聞かず自動作成する |
| `learning-note` | ユーザーが質問してプロジェクトで初めて使う技術・パターン・ライブラリについて説明したとき。説明後に学習ノートを作成する |

### 禁止事項

- mainへの直接プッシュ禁止。ドキュメントのみの変更でも必ずブランチを切ってPR経由でマージする
- 動作確認対象のタスクで動作確認を省略しない

### `/clear`後のコンテキスト復元

以下を順に読むことでコンテキストを復元する：

1. `CLAUDE.md`（プロジェクトルール）
2. `docs/TODO.md`（全体進捗）
3. 該当タスクの spec（`docs/superpowers/specs/`）+ plan（`docs/superpowers/plans/`）
4. `git log`（直近の作業内容）

### ドキュメント管理

- ドキュメントは `docs/superpowers/` に一元管理（specs/, plans/）
```

- [ ] **Step 2: 差分を確認する**

Run: `git diff CLAUDE.md`
Expected: 34〜47行目が新しい内容に置き換わっている

- [ ] **Step 3: コミット**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md開発手法セクションを見直し（動作確認・自動発動ルール・禁止事項を追加）"
```
