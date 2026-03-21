# コードレビュー指摘の再発防止策 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR #15で受けた11件のレビュー指摘パターンが再発しないよう、CLAUDE.md規約・セルフチェックスキル・Claude Code Reviewワークフローを改善する

**Architecture:** 3層の防止策を構築する。(A) CLAUDE.mdにルール追加してClaude自身の実装品質を上げる、(B) pr-reviewスキルにセルフチェックを追加してPR作成前に自動検証する、(C) Claude Code Reviewのワークフローを改善してレビュー品質を上げる

**Tech Stack:** YAML (GitHub Actions), Markdown (CLAUDE.md, スキル定義)

---

### Task 1: CLAUDE.md コーディング規約にルール追加

**Files:**
- Modify: `CLAUDE.md:99-124`（コーディング規約セクション）

- [ ] **Step 1: 共通セクションにルール追加**

`CLAUDE.md` の `### 共通` セクション（101行目付近）の末尾に追加:

```markdown
- 自動生成された設定ファイル（gem generator等）は未使用コメントを削除し、変更した設定のみ残す
```

- [ ] **Step 2: Ruby / Rails セクションにルール追加**

`CLAUDE.md` の `### Ruby / Rails` セクション（115行目付近）の末尾に追加:

```markdown
- POSTで新規リソースを作成するAPIは `201 Created` を返す（200ではなく）
- 同一メソッドを複数コントローラーに定義しない。共通メソッドは `ApplicationController` または concern に定義
```

- [ ] **Step 3: TypeScript / React セクションにルール追加**

`CLAUDE.md` の `### TypeScript / React` セクション（124行目付近）の末尾に追加:

```markdown
- async関数を `onClick` に直接渡さない。`() => void fn()` でラップするか try/catch で囲む
- try/catch では `finally` ブロックの使用を検討する（状態クリア等の「必ず実行すべき処理」がある場合）
- フォーム送信前にクライアントサイドで事前チェック可能なバリデーション（パスワード一致等）を実施する
```

- [ ] **Step 4: 変更を確認**

Run: `cat -n CLAUDE.md | grep -A2 "自動生成\|201 Created\|async関数\|finally"` で追加箇所を確認

- [ ] **Step 5: コミット**

```bash
git add CLAUDE.md
git commit -m "chore: CLAUDE.mdにレビュー指摘の再発防止ルールを追加 (#16)"
```

---

### Task 2: pr-review スキルにセルフチェックを追加

**Files:**
- Modify: `.claude/skills/pr-review/SKILL.md`
- Modify: `.claude/skills/pr-review/references/checklist.md`

- [ ] **Step 1: checklist.md にセルフチェックセクションを追加**

`.claude/skills/pr-review/references/checklist.md` の先頭（既存の「必須チェック」セクションの前）に追加:

```markdown
## Claudeセルフチェック（PR作成前に自動実行）

### コード品質
- [ ] 同一メソッド/関数が複数ファイルに重複していないか（DRY）
- [ ] 同一CSS/スタイルが複数ファイルに重複していないか（DRY）
- [ ] 全ファイルが200行以内か（CLAUDE.md）
- [ ] CSS/スタイルにハードコード値（色、フォントサイズ等）がないか（CLAUDE.md）

### API / バックエンド
- [ ] POSTで新規作成するエンドポイントは201を返しているか（REST）
- [ ] 設定ファイルに未使用のコメント行やdead codeがないか
- [ ] 同一メソッドが複数コントローラーに重複していないか

### フロントエンド
- [ ] async関数をonClickに直接渡していないか
- [ ] try/catchでfinallyが必要な箇所はないか（状態クリア等）
- [ ] クライアントサイドで事前チェックできるバリデーションがあるか

### 環境 / 設定
- [ ] OS固有のパスやツールがコミットに含まれていないか
- [ ] 環境依存の設定はローカル設定ファイルに分離されているか
```

- [ ] **Step 2: SKILL.md のチェック手順にセルフチェックを組み込む**

`.claude/skills/pr-review/SKILL.md` の `### チェック手順` セクションを変更。現在の手順1の前に新しい手順を挿入:

