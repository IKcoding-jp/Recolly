# frozen_string_literal: true

# Recollyで変更した設定のみ記載。デフォルト値はdeviseの公式Wikiを参照:
# https://github.com/heartcombo/devise/wiki

Devise.setup do |config|
  # メーラーの送信元アドレス（SES の検証ドメイン recolly.net と一致させる必要あり）
  config.mailer_sender = 'noreply@recolly.net'

  # ORM設定
  require 'devise/orm/active_record'

  # emailの大文字小文字を区別しない
  config.case_insensitive_keys = [:email]

  # emailの前後の空白を除去
  config.strip_whitespace_keys = [:email]

  # HTTP認証はセッションに保存しない
  config.skip_session_storage = [:http_auth]

  # テスト環境ではパスワードハッシュ化の計算回数を最小にして高速化
  config.stretches = Rails.env.test? ? 1 : 12

  # :confirmable モジュールを追加した際に有効化する
  # config.reconfirmable = true

  # ログアウト時に全てのremember meトークンを無効化
  config.expire_all_remember_me_on_sign_out = true

  # ログイン保持期間（remember meトークンの有効期限）
  config.remember_for = 90.days

  # アクセスのたびにremember meの有効期限を延長する
  # （アクティブユーザーは実質ログアウト不要になる）
  config.extend_remember_period = true

  # パスワードの長さ制限
  config.password_length = 6..128

  # メールアドレスのバリデーション（@が1つ含まれること）
  config.email_regexp = /\A[^@\s]+@[^@\s]+\z/

  # パスワードリセットトークンの有効期限
  config.reset_password_within = 6.hours

  # APIモードではHTMLリダイレクトを無効化し、全てJSONレスポンスを返す
  config.navigational_formats = []

  # ログアウトのHTTPメソッド
  config.sign_out_via = :delete

  # Hotwire/Turbo互換のレスポンスステータス
  config.responder.error_status = :unprocessable_content
  config.responder.redirect_status = :see_other
end
