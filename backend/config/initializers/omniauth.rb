# frozen_string_literal: true

# OmniAuthミドルウェアのパスプレフィックス設定
# routes.rbのdevise_for path: "api/v1"とミドルウェアのパスを一致させる
# deviseのconfig.omniauth_path_prefixだけではミドルウェアレベルに反映されないため、
# OmniAuth.config.path_prefixも明示的に設定する
OmniAuth.config.path_prefix = '/api/v1/auth'
