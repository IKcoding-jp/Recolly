# frozen_string_literal: true

module Api
  module V1
    class AccountSettingsController < ApplicationController
      before_action :authenticate_user!

      # Google Identity Services (ADR-0035) の ID Token を受け取って
      # 現在のユーザーに対してOAuthプロバイダ連携を追加する
      def link_provider
        credential = params[:credential]
        if credential.blank?
          return render_error(code: ApiErrorCodes::BAD_REQUEST,
                              message: 'credentialが必要です',
                              status: :bad_request)
        end

        payload = verify_google_credential(credential)
        if payload.nil?
          return render_error(code: ApiErrorCodes::UNAUTHORIZED,
                              message: '認証に失敗しました',
                              status: :unauthorized)
        end

        create_provider_for_current_user(payload)
      end

      def unlink_provider
        provider = current_user.user_providers.find_by(provider: params[:provider])
        unless provider
          return render_error(code: ApiErrorCodes::PROVIDER_NOT_FOUND,
                              message: '連携が見つかりません',
                              status: :not_found)
        end

        if last_login_method?
          return render_error(code: ApiErrorCodes::LAST_LOGIN_METHOD,
                              message: '最後のログイン手段は解除できません。先にパスワードを設定するか、別のOAuthを連携してください',
                              status: :unprocessable_content)
        end

        # Controller チェックを通過しても、モデル層の before_destroy で
        # 弾かれた場合はトランザクションごと rollback される（多層防御）
        ActiveRecord::Base.transaction do
          provider.destroy!
        end

        render json: { user: user_json(current_user.reload) }
      rescue ActiveRecord::RecordNotDestroyed
        render_error(code: ApiErrorCodes::LAST_LOGIN_METHOD,
                     message: '最後のログイン手段は解除できません',
                     status: :unprocessable_content)
      end

      def set_password
        if params[:password].blank?
          return render_error(code: ApiErrorCodes::PASSWORD_EMPTY,
                              message: 'パスワードを入力してください',
                              status: :unprocessable_content)
        end
        if params[:password] != params[:password_confirmation]
          return render_error(code: ApiErrorCodes::PASSWORD_MISMATCH,
                              message: 'パスワードが一致しません',
                              status: :unprocessable_content)
        end

        update_password
      end

      def set_email
        if current_user.email.present?
          return render_error(code: ApiErrorCodes::EMAIL_ALREADY_SET,
                              message: 'メールアドレスは既に設定されています',
                              status: :unprocessable_content)
        end
        if email_taken?
          return render_error(code: ApiErrorCodes::EMAIL_TAKEN,
                              message: 'このメールアドレスは既に使用されています',
                              status: :unprocessable_content)
        end

        update_email
      end

      private

      def verify_google_credential(credential)
        GoogleIdTokenVerifier.new(credential: credential).call
      rescue Google::Auth::IDTokens::VerificationError, ArgumentError
        nil
      end

      def create_provider_for_current_user(payload)
        UserProvider.create!(
          user: current_user,
          provider: 'google_oauth2',
          provider_uid: payload[:sub]
        )
        render json: { user: user_json(current_user.reload) }
      rescue ActiveRecord::RecordInvalid
        render_error(code: ApiErrorCodes::PROVIDER_ALREADY_LINKED,
                     message: 'このプロバイダは既に連携済みです',
                     status: :unprocessable_content)
      end

      def update_password
        assign_password_params
        # ADR-0036: パスワード設定済みフラグ。OAuth専用ユーザーが初めて自分でパスワードを
        # 設定したタイミングを記録する。has_password 判定もこの値を使う。
        current_user.password_set_at = Time.current
        save_and_render(current_user)
      end

      def assign_password_params
        current_user.password = params[:password]
        current_user.password_confirmation = params[:password_confirmation]
      end

      def update_email
        current_user.email = params[:email]
        save_and_render(current_user)
      end

      def save_and_render(user)
        if user.save
          render json: { user: user_json(user) }
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_content
        end
      end

      def last_login_method?
        # password_set_at が nil なら「ユーザー自身がパスワード未設定」（ADR-0036）
        has_password = current_user.password_set_at.present?
        provider_count = current_user.user_providers.count
        !has_password && provider_count <= 1
      end

      def email_taken?
        User.exists?(email: params[:email])
      end
    end
  end
end
