# コンテキスト: 作品検索・外部API連携・記録機能の基盤

Issue: #18

## 仕様書参照
- [メイン仕様書](../../superpowers/specs/2026-03-20-recolly-design.md)
  - セクション3: 対応メディアジャンル（media_typeとAPI対応表）
  - セクション4: データモデル（Works, Recordsテーブル定義）
  - セクション6.1: 画面構成（/search ページ）
  - セクション9: 開発フェーズ（フェーズ1: 作品検索）
  - セクション10: 作品データ取得戦略（外部API一覧）
- [ADR-0008](../../adr/0008-検索キャッシュにredisを採用.md) — Redis採用
- [ADR-0009](../../adr/0009-httpクライアントにfaradayを採用.md) — Faraday採用
- [ADR-0010](../../adr/0010-anilist-graphqlをhttp直接クエリで対応.md) — AniList対応方針
- [ADR-0011](../../adr/0011-外部apiクライアントにアダプタパターンを採用.md) — アダプタパターン採用

## このIssueで実現すること
外部API 4つ（TMDB, AniList, Google Books, IGDB）と連携した作品検索、
手動登録、ライブラリ追加（記録）機能の基盤を実装する。
検索結果はRedisにキャッシュし、ユーザーが「記録する」ボタンを押した時にDBに永続化する。

## このIssue固有の補足（ブレインストーミングで確定）

### 検索フロー
- デフォルトは全ジャンル横断検索（4つのAPIに同時問い合わせ）
- ジャンルフィルタ選択時は対応するAPIのみに問い合わせ
- 検索結果はRedisにTTL付きでキャッシュ

### DB保存タイミング
- 検索結果はWorksテーブルに直接保存しない
- 「記録する」ボタン押下時にWorksテーブル + Recordsテーブルに同時保存

### APIとジャンルの対応
| API | ジャンル | 認証方式 |
|-----|---------|---------|
| TMDB | movie, drama | APIキー（クエリパラメータ） |
| AniList | anime, manga | 不要（公開GraphQL API） |
| Google Books | book | APIキー（クエリパラメータ） |
| IGDB | game | Twitch OAuth2（Client Credentials） |

### 手動登録
- 外部APIで見つからない作品をユーザーが手動で登録可能
- 最低限 title + media_type があれば登録できる

## スコープ外
- 作品詳細ページ（/works/:id）
- ステータス変更・★評価・進捗管理（記録の詳細管理）
- マイライブラリページ（/library）
- ダッシュボードへの統合
