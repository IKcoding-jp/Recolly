# ADR-0032: RESTful API設計規約

## ステータス
承認済み

## 背景
Recollyのバックエンドは Rails APIモードで、フロントエンドとJSON形式で通信する。新しいAPIエンドポイントを追加する際に、一貫した設計ルールが必要。URLの命名、リソースのネスト方針、認証パスのカスタマイズ等の規約を記録する。

## 決定

### 1. バージョニング

全APIエンドポイントは `/api/v1/` プレフィックスを使用する。

```
✅ /api/v1/records
✅ /api/v1/works/search
❌ /records（バージョンなし）
```

**理由:** 将来APIに破壊的変更が必要になった場合、`/api/v2/` を追加して段階的に移行できる。v1の利用者に影響を与えない。

### 2. リソース設計（resources vs resource）

| パターン | 使い分け | 例 |
|---------|---------|-----|
| `resources`（複数形） | 複数のレコードが存在するリソース。IDで個別アクセス | `/api/v1/records`, `/api/v1/records/:id` |
| `resource`（単数形） | ログインユーザーに紐づく1つだけのリソース。IDが不要 | `/api/v1/current_user`, `/api/v1/statistics`, `/api/v1/account_settings` |

```
resources（ID指定でアクセス）:
  GET    /api/v1/records       → 記録一覧
  GET    /api/v1/records/:id   → 記録詳細
  POST   /api/v1/records       → 記録作成
  PATCH  /api/v1/records/:id   → 記録更新
  DELETE /api/v1/records/:id   → 記録削除

resource（ID不要、ログインユーザーのデータ）:
  GET    /api/v1/current_user  → 自分のユーザー情報
  GET    /api/v1/statistics    → 自分の統計情報
```

### 3. ネストリソースの方針

**親リソースに従属するデータは1段階だけネストする。**

```
✅ /api/v1/records/:record_id/episode_reviews   → 記録に紐づく感想
✅ /api/v1/records/:record_id/tags              → 記録に紐づくタグ
❌ /api/v1/users/:user_id/records/:record_id/episode_reviews  → 2段階以上はNG
```

**理由:** ネストが深くなるとURLが長くなり、フロントエンドでの呼び出しが煩雑になる。1段階のネストで親子関係は十分に表現できる。

### 4. コレクションアクション（CRUD以外の操作）

標準のCRUD（一覧/詳細/作成/更新/削除）に当てはまらない操作は `collection` または `member` で定義する。

```ruby
# 作品検索（特定のIDではなく、全体に対する検索）
resources :works, only: [:create] do
  collection do
    get :search   # GET /api/v1/works/search?q=キーワード
  end
end

# アカウント設定（カスタムアクション）
resource :account_settings, only: [] do
  post :link_provider      # POST /api/v1/account_settings/link_provider
  delete :unlink_provider  # DELETE /api/v1/account_settings/unlink_provider
  put :set_password        # PUT /api/v1/account_settings/set_password
  put :set_email           # PUT /api/v1/account_settings/set_email
end
```

### 5. Devise認証パスのカスタマイズ

Devise（認証ライブラリ）のデフォルトパスをAPI向けにカスタマイズしている:

| Deviseデフォルト | カスタマイズ後 | 理由 |
|-----------------|-------------|------|
| `POST /users/sign_in` | `POST /api/v1/login` | APIらしいシンプルな名前 |
| `DELETE /users/sign_out` | `DELETE /api/v1/logout` | 同上 |
| `POST /users` | `POST /api/v1/signup` | 同上 |
| `POST /users/password` | `POST /api/v1/password` | 同上 |

### 6. HTTPメソッドとステータスコードの対応

| 操作 | HTTPメソッド | 成功時のステータス |
|------|------------|-----------------|
| 一覧取得 | GET | 200 OK |
| 詳細取得 | GET | 200 OK |
| 作成 | POST | **201 Created**（200ではない） |
| 更新 | PATCH | 200 OK |
| 削除 | DELETE | **204 No Content** |

### 7. 現在のエンドポイント全体像

```
認証:
  POST   /api/v1/login                    → ログイン
  DELETE /api/v1/logout                   → ログアウト
  POST   /api/v1/signup                   → サインアップ
  POST   /api/v1/password                 → パスワードリセット

認証情報:
  GET    /api/v1/current_user             → ログインユーザー情報
  GET    /api/v1/csrf_token               → CSRFトークン取得

OAuth:
  POST   /api/v1/auth/complete_registration → OAuth登録完了

アカウント設定:
  POST   /api/v1/account_settings/link_provider     → プロバイダ連携
  DELETE /api/v1/account_settings/unlink_provider   → プロバイダ連携解除
  PUT    /api/v1/account_settings/set_password      → パスワード設定
  PUT    /api/v1/account_settings/set_email         → メール設定

作品:
  GET    /api/v1/works/search             → 作品検索
  POST   /api/v1/works                    → 作品手動登録

記録:
  GET    /api/v1/records                  → 記録一覧（フィルタ・ソート対応）
  GET    /api/v1/records/:id              → 記録詳細
  POST   /api/v1/records                  → 記録作成
  PATCH  /api/v1/records/:id              → 記録更新
  DELETE /api/v1/records/:id              → 記録削除

記録に紐づくリソース:
  GET    /api/v1/records/:id/episode_reviews     → 感想一覧
  POST   /api/v1/records/:id/episode_reviews     → 感想作成
  PATCH  /api/v1/records/:id/episode_reviews/:id → 感想更新
  DELETE /api/v1/records/:id/episode_reviews/:id → 感想削除
  POST   /api/v1/records/:id/tags                → タグ追加
  DELETE /api/v1/records/:id/tags/:id            → タグ削除

タグ:
  GET    /api/v1/tags                     → ユーザーの全タグ一覧
  DELETE /api/v1/tags/:id                 → タグ自体の削除

統計:
  GET    /api/v1/statistics               → 統計情報

ヘルスチェック:
  GET    /api/v1/health                   → サーバー死活確認
```

## 理由
- **RESTful設計はWeb API のデファクトスタンダード。** リソース（名詞）+ HTTPメソッド（動詞）の組み合わせでAPIを設計する。直感的で学習コストが低い
- **1段階ネストの制限で複雑さを抑える。** 深いネストはURLが長くなり使いにくい
- **単数resourceでIDなしアクセスを実現。** 「自分の統計」「自分の設定」はIDが不要。ログインユーザーから自動判定
- **DeviseパスのカスタマイズでAPIらしいURL。** `/users/sign_in` より `/api/v1/login` の方が直感的

## 影響
- 新しいAPIエンドポイントを追加する際はこの規約に従う
- ネストリソースは1段階まで。2段階以上が必要に感じたら設計を見直す
- POSTで新規リソースを作成するAPIは必ず201 Createdを返す（CLAUDE.md規約）
