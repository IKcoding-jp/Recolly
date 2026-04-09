# ADR-0013: OAuth認証にOmniAuth + サーバーサイドフローを採用

## ステータス
廃止（ADR-0035により置き換え）

> 2026年4月、AndroidのPWAスタンドアロンモードでGoogleログインすると白画面になる不具合が発覚した。原因は本ADRで採用した「サーバーサイドリダイレクトフロー」がPWAの外部ブラウザ遷移と相性が悪く、認証後のCookieがPWAに戻ってこないため。根本解決としてADR-0035でGoogle Identity Services（ブラウザ内完結方式）に移行したため、本ADRの決定は廃止される。

## 背景
フェーズ1.5でGoogle OAuth / X (Twitter) OAuthを追加するにあたり、以下の技術選定が必要になった。
- OAuthフロー方式（サーバーサイド vs クライアントサイド）
- OAuthライブラリの選定（OmniAuth vs 自前実装）

既存の認証はdevise + セッションCookie（ADR-0007）で実装済み。

## 選択肢

### 1. OAuthフロー方式

#### A案: サーバーサイドフロー
- **これは何か:** OAuthプロバイダ（Google等）からのコールバックをRails側で受け、Rails内でトークン交換・ユーザー情報取得・セッション作成まで完結する方式
- **長所:** OmniAuthの標準パターンで実装がシンプル。シークレットがサーバー側のみで完結しセキュリティが高い
- **短所:** ブラウザがRails → Google → Rails → Reactと複数回リダイレクトする

#### B案: クライアントサイドフロー
- **これは何か:** Googleからのコールバックをフロントエンド（React）が受け、認可コードをRails APIに送信する方式
- **長所:** SPAらしいUX（ページ遷移が少ない）。フロントとバックの責務分離が明確
- **短所:** OmniAuthが使えず自前実装が必要。認可コードがフロントを経由するためセキュリティリスクが増える

### 2. OAuthライブラリ

#### A案: OmniAuth + 関連gem
- **これは何か:** RailsのOAuth認証の標準ライブラリ。各プロバイダ用のgemが揃っている
- **長所:** deviseとの統合サポートあり（:omniauthableモジュール）。実装量が少ない。情報が豊富
- **短所:** gem依存が増える（4つ追加: omniauth, omniauth-google-oauth2, omniauth-twitter2, omniauth-rails_csrf_protection）

#### B案: 自前実装（Faraday）
- **これは何か:** 既に導入済みのFaradayで各プロバイダのAPIを直接叩き、OAuthフローを自前で実装する
- **長所:** gem依存が少ない。内部の仕組みを完全に把握できる
- **短所:** 実装量が大幅に増える。stateパラメータ検証等のセキュリティ対策を自前で行うリスク

## 決定
1. OAuthフロー方式: **サーバーサイドフロー**
2. OAuthライブラリ: **OmniAuth + 関連gem**

## 理由
- **サーバーサイドフロー:** OmniAuthの標準パターンで、deviseとの統合が自然。シークレットがサーバー内で完結しセキュリティがシンプル。UXの差は体感1-2秒のリダイレクト程度で大きな問題にならない
- **OmniAuth:** ADR-0007で採用した「既存ライブラリを最大限活用し、車輪の再発明を避ける」方針に合致。deviseの:omniauthableモジュールで統合がスムーズ。セキュリティ（stateパラメータ、CSRF対策）もライブラリが自動処理

## 影響
- `backend/Gemfile` に4つのgemを追加（omniauth, omniauth-google-oauth2, omniauth-twitter2, omniauth-rails_csrf_protection）
- deviseのUserモデルに `:omniauthable` モジュールを追加
- OAuthコールバック用のコントローラーを追加
- UserProvidersテーブルを新規作成（OAuth連携情報を管理）
- Rails APIモードでCSRF対策の設定追加が必要（OmniAuth 2.0のPOST必須要件）
