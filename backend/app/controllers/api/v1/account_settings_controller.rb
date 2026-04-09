# frozen_string_literal: true

module Api
  module V1
    class AccountSettingsController < ApplicationController
      before_action :authenticate_user!

      # Google Identity Services (ADR-0035) の ID Token を受け取って
      # 現在のユーザーに対してOAuthプロバイダ連携を追加する
      def link_provider
        credential = params[:credential]
        return render json: { error: 'credentialが必要です' }, status: :bad_request if credential.blank?

        payload = verify_google_credential(credential)
        return render json: { error: '認証に失敗しました' }, status: :unauthorized if payload.nil?

        create_provider_for_current_user(payload)
      end

      def unlink_provider
        provider = current_user.user_providers.find_by(provider: params[:provider])
        return render json: { error: '連携が見つかりません' }, status: :not_found unless provider

        if last_login_method?
          return render json: { error: '最後のログイン手段は解除できません。先にパスワードを設定するか、別のOAuthを連携してください' },
                        status: :unprocessable_content
        end

        provider.destroy!
        render json: { user: user_json(current_user.reload) }
      end

      def set_password
        return render_password_mismatch if params[:password] != params[:password_confirmation]

        update_password
      end

      def set_email
        return render_email_already_set if current_user.email.present?
        return render_email_taken if email_taken?

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
        render json: { error: 'このプロバイダは既に連携済みです' }, status: :unprocessable_content
      end

      def update_password
        assign_password_params
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

      def render_password_mismatch
        render json: { error: 'パスワードが一致しません' }, status: :unprocessable_content
      end

      def render_email_already_set
        render json: { error: 'メールアドレスは既に設定されています' }, status: :unprocessable_content
      end

      def render_email_taken
        render json: { error: 'このメールアドレスは既に使用されています' }, status: :unprocessable_content
      end

      def last_login_method?
        has_password = current_user.encrypted_password.present?
        provider_count = current_user.user_providers.count
        !has_password && provider_count <= 1
      end

      def email_taken?
        User.exists?(email: params[:email])
      end
    end
  end
end
