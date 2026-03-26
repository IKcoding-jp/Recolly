# ADR-0010: AniList GraphQLをHTTP直接クエリで対応

## ステータス
承認済み（2026-03-27改訂）

## 背景
AniList API（アニメ・漫画のデータベース）はGraphQL形式で提供されている。他の3つのAPI（TMDB, Google Books, IGDB）はREST API。GraphQLクエリの送信方法を決める必要がある。

GraphQLとは「欲しいデータだけを指定して取得できるAPI形式」。REST API（URLでエンドポイントが決まっている）と違い、クエリ（問い合わせ文）を書いてPOSTで送る。

## 選択肢

### A案: FaradayでHTTP POST送信（採用）
- **これは何か:** GraphQLクエリをRubyの文字列として定義し、Faraday（ADR-0009で採用済み）でHTTP POSTリクエストとして送る方式。専用GraphQLライブラリは使わない
- **長所:** 追加依存ゼロ。Faradayをそのまま使える。クエリが文字列なので見て理解しやすい。テスト（webmock）も他のAPIアダプタと同じ方法で書ける。アダプタパターン（ADR-0011）との統合がシンプル
- **短所:** スキーマ検証（＝サーバーの定義とクエリの整合性を事前チェックする機能）がない。クエリの誤りはAPIエラーで初めて気づく。IDE補完が効かない

### B案: graphql-client gem
- **これは何か:** GitHub製のGraphQLクライアントライブラリ。AniListのスキーマ（API定義情報）をダウンロードし、クエリの型チェック・検証を事前に行える
- **長所:** スキーマ検証でクエリの誤りを実行前に検出。IDE補完が効く。複雑なクエリやMutation（データ書き込み）の管理に強い
- **短所:** 追加依存。スキーマのダウンロード・更新の仕組みが必要。学習コストが高い。Recollyの「検索だけ」の用途には過剰

### C案: graphlient gem
- **これは何か:** よりシンプルなGraphQLクライアント。graphql-clientより設定が少なく軽量
- **長所:** graphql-clientより設定が簡単。基本的なクエリ送信に必要十分
- **短所:** graphql-clientほどの検証機能はない。追加依存。Faraday直接送信で足りるなら不要

## 決定
A案（FaradayでHTTP POST送信）を採用。GraphQLクエリは文字列定数（`SEARCH_QUERY`）として `anilist_adapter.rb` 内に定義する。

## 理由
- **現在のクエリがシンプル。** 変数は `$search` の1つだけ、ネストは最大3階層、フィールドは10個程度。graphql-client gemのスキーマ検証・型チェックはこの複雑さでは過剰
- **RecollyはAniListの読み取り専用。** データを書き込む（Mutation）ことはない。GraphQLクライアントの真価が発揮されるMutation管理が不要
- **Faraday（ADR-0009）をそのまま使えて依存を増やさない。** REST APIアダプタ（TMDB, Google Books, IGDB）と同じHTTPクライアントで統一でき、テスト方法もwebmockで統一される
- **アダプタパターン（ADR-0011）との統合がシンプル。** GraphQL固有のライブラリを挟まないため、他のREST APIアダプタと同じインターフェース（`search` / `safe_search`）で扱える

## 将来の複雑化への対応方針

| 変化 | 対応方法 | graphql-client gem移行が必要か |
|------|---------|------------------------------|
| フィルタ追加（ジャンル・年代） | クエリ変数を追加するだけ | 不要 |
| 新しいクエリ追加（詳細取得、類似作品） | 新しい文字列定数を追加（`DETAIL_QUERY`等） | 不要。2〜3種類なら文字列管理で十分 |
| ネストが深くなる（キャラクター・スタッフ情報） | フラグメント（再利用可能なフィールド定義）を文字列で定義 | 不要 |
| Mutation（データ書き込み）が必要になる | graphql-client gemの導入を検討 | **必要になる可能性あり**。ただしRecollyの仕様上、AniListにデータを書き込む計画はない |

移行コストは低い。graphql-clientに移行する場合でも、クエリ文字列はそのまま使えるため書き換えは接続部分だけ。

## 影響
- AniList APIとの通信はFaraday経由のHTTP POSTに統一される
- GraphQLクエリの誤りはテスト（webmockでのレスポンススタブ）とCIで検出する
- クエリが増えた場合は `anilist_adapter.rb` 内に文字列定数として追加する
