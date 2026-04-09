# frozen_string_literal: true

module Api
  module V1
    class OauthRegistrationsController < ApplicationController
      # APIモードではcookiesが使えないため手動でinclude（remember_meに必要）
      include ActionController::Cookies
      include Devise::Controllers::Rememberable

      def create
        oauth_data = validate_oauth_session
        return render json: { error: '認証の有効期限が切れました。もう一度お試しください' }, status: :unauthorized unless oauth_data

        user = create_oauth_user(oauth_data)
        session.delete(:oauth_data)
        sign_in(user)
        remember_me(user)
        render json: { user: user_json(user.reload) }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_content
      end

      private

      def create_oauth_user(oauth_data)
        # ADR-0036: encrypted_password 空文字ハックを廃止。SecureRandom の bcrypt ハッシュを残す。
        # password_set_at は nil のまま → has_password = false として UI 上は「未設定」と扱われる
        user = build_user(oauth_data)
        user.save!
        user
      end

      def build_user(oauth_data)
        user = User.new(
          username: params[:username],
          email: oauth_data[:email].presence || '',
          password: SecureRandom.hex(32)
        )
        # バリデーション前にuser_providersを関連付けておく
        # （password_required?/email_required?がuser_providers.any?を参照するため）
        user.user_providers.build(
          provider: oauth_data[:provider],
          provider_uid: oauth_data[:uid]
        )
        user
      end

      def validate_oauth_session
        data = session[:oauth_data]
        return nil unless data

        data = data.symbolize_keys if data.respond_to?(:symbolize_keys)

        if data[:expires_at].to_i < Time.current.to_i
          session.delete(:oauth_data)
          return nil
        end

        data
      end
    end
  end
end
