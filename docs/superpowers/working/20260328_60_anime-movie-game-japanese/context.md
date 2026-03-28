# コンテキスト: アニメ映画分類改善 + ゲーム日本語検索

Issue: #60

## スペック参照
- [スペック](../../specs/2026-03-28-search-anime-movie-game-japanese-design.md)
- [ADR-0033](../../../adr/0033-アニメ検索のデータソース戦略.md)（アニメ検索のデータソース戦略）

## このIssueで実現すること
AniListのformat フィールドでアニメ映画を「映画」に分類し、日本語WikipediaAPIをIGDBの補完ソースとしてゲーム検索の日本語対応を改善する。

## このIssue固有の補足
- WikipediaGameAdapterはBaseAdapterを継承しない（補完専用で単独検索結果を返さない）
- Wikipedia結果はIGDBにマッチするもののみ採用（IGDBにないゲームは表示しない）
- 英語クエリではWikipedia検索を呼ばない（IGDBが英語検索に十分対応しているため）
- 同一ブランチ `fix/search-game-anime-popularity` で前回の検索バグ修正と合わせて作業中

## スコープ外
- Wikipedia単独の検索結果表示
- ゲーム説明の翻訳API連携
- Nintendo eShop等の非公式API連携
