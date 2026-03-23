# frozen_string_literal: true

class ApplicationController < ActionController::API
  include ActionController::RequestForgeryProtection

  protect_from_forgery with: :null_session

  # 既存APIはCSRFトークンを送信しないため、デフォルトで検証をスキップ
  # OAuthフォームPOSTはomniauth-rails_csrf_protectionが保護する
  skip_forgery_protection

  # deviseがrespond_toを使うため、APIモードに手動追加
  include ActionController::MimeResponds

  respond_to :json

  rescue_from ActiveRecord::RecordNotFound, with: :record_not_found

  private

  def record_not_found
    render json: { error: 'リソースが見つかりません' }, status: :not_found
  end

  # 未認証ユーザーへの401レスポンス（deviseのデフォルトリダイレクトを上書き）
  def authenticate_user!
    return if user_signed_in?

    render json: { error: 'ログインが必要です' }, status: :unauthorized
  end

  # ユーザー情報のJSON表現（パスワード等の機密情報を除外）
  def user_json(user)
    user.as_json(only: %i[id username email avatar_url bio created_at]).merge(
      has_password: user.encrypted_password.present?,
      providers: user.user_providers.pluck(:provider),
      email_missing: user.email.blank?
    )
  end
end
