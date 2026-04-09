# frozen_string_literal: true

class ApplicationController < ActionController::API
  include ActionController::RequestForgeryProtection

  protect_from_forgery with: :null_session

  # 既存APIはCSRFトークンを送信しないため、デフォルトで検証をスキップ
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
    user.as_json(only: %i[id username email bio created_at]).merge(
      avatar_url: resolve_avatar_url(user.avatar_url),
      has_password: user.encrypted_password.present?,
      providers: user.user_providers.pluck(:provider),
      email_missing: user.email.blank?
    )
  end

  # お気に入り作品のJSON表現
  def favorite_work_json(favorite_work)
    {
      id: favorite_work.id,
      position: favorite_work.position,
      work: {
        id: favorite_work.work.id,
        title: favorite_work.work.title,
        media_type: favorite_work.work.media_type,
        cover_image_url: favorite_work.work.resolved_cover_image_url
      }
    }
  end

  # avatar_urlがS3キーの場合、署名付きURLに変換する
  def resolve_avatar_url(avatar_url)
    return nil if avatar_url.blank?
    return avatar_url unless avatar_url.start_with?('uploads/')

    S3PresignService.presign_get(avatar_url)
  end
end
