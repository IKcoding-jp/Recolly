# ADR-0023: CORS設定にrack-corsを採用

## ステータス
承認済み

## 背景
Recollyはフロントエンド（React）とバックエンド（Rails API）が分離した構成。ブラウザには「違うサーバーからのデータは受け取らない」というセキュリティルール（同一オリジンポリシー）がある。フロントエンドとバックエンドのドメインやポートが異なる場合、バックエンド側で「このドメインからのリクエストは許可する」と明示的に設定する必要がある（CORS: Cross-Origin Resource Sharing）。

## 選択肢

### A案: rack-cors（採用）
- **これは何か:** RailsでCORS設定を行うgem。「このドメインからのリクエストを許可する」「Cookieの送受信を許可する」等をミドルウェアとして設定する
- **長所:** Railsのデファクトスタンダード。設定がシンプル。環境変数で許可ドメインを動的に切り替え可能
- **短所:** バックエンド側の設定のみ。S3やCloudFront側のCORS設定は別途必要（Recollyでは不要）

### B案: 手動でCORSヘッダーを設定
- **これは何か:** コントローラーで `Access-Control-Allow-Origin` 等のHTTPヘッダーを直接設定する方式
- **長所:** gem追加不要
- **短所:** 全コントローラーに設定が必要で漏れやすい。OPTIONSリクエスト（プリフライト）の処理も自前で書く必要があり面倒

## 決定
A案（rack-cors）を採用。設定は以下の通り:

```ruby
# config/initializers/cors.rb
origins ENV.fetch("FRONTEND_URL", "http://localhost:5173")
resource "*", headers: :any, methods: [:get, :post, :put, :patch, :delete, :options, :head], credentials: true
```

- 許可ドメインは `FRONTEND_URL` 環境変数で動的に設定（開発: `http://localhost:5173`、本番: CloudFrontのURL）
- `credentials: true` でセッションCookieの送受信を許可（Devise認証に必須）

## 理由
- **Railsのデファクトスタンダード。** CORS設定といえばrack-cors
- **本番ではCloudFrontが同一ドメインで配信するため、CORSは実質的に不要。** フロントエンド（S3）もAPI（EC2）もCloudFrontという1つの入り口を通るので、ブラウザから見ると同じドメイン。S3にCORS設定は不要
- **開発環境とOAuth認証のセーフティネットとして必要。** 開発環境ではViteプロキシで同一オリジン化しているが、プロキシを通さないケースやOAuth認証のリダイレクト時にCORSが必要になる
- 手動でCORSヘッダーを設定する方式はコントローラーごとに設定が必要で漏れやすく、rack-corsの方がシンプルで安全

## 本番環境の通信フロー

```
ブラウザ → CloudFront（1つのドメイン）
              ├─ /api/*  → EC2（Rails API）← rack-corsでFRONTEND_URLを許可
              └─ それ以外 → S3（HTML/JS/CSS）← CORS設定不要
```

CloudFrontは `/api/*` リクエスト時にOrigin, Authorization, Acceptヘッダーと全CookieをEC2に転送する設定。

## 影響
- バックエンドの全APIエンドポイントにCORSヘッダーが自動付与される
- `FRONTEND_URL` 環境変数の設定が必須。未設定だとデフォルト値（`http://localhost:5173`）が使われる
- 本番環境では `FRONTEND_URL` をSSM Parameter Storeで設定
