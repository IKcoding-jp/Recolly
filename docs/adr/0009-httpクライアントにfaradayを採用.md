# ADR-0009: HTTPクライアントにFaradayを採用

## ステータス
承認済み

## 背景
作品検索機能で4つの外部API（TMDB, AniList, Google Books, IGDB）に通信する必要がある。
HTTPクライアントgemの選定が必要。

## 選択肢
1. **Faraday** — ミドルウェアスタック方式の柔軟なHTTPクライアント
2. **HTTParty** — シンプルさ重視のHTTPクライアント
3. **Net::HTTP** — Ruby標準ライブラリ

## 決定
**Faraday**を採用する。

## 理由
- 4つのAPIクライアントに共通のミドルウェア（エラーハンドリング、リトライ、ログ）を統一的に適用できる
- Railsコミュニティで最も広く使われており、ドキュメント・事例が豊富
- AniList（GraphQL）もFaradayのHTTP POSTで対応可能（専用GraphQL gemは不要）
