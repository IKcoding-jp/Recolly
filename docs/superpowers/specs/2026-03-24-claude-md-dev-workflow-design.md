# CLAUDE.md 開発手法セクション見直し — 仕様書

## 背景

開発を進める中で、CLAUDE.mdの開発手法セクションに以下の問題が発生している：

1. **動作確認ステップがない** — 実装後にブラウザで動作を確認する工程がワークフローに含まれていない
2. **ADR作成が漏れる** — ブレインストーミング中・実装中ともにADR作成が漏れることがある
3. **learning-note作成が漏れる** — 新知識を得た際の学習ノート作成が行われないことがある
4. **mainへの直接プッシュ** — ドキュメント変更時にブランチを切らず直接mainにプッシュされることがある
5. **`/clear`後のコンテキスト復元が古い** — `docs/superpowers/working/`を参照する記述が実態と合わない

## 変更内容

### 1. ワークフローの更新

**変更前（5ステップ）:**

```
1. brainstorming（要件深掘り + スペック作成）
2. GitHub Issue作成
3. writing-plans（実装プラン作成）
4. subagent-driven-development（TDD実装）
5. finishing-a-development-branch → PR作成 → Review → マージ
```

**変更後（6ステップ）:**

```
1. brainstorming（要件深掘り + スペック作成）
2. GitHub Issue作成（issue-creatorスキルでスペックからIssue起票）
3. writing-plans（実装プラン作成）
4. subagent-driven-development（各タスク内でtest-driven-developmentを使用）
5. 動作確認（手動 or Playwright MCP自動確認をユーザーに選択させる）
6. finishing-a-development-branch → ブランチ作成 → PR作成 → Claude Code Review → マージ
```

**主な変更点:**
- ステップ5に「動作確認」を新設。UI変更またはAPI動作に影響するタスクのみ必須。対象外（ドキュメントのみ、設定変更のみ等）はスキップ可。対象の場合、ユーザーに手動確認（ブラウザで自分で見る）かPlaywright MCPによる自動確認かを選択させる
- ステップ6でブランチ作成を明記（mainへの直接プッシュ防止）

### 軽量パス

軽微な修正（typo、コメント修正、ドキュメント更新等）はステップ1〜3を省略し、ステップ4〜6のみで可とする。

### 2. 自動発動ルール（新設セクション）

以下のスキルはワークフローのどの段階でも、条件を満たしたら自動で発動する：

| スキル | 発動条件 |
|--------|---------|
| `comprehension-guard` | 技術選定・設計判断が発生したとき |
| `adr` | comprehension-guardでユーザーが判断を確定したとき。「ADRを書きますか？」と聞かず自動作成する |
| `learning-note` | ユーザーが質問してプロジェクトで初めて使う技術・パターン・ライブラリについて説明したとき。説明後に学習ノートを作成する |

### 3. 禁止事項（新設セクション）

- mainへの直接プッシュ禁止。ドキュメントのみの変更でも必ずブランチを切ってPR経由でマージする
- 動作確認対象のタスクで動作確認を省略しない

### 4. `/clear`後のコンテキスト復元（更新）

**変更前:**

```
`/clear` 後は `docs/superpowers/working/` を読めばコンテキストを復元できる
```

**変更後:**

以下を順に読むことでコンテキストを復元する：

1. `CLAUDE.md`（プロジェクトルール）
2. `docs/TODO.md`（全体進捗）
3. 該当タスクの spec（`docs/superpowers/specs/`）+ plan（`docs/superpowers/plans/`）
4. `git log`（直近の作業内容）

### 5. 削除する記述

- `docs/superpowers/working/`への参照を削除

## 影響範囲

- `CLAUDE.md` の「開発手法」セクションのみ変更
- 他のセクション（コーディング規約、テスト、セキュリティ等）は変更しない
