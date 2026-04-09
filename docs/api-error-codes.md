# API エラーコード一覧

Recolly のバックエンド API が返すエラーコードの一覧と運用ルール。
フロントエンドの `frontend/src/lib/errorMessages.ts` と対応する。

## レスポンス形式

エラー時は以下の形式で統一する：

```json
{
  "error": "人間向けメッセージ（後方互換フィールド）",
  "code": "エラーコード（機械判別用）",
  "message": "人間向けメッセージ（新形式の主読み取り先）"
}
```

フロントエンドの `api.ts` の `request()` はこの順で読み取る：
1. `code` があれば `errorMessages.ts` の辞書を引く
2. 辞書になければ `error` または `message` をそのまま表示
3. どれもなければ `errors[]` の join、最終フォールバックは「エラーが発生しました」

## コード一覧

| コード | HTTPステータス | 発生元 | 意味 |
|--------|---------------|--------|------|
| `unauthorized` | 401 | GoogleIdTokenSessions, AccountSettings | 認証失敗 |
| `bad_request` | 400 | GoogleIdTokenSessions, AccountSettings | リクエストパラメータ不正 |
| `email_already_registered` | 409 | GoogleIdTokenSessions | 既にメール+パスワードで登録済み |
| `email_registered_with_other_provider` | 409 | GoogleIdTokenSessions | 別プロバイダで登録済み |
| `last_login_method` | 422 | AccountSettings | 最後のログイン手段の解除を拒否 |
| `provider_not_found` | 404 | AccountSettings | 指定のプロバイダ連携が存在しない |
| `provider_already_linked` | 422 | AccountSettings | このプロバイダは既に連携済み |
| `password_empty` | 422 | AccountSettings | パスワードが空文字 |
| `password_mismatch` | 422 | AccountSettings | パスワードと確認パスワードが一致しない |
| `email_already_set` | 422 | AccountSettings | メールアドレスは既に設定されている |
| `email_taken` | 422 | AccountSettings | メールアドレスは既に別ユーザーで使用中 |

## 新しいコードを追加する手順

1. `backend/app/errors/api_error_codes.rb` に定数を追加
2. このドキュメントに行を追加
3. `frontend/src/lib/errorMessages.ts` に日本語メッセージを追加
4. `frontend/src/lib/errorMessages.test.ts` にテストを追加
