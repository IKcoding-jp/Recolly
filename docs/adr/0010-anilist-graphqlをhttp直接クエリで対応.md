# ADR-0010: AniList GraphQLをHTTP直接クエリで対応

## ステータス
承認済み

## 背景
AniList APIはGraphQL形式で提供されている。他の3つのAPI（TMDB, Google Books, IGDB）はREST API。
GraphQLクエリの送信方法を決める必要がある。

## 選択肢
1. **FaradayでHTTP POST送信** — GraphQLクエリを文字列としてPOST
2. **graphql-client gem** — GitHub製のGraphQLクライアントライブラリ

## 決定
**FaradayでHTTP POST送信**（専用gem不要）。

## 理由
- AniListで使うクエリは「タイトル検索 → 基本情報取得」程度でシンプル
- graphql-client gemの型チェック・スキーマ検証はこの用途では過剰
- Faraday（ADR-0009で採用済み）でそのまま対応でき、依存を増やさない
