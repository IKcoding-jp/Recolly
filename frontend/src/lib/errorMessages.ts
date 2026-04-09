// バックエンドの ApiErrorCodes (backend/app/errors/api_error_codes.rb) と
// 対応する日本語メッセージ辞書。
// バックエンドから code が返ってきたら辞書を引いて日本語メッセージに変換する。
// 辞書にない code や code なしの場合はバックエンドの生メッセージをそのまま使う。
// 詳細は docs/api-error-codes.md を参照。

const ERROR_MESSAGES: Record<string, string> = {
  email_already_registered:
    'このメールアドレスは既にメール+パスワードで登録されています。メールでログインしてください',
  email_registered_with_other_provider: 'このメールアドレスは別のアカウントで登録されています',
  unauthorized: '認証に失敗しました。もう一度お試しください',
  invalid_credential: '認証情報が無効です',
  bad_request: 'リクエスト内容が不正です',
  last_login_method:
    '最後のログイン手段は解除できません。先にパスワードを設定するか、別のOAuthを連携してください',
  provider_not_found: '連携が見つかりません',
  provider_already_linked: 'このプロバイダは既に連携済みです',
  password_empty: 'パスワードを入力してください',
  password_mismatch: 'パスワードが一致しません',
  email_already_set: 'メールアドレスは既に設定されています',
  email_taken: 'このメールアドレスは既に使用されています',
  password_reset_failed: 'リンクが無効または期限切れです。再度リセットを申請してください',
  network_error: 'ネットワークに接続できませんでした。通信環境をご確認ください',
}

export function getErrorMessage(code: string | undefined, fallback: string): string {
  if (!code) return fallback
  return ERROR_MESSAGES[code] ?? fallback
}
