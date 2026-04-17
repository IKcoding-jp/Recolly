# scripts/posthog

PostHog Dashboard / Insight を作成・更新するスクリプト。

## セットアップ

1. このディレクトリで `npm install` を実行

2. `.env.example` を `.env.local` にコピーし、以下の 3 値を入力:
   - `POSTHOG_PERSONAL_API_KEY`: PostHog → Account Settings → Personal API Keys で発行
   - `POSTHOG_PROJECT_ID`: PostHog の URL `/project/{ID}/` から取得
   - `POSTHOG_HOST`: `https://us.i.posthog.com`（フロントと同じ値）

## 実行

```bash
npm run sync
```

初回は Dashboard + 9 本の Insight を作成する。2 回目以降は既存を検出して更新のみ行う（べき等）。

## 注意

- Personal API Key はプロジェクト全体を操作可能な強い権限を持つ。`.env.local` は Git に含めないこと（`.gitignore` で除外済み）
- CI では自動実行しない方針（spec §5.4）。必要な更新は IK がローカルから手動で実行する