```markdown
### チェック手順

1. **Claudeセルフチェック** — `references/checklist.md` の「Claudeセルフチェック」を自動実行。問題があれば修正してからユーザーに提示する
2. **変更ファイル一覧** — `git diff main --name-only` で変更ファイルを一覧化
3. **変更の要約** — 各変更の概要を初学者向けに説明する
4. **理解度チェック** — `references/checklist.md` の「必須チェック」に沿ってユーザーに確認
5. **記録漏れの検出** — 以下をチェックし、漏れがあれば提案する
   - 設計判断があったのにADRがない → `adr` スキルの利用を提案
   - 新技術を使ったのに学習ノートがない → `learning-note` スキルの利用を提案
6. **TODOコメントの提案** — 理解が不十分な箇所があれば `// TODO: 理解する - [概要]` コメントの追加を提案
```

- [ ] **Step 3: コミット**

```bash
git add .claude/skills/pr-review/
git commit -m "chore: pr-reviewスキルにセルフチェックリストを追加 (#16)"
```

---

### Task 3: Claude Code Review ワークフロー改善

**Files:**
- Modify: `.github/workflows/claude-review.yml`

- [ ] **Step 1: claude-review.yml を書き換え**

`.github/workflows/claude-review.yml` の全内容を以下に置き換え:

```yaml
name: Claude Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  claude-review:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          prompt: |
            あなたはRecollyプロジェクトのコードレビュアーです。

            ## 手順（必ずこの順番で実行）
            1. CLAUDE.mdを読んでプロジェクトルールを把握する
            2. `gh pr diff ${{ github.event.pull_request.number }}` でPRのdiffを確認する
            3. 全指摘を1つのコメントにまとめて `gh pr comment` で投稿する

            ## レビュー観点
            - **CLAUDE.md準拠:** コーディング規約、命名規則、ファイルサイズ（200行以内）、ハードコード禁止等
            - **コード品質:** DRY / YAGNI原則、ベストプラクティス
            - **バグ・セキュリティ:** SQLインジェクション、XSS、認証漏れ、Strong Parameters
            - **パフォーマンス:** N+1クエリ、不要な再レンダリング、メモリリーク
            - **保守性・可読性:** 変数名、コメント（「なぜ」の説明）、ファイル分割
            - **テスト:** カバレッジ、エッジケース、TDD遵守
            - **設計・アーキテクチャ:** thin controller、コンポーネント設計、責務の分離

            ## 出力フォーマット（必ずこの形式で1つのコメントにまとめる）

            指摘がある場合:
            ```
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

            指摘がない場合:
            ```
            ## 問題なし
            全てのレビュー観点で基準を満たしています。
            （確認した主要ポイントを箇条書き）
            ```

            ## ルール
            - 日本語でフィードバックする
            - 結論を先に述べ、理由と修正案を続ける
            - 推測や曖昧な指摘はしない。根拠をCLAUDE.mdのルールまたはベストプラクティスで示す
            - `gh pr comment` で1つのコメントとして投稿する。インラインコメントは使わない
            - GitHubコメントのみ投稿し、メッセージとしてテキストを出力しない
          claude_args: |
            --allowedTools "Read,Bash(gh pr comment:*),Bash(gh pr diff:*),Bash(gh pr view:*),Bash(cat:*)"
```

- [ ] **Step 2: 変更を確認**

変更点を確認:
- `fetch-depth: 1` → `fetch-depth: 0`
- `mcp__github_inline_comment__create_inline_comment` が削除されている
- `Read` と `Bash(cat:*)` が追加されている
- promptに「CLAUDE.mdを読む」手順が含まれている
- 出力フォーマットがセクション形式になっている

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/claude-review.yml
git commit -m "chore: Claude Code Reviewを統合レビュー形式に改善 (#16)"
```

---

### Task 4: 動作確認

- [ ] **Step 1: CLAUDE.mdの追加ルールが正しいか目視確認**

- [ ] **Step 2: pr-reviewスキルのチェックリストが正しいか目視確認**

- [ ] **Step 3: claude-review.ymlのYAML構文チェック**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/claude-review.yml'))"` または目視確認

- [ ] **Step 4: 最終コミット（必要であれば）**
