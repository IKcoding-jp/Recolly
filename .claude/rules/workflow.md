# Recolly 開発ワークフロー

機能開発・バグ修正・リファクタリングの指示を受けたときに従う。質問のみ・調査のみの会話では発動しない。

## パス判定

まず変更内容からパスを判定する：

**ドキュメントのみの変更？**（typo、コメント修正、ドキュメント更新、設定ファイルの軽微な修正でコード変更なし）
→ 軽量パス（Step 4〜6のみ）

**コード変更を伴う？**
→ フルフロー（Step 1〜6）

## フルフロー

### Step 1: 要件深掘り + スペック作成

`superpowers:brainstorming` スキルを発動する。

**完了条件:** スペックが `docs/superpowers/specs/` に書き出され、ユーザーが承認した。

### GATE: Step 2へ進む前に

- [ ] スペックファイルが存在する
- [ ] ユーザーがスペックを承認した

上記を満たすまで次に進まない。

### Step 2: GitHub Issue作成

`issue-creator` スキルを発動してIssueを起票する。

**STOP — Issue作成を省略しない。** これは過去に何度もスキップされた問題ステップ。brainstormingが完了したら、必ず `issue-creator` スキルを発動すること。ユーザーに「Issueを作りますか？」と聞かず、自動で作成する。

**完了条件:** GitHub Issueが作成された。

### GATE: Step 3へ進む前に

- [ ] GitHub IssueのURLが存在する

### Step 3: 実装プラン作成

`superpowers:writing-plans` スキルを発動する。

**完了条件:** プランが `docs/superpowers/plans/` に書き出された。

### GATE: Step 4へ進む前に

- [ ] プランファイルが存在する

### Step 4: 実装

`superpowers:subagent-driven-development` スキルを発動する。

**STOP — TDDを省略しない。** 各タスク内で必ず `superpowers:test-driven-development` スキルを使用すること。テストを先に書き、テストが失敗することを確認してから実装する。

**実装中に必ず従うルール:**

- 技術選定・設計判断が発生 → `.claude/rules/comprehension-guard.md` に従ってから続行
- comprehension-guardでユーザーが判断を確定 → `.claude/rules/adr.md` に従ってADRを自動作成
- プロジェクトで初めて使う技術を説明した → `.claude/rules/learning-note.md` に従って学習ノート作成

### GATE: Step 5へ進む前に

- [ ] 全テストがパスしている
- [ ] リンター（RuboCop / ESLint）がパスしている

### Step 5: 動作確認

**STOP — 確認方法をユーザーに聞く。** AskUserQuestionで以下を聞くこと：

> 「動作確認を行います。以下のどちらで進めますか？」
> 1. 手動確認（ブラウザで操作する手順を案内します）
> 2. Playwright MCPで自動確認

**スキップ条件:** ドキュメントのみ・設定変更のみの場合はスキップ可（軽量パスではそもそもここに来ない）。

### GATE: Step 6へ進む前に

- [ ] 動作確認が完了した、またはスキップ条件を満たした

### Step 6: ブランチ完了 + PR

`superpowers:finishing-a-development-branch` スキルを発動する。
Git運用ルールは `.claude/rules/git-rules.md` に従う。

## 軽量パス

ドキュメントのみの変更の場合、Step 4（実装）→ Step 6（ブランチ完了 + PR）のみ。
Step 5（動作確認）も不要。

## 禁止事項

- UI変更またはAPI変更を伴うタスクで動作確認を省略しない
- ゲートの条件を満たさずに次のステップに進まない
- Issue作成をスキップしない（フルフローの場合）
- TDDスキルを使わずに実装しない（フルフローの場合）

## ドキュメント管理

- スペック: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- プラン: `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`
