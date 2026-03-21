# 設計書: 作品検索・外部API連携・記録機能の基盤

Issue: #18

## 変更対象ファイル

### インフラ
| ファイル | 変更内容 |
|---------|---------|
| `docker-compose.yml` | Redisサービス追加 |

### バックエンド — モデル・マイグレーション
| ファイル | 変更内容 |
|---------|---------|
| `backend/app/models/work.rb` | Worksモデル（バリデーション、enum、リレーション） |
| `backend/app/models/record.rb` | Recordsモデル（バリデーション、リレーション） |
| `backend/db/migrate/xxx_create_works.rb` | Worksテーブル作成 |
| `backend/db/migrate/xxx_create_records.rb` | Recordsテーブル作成 |

### バックエンド — 外部APIクライアント
| ファイル | 変更内容 |
|---------|---------|
| `backend/app/services/external_apis/base_adapter.rb` | 共通インターフェース定義 |
| `backend/app/services/external_apis/tmdb_adapter.rb` | TMDB API（映画・ドラマ） |
| `backend/app/services/external_apis/anilist_adapter.rb` | AniList API（アニメ・漫画） |
| `backend/app/services/external_apis/google_books_adapter.rb` | Google Books API（本） |
| `backend/app/services/external_apis/igdb_adapter.rb` | IGDB API（ゲーム） |
| `backend/app/services/work_search_service.rb` | アダプタを束ねる検索サービス |

### バックエンド — コントローラー・ルーティング
| ファイル | 変更内容 |
|---------|---------|
| `backend/app/controllers/api/v1/works_controller.rb` | 検索 + 手動登録 |
| `backend/app/controllers/api/v1/records_controller.rb` | 記録作成 |
| `backend/config/routes.rb` | エンドポイント追加 |

### バックエンド — 設定
| ファイル | 変更内容 |
|---------|---------|
| `backend/Gemfile` | faraday, redis gem追加 |
| `backend/config/initializers/redis.rb` | Redis接続設定 |
| `backend/config/environments/development.rb` | キャッシュストア設定 |
| `backend/config/environments/test.rb` | テスト用キャッシュ設定 |

### フロントエンド
| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/types/work.ts` | Work, Record型定義 |
| `frontend/src/lib/api/works.ts` | 検索・登録API通信 |
| `frontend/src/lib/api/records.ts` | 記録API通信 |
| `frontend/src/pages/SearchPage/SearchPage.tsx` | 検索ページ |
| `frontend/src/pages/SearchPage/SearchPage.module.css` | スタイル |
| `frontend/src/components/WorkCard/WorkCard.tsx` | 作品カード |
| `frontend/src/components/WorkCard/WorkCard.module.css` | スタイル |
| `frontend/src/components/ManualWorkForm/ManualWorkForm.tsx` | 手動登録フォーム |
| `frontend/src/App.tsx` | ルーティング追加 |

## 実装方針

### アダプタパターンの構造

```
BaseAdapter (抽象クラス)
├── #search(query, options) → [SearchResult]  # 必須実装
├── #fetch_details(external_id) → WorkData    # 必須実装
└── #media_types → [Symbol]                   # 対応ジャンル

TmdbAdapter < BaseAdapter       # movie, drama
AniListAdapter < BaseAdapter    # anime, manga
GoogleBooksAdapter < BaseAdapter # book
IgdbAdapter < BaseAdapter       # game
```

### 検索結果の統一フォーマット

各アダプタは外部APIのレスポンスを以下の統一フォーマットに変換して返す:

```ruby
{
  title: "作品タイトル",
  media_type: "anime",
  description: "あらすじ",
  cover_image_url: "https://...",
  total_episodes: 12,
  external_api_id: "12345",
  external_api_source: "anilist",
  metadata: { ... }
}
```

### WorkSearchService の責務

1. ジャンル指定の有無に応じてアダプタを選択
2. 選択されたアダプタに対して並行検索（Parallelでの並行処理も検討）
3. 結果をRedisにキャッシュ（TTL: 30分目安）
4. キャッシュがあればAPIを叩かずに返却

### 記録フロー

```
ユーザーが「記録する」ボタン押下
→ POST /api/v1/records { record: { work_data: { title, media_type, ..., external_api_id, external_api_source } } }
→ RecordsController:
  1. work_data の external_api_id + source でWorksテーブルを検索
  2. なければ work_data からWorksテーブルに新規作成（フロントエンドが検索結果のデータを送信）
  3. Recordsテーブルにuser_id + work_idで記録作成
  4. 201 Created を返却
```

※ Redisキャッシュは検索結果のAPI呼び出し削減に使用。記録時はフロントエンドが
  検索結果のwork_dataを直接送信するステートレス方式（キャッシュ期限切れに強い）。

## 影響範囲
- 既存のUser モデルにhas_many :recordsリレーション追加
- docker-compose.ymlにRedisサービス追加（既存サービスへの影響なし）
- .env.exampleに外部APIキーの項目追加

## 関連ADR
- [ADR-0008](../../adr/0008-検索キャッシュにredisを採用.md)
- [ADR-0009](../../adr/0009-httpクライアントにfaradayを採用.md)
- [ADR-0010](../../adr/0010-anilist-graphqlをhttp直接クエリで対応.md)
- [ADR-0011](../../adr/0011-外部apiクライアントにアダプタパターンを採用.md)
