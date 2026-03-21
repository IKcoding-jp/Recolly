# テスト計画: 作品検索・外部API連携・記録機能の基盤

Issue: #18

## テスト対象

### バックエンド（RSpec）
| 対象 | テストファイル | テスト種別 |
|------|-------------|----------|
| Work モデル | `spec/models/work_spec.rb` | unit test |
| Record モデル | `spec/models/record_spec.rb` | unit test |
| TmdbAdapter | `spec/services/external_apis/tmdb_adapter_spec.rb` | unit test |
| AniListAdapter | `spec/services/external_apis/anilist_adapter_spec.rb` | unit test |
| GoogleBooksAdapter | `spec/services/external_apis/google_books_adapter_spec.rb` | unit test |
| IgdbAdapter | `spec/services/external_apis/igdb_adapter_spec.rb` | unit test |
| WorkSearchService | `spec/services/work_search_service_spec.rb` | unit test |
| 検索API | `spec/requests/api/v1/works_spec.rb` | request spec |
| 記録API | `spec/requests/api/v1/records_spec.rb` | request spec |

### フロントエンド（Vitest + RTL）
| 対象 | テストファイル | テスト種別 |
|------|-------------|----------|
| SearchPage | `src/pages/SearchPage/SearchPage.test.tsx` | コンポーネント |
| WorkCard | `src/components/WorkCard/WorkCard.test.tsx` | コンポーネント |
| ManualWorkForm | `src/components/ManualWorkForm/ManualWorkForm.test.tsx` | コンポーネント |

## バックエンド テストケース

### Workモデル
- [ ] 正常系: 必須フィールド（title, media_type）があれば作成できる
- [ ] 正常系: 全フィールド指定で作成できる
- [ ] 異常系: titleがなければバリデーションエラー
- [ ] 異常系: media_typeがなければバリデーションエラー
- [ ] 異常系: 無効なmedia_typeでバリデーションエラー
- [ ] 正常系: external_api_id + external_api_sourceの組み合わせがユニーク

### Recordモデル
- [ ] 正常系: user_id + work_idで記録作成できる
- [ ] 異常系: 同じuser_id + work_idの重複を拒否
- [ ] 正常系: statusのデフォルト値が設定される
- [ ] リレーション: user, workとの関連が正しい

### 外部APIアダプタ（共通パターン — WebMockでHTTP応答をモック）
- [ ] 正常系: キーワード検索で結果を統一フォーマットで返す
- [ ] 正常系: 結果が0件の場合は空配列を返す
- [ ] 異常系: APIエラー時に適切な例外 or 空配列を返す
- [ ] 異常系: タイムアウト時の挙動

### WorkSearchService
- [ ] 正常系: ジャンル指定なしで全アダプタに問い合わせる
- [ ] 正常系: ジャンル指定で対応するアダプタのみに問い合わせる
- [ ] 正常系: RedisキャッシュがあればAPIを叩かない
- [ ] 正常系: キャッシュミス時にAPIを叩いてキャッシュに保存

### 検索API（GET /api/v1/works/search）
- [ ] 正常系: キーワードで検索して結果を返す
- [ ] 正常系: media_typeフィルタで絞り込みできる
- [ ] 異常系: 未認証ユーザーは401
- [ ] 異常系: キーワード未指定は422

### 手動登録API（POST /api/v1/works）
- [ ] 正常系: title + media_typeで作品を登録して201を返す
- [ ] 異常系: titleなしで422
- [ ] 異常系: 未認証ユーザーは401

### 記録API（POST /api/v1/records）
- [ ] 正常系: 既存Workへの記録追加で201を返す
- [ ] 正常系: キャッシュからWorkを作成して記録追加
- [ ] 異常系: 同じ作品を二重記録しようとすると422
- [ ] 異常系: 未認証ユーザーは401

## フロントエンド テストケース

### SearchPage
- [ ] 正常系: 検索バーとジャンルフィルタが表示される
- [ ] 正常系: キーワード入力 → 検索実行で結果が表示される
- [ ] 正常系: ジャンルフィルタ切り替えで再検索される
- [ ] 正常系: 結果がない場合「見つかりませんでした」表示
- [ ] 正常系: ローディング表示

### WorkCard
- [ ] 正常系: 作品情報（タイトル、画像、ジャンル）が表示される
- [ ] 正常系: 「記録する」ボタンが表示される
- [ ] 正常系: 「記録する」ボタン押下でAPI呼び出し

### ManualWorkForm
- [ ] 正常系: タイトルとジャンルを入力して登録できる
- [ ] 異常系: タイトル未入力でバリデーションエラー表示
- [ ] 正常系: 登録成功後にフォームがリセットされる
