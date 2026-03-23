# frozen_string_literal: true

# OmniAuthミドルウェアのパスプレフィックス設定
# routes.rbのdevise_for path: "api/v1"とミドルウェアのパスを一致させる
# deviseのconfig.omniauth_path_prefixだけではミドルウェアレベルに反映されないため、
# OmniAuth.config.path_prefixも明示的に設定する
OmniAuth.config.path_prefix = '/api/v1/auth'

# APIモードではセッションベースのCSRFトークン検証が機能しない
# （フロントエンドとバックエンドが別オリジンでセッションを共有できない）
# OmniAuthのstateパラメータがOAuth固有のCSRF保護を担当するため、
# omniauth-rails_csrf_protectionのフォームトークン検証を無効化
OmniAuth.config.on_failure = proc { |env|
  OmniAuth::FailureEndpoint.new(env).redirect_to_failure
}
OmniAuth.config.request_validation_phase = nil
