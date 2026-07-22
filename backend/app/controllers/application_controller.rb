# frozen_string_literal: true

class ApplicationController < ActionController::API
  include ActionController::RequestForgeryProtection

  protect_from_forgery with: :null_session

  # 既存APIはRailsのCSRFトークンを送信しないため、トークン検証はスキップする。
  # 代わりにカスタムヘッダ必須方式でCSRF対策を行う（診断M-2 / ADR-0052）。
  skip_forgery_protection

  # deviseがrespond_toを使うため、APIモードに手動追加
  include ActionController::MimeResponds

  respond_to :json

  # CSRF対策のカスタムヘッダ（診断M-2）。ブラウザは非セーフリストヘッダを
  # クロスオリジンで付ける際にpreflightを要求し、CORS未許可オリジンは弾かれる。
  # フォーム送信は任意ヘッダを付けられないため、状態変更のCSRFが成立しない。
  CSRF_PROTECTION_HEADER = 'X-Requested-With'

  before_action :verify_csrf_protection_header!

  rescue_from ActiveRecord::RecordNotFound, with: :record_not_found

  private

  # 状態変更リクエスト（GET/HEAD/OPTIONS以外）にカスタムヘッダを必須化する。
  # 正当なフロントは共通のfetchラッパーで常に付与する。
  def verify_csrf_protection_header!
    return unless Rails.application.config.x.csrf_header_protection
    return if request.get? || request.head? || request.options?
    return if request.headers[CSRF_PROTECTION_HEADER].present?

    render_error(code: 'invalid_request', message: '不正なリクエストです', status: :forbidden)
  end

  def record_not_found
    render json: { error: 'リソースが見つかりません' }, status: :not_found
  end

  # エラーレスポンス生成ヘルパー。
  # バックエンドのエラーを {error, code, message} の統一形式で返す。
  # error フィールドは既存フロントの後方互換用。code は機械判別用。
  def render_error(code:, message:, status:)
    render json: { error: message, code: code, message: message }, status: status
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
      # has_password は「ユーザーが自分でパスワードを設定したか」を表す。
      # OAuth 新規登録時の SecureRandom ハッシュは「設定済み」とは扱わないため
      # encrypted_password ではなく password_set_at で判定する（ADR-0036）
      has_password: user.password_set_at.present?,
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
