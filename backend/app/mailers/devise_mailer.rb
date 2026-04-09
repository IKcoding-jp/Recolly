# frozen_string_literal: true

# Devise のデフォルトメーラーを拡張し、フロントエンド URL をテンプレートに渡す。
# API モードでは routes ヘルパーがバックエンドのホストを返してしまうため、
# パスワードリセットリンクを組み立てる際に明示的にフロントエンド URL を注入する。
class DeviseMailer < Devise::Mailer
  default from: 'noreply@recolly.net'

  def reset_password_instructions(record, token, opts = {})
    @frontend_url = ENV.fetch('FRONTEND_URL', 'http://localhost:5173')
    opts[:subject] = '【Recolly】パスワードリセットのご案内'
    super
  end
end
