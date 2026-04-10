# FRONTEND_URL 環境変数の設定

## 目的

バックエンド（Rails）がパスワードリセットメール本文に「新パスワード設定ページの URL」を埋め込む際、フロントエンド（React）のホスト URL を知る必要がある。API モードでは Rails の routes ヘルパーがバックエンド自身のホストを返すため、フロントエンド URL を環境変数として明示的に渡す必要がある。

## 環境別の設定値

| 環境 | 値 |
|---|---|
| ローカル開発 | `http://localhost:5173`（`docker-compose.yml` で設定済み） |
| 本番 (EC2) | `https://recolly.net` |

## ローカル開発

`docker-compose.yml` の backend サービスで既に設定済み。追加作業不要。

```yaml
services:
  backend:
    environment:
      FRONTEND_URL: http://localhost:5173
```

## 本番（EC2）

EC2 の Rails プロセス起動時に `FRONTEND_URL=https://recolly.net` が設定される必要がある。

### 手順

1. SSM Session Manager で EC2 に接続:
   ```bash
   aws ssm start-session --target i-xxxxxxxx
   ```
2. `/opt/recolly/deploy.sh` または systemd unit file を確認し、Rails の環境変数定義を追加:
   ```bash
   export FRONTEND_URL=https://recolly.net
   ```
3. Rails プロセスを再起動してエクスポートした環境変数を反映:
   ```bash
   sudo systemctl restart recolly-backend
   # もしくは deploy.sh 経由で
   ```
4. `rails console` から動作確認:
   ```ruby
   ENV['FRONTEND_URL']
   # => "https://recolly.net"

   User.find_by(email: '<検証済みアドレス>').send_reset_password_instructions
   # 受信したメールのリンクが https://recolly.net/password/edit?reset_password_token=... で始まることを確認
   ```

### 重要な注意点

- **`deploy.sh` の変更は手動同期が必要**（CI から自動更新されない）。ローカルリポジトリと EC2 上のファイルで差分が出やすいので、変更時は必ず EC2 側も更新すること
- `FRONTEND_URL` が未設定のままパスワードリセットを実行すると、フォールバック値 `http://localhost:5173` のリンクが送信されてしまう。本番環境では必ず設定すること
- 環境変数が設定されていない場合の挙動は `DeviseMailer#reset_password_instructions` の `ENV.fetch('FRONTEND_URL', 'http://localhost:5173')` にフォールバックロジックを実装済み

## トラブルシューティング

### リセットメールのリンクが http://localhost:5173 になっている

本番 EC2 で `FRONTEND_URL` が未設定。上記手順 2-3 を実行して Rails プロセスを再起動する。

### リセットメールのリンクをクリックしてもページが開かない

リンクが https://recolly.net/password/edit?reset_password_token=xxx の形式か確認する。フロントエンド側のルーティング（`App.tsx` の `/password/edit`）が有効か、PR-B2 のマージが本番に反映されているかを確認する。

## 関連

- `backend/app/mailers/devise_mailer.rb`: 環境変数を読む箇所
- `backend/app/views/devise/mailer/reset_password_instructions.html.erb`: URL を埋め込むテンプレート
- spec: `docs/superpowers/specs/2026-04-10-pr-b2-password-reset-feature-design.md`
- 前提: PR-B1 (#108) の SES 基盤構築
