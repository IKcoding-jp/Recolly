# タスクリスト: 作品検索・外部API連携・記録機能の基盤

Issue: #18

## フェーズ1: インフラ・基盤
- [ ] docker-compose.yml にRedisサービス追加
- [ ] Rails側のRedis接続設定（config/environments, cable.yml等）
- [ ] Gemfile に faraday, redis gem追加
- [ ] Worksモデル・マイグレーション作成
- [ ] Recordsモデル・マイグレーション作成
- [ ] モデルのバリデーション・リレーション設定

## フェーズ2: 外部APIクライアント（アダプタパターン）
- [ ] BaseAdapter（共通インターフェース）作成
- [ ] TmdbAdapter（映画・ドラマ）実装
- [ ] AniListAdapter（アニメ・漫画）実装
- [ ] GoogleBooksAdapter（本）実装
- [ ] IgdbAdapter（ゲーム）実装
- [ ] WorkSearchService（アダプタを束ねる検索サービス）実装
- [ ] Redisキャッシュ統合（検索結果のTTL付きキャッシュ）

## フェーズ3: APIエンドポイント
- [ ] GET /api/v1/works/search — 作品検索
- [ ] POST /api/v1/works — 手動登録
- [ ] POST /api/v1/records — 記録（ライブラリ追加）
- [ ] ルーティング設定
- [ ] 認証チェック（全エンドポイント）

## フェーズ4: フロントエンド
- [ ] TypeScript型定義（Work, Record, SearchParams, SearchResult）
- [ ] API通信関数（検索・登録・記録）
- [ ] SearchPage コンポーネント
  - [ ] 検索バー
  - [ ] ジャンルフィルタ（タブ or ドロップダウン）
  - [ ] 検索結果一覧（WorkCard）
  - [ ] 「記録する」ボタン
- [ ] 手動登録フォーム（モーダル or セクション）
- [ ] ルーティング追加（/search）

## フェーズ5: テスト
- [ ] RSpec: Worksモデルテスト
- [ ] RSpec: Recordsモデルテスト
- [ ] RSpec: 各アダプタのユニットテスト（WebMockでAPI応答をモック）
- [ ] RSpec: WorkSearchServiceテスト
- [ ] RSpec: 検索・登録・記録のrequest spec
- [ ] Vitest: SearchPage テスト
- [ ] Vitest: 手動登録フォーム テスト

## フェーズ6: lint・仕上げ
- [ ] RuboCop全パス
- [ ] ESLint + Prettier全パス
- [ ] 環境変数の整理（.env.example更新）

## 完了条件
- 4つの外部APIで作品検索ができる
- 横断検索・ジャンル絞り込みが動作する
- 手動登録で作品を追加できる
- 「記録する」でライブラリに追加できる
- 検索結果がRedisにキャッシュされる
- 全テスト・全lintがパスする
