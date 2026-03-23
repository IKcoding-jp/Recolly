# frozen_string_literal: true

module Api
  module V1
    class AccountSettingsController < ApplicationController
      before_action :authenticate_user!

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
