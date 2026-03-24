# frozen_string_literal: true

# Recollyで変更した設定のみ記載。デフォルト値はdeviseの公式Wikiを参照:
# https://github.com/heartcombo/devise/wiki

Devise.setup do |config|
  # メーラーの送信元アドレス
  config.mailer_sender = 'noreply@recolly.com'

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

  # OmniAuthのパスプレフィックス（routes.rbのdevise_for path: "api/v1"と一致させる）
  # Deviseのルーティングとミドルウェア両方がコールバックURLを正しく認識するために必要
  config.omniauth_path_prefix = '/api/v1/auth'

  # OmniAuthプロバイダ設定（ADR-0013）
  # 本番ではCloudFront経由のため、redirect_uriを明示的に指定する必要がある
  # （EC2が自身のホスト名でURLを生成すると、Googleの登録URLと一致しない）
  # omniauth-oauth2はcallback_urlオプションではなくStrategyのメソッドでURLを生成するため、
  # redirect_uriをauthorize_paramsで直接指定する
  google_oauth_options = { scope: 'email,profile' }
  if ENV['FRONTEND_URL'].present?
    google_redirect_uri = "#{ENV['FRONTEND_URL']}/api/v1/auth/google_oauth2/callback"
    google_oauth_options[:redirect_uri] = google_redirect_uri
    google_oauth_options[:callback_url] = google_redirect_uri
  end
  config.omniauth :google_oauth2,
                  ENV['GOOGLE_CLIENT_ID'],
                  ENV['GOOGLE_CLIENT_SECRET'],
                  google_oauth_options
end
