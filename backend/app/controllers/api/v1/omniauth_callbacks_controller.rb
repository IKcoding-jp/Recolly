# frozen_string_literal: true

module Api
  module V1
    class OmniauthCallbacksController < Devise::OmniauthCallbacksController
      # CSRF検証をスキップ（OmniAuthのstateパラメータがCSRF保護を担当）
      # フロントエンド（localhost:5173）とバックエンド（localhost:3000）が別オリジンのため、
      # セッションベースのCSRFトークン検証が機能しない
      skip_forgery_protection

      def google_oauth2
        handle_oauth_callback
      end

      def failure
        redirect_to_frontend(status: 'error', message: 'oauth_failed')
      end

      private

      def handle_oauth_callback
        auth_data = request.env['omniauth.auth']

        # ログイン済みユーザーの場合はOAuth連携追加フロー
        if user_signed_in?
          handle_link_provider(auth_data)
          return
        end

        handle_service_result(auth_data)
      end

      def handle_service_result(auth_data)
        result = Oauth::FindOrCreateUserService.new(auth_data).call

        case result[:status]
        when :existing_user
          sign_in(result[:user])
          redirect_to_frontend(status: 'success')
        when :new_user
          store_oauth_data_in_session(result[:oauth_data])
          redirect_to_frontend(status: 'new_user')
        when :conflict
          handle_conflict(result, auth_data)
        end
      end

      def handle_conflict(result, auth_data)
        redirect_to_frontend(
          status: 'error',
          message: result[:error][:code],
          provider: auth_data.provider
        )
      end

      # ログイン済みユーザーがOAuth連携を追加する場合
      def handle_link_provider(auth_data)
        UserProvider.create!(
          user: current_user,
          provider: auth_data.provider,
          provider_uid: auth_data.uid
        )
        redirect_to_frontend(status: 'provider_linked')
      rescue ActiveRecord::RecordInvalid
        redirect_to_frontend(status: 'error', message: 'provider_already_linked')
      end

      def store_oauth_data_in_session(oauth_data)
        session[:oauth_data] = oauth_data.merge(
          expires_at: 15.minutes.from_now.to_i
        )
      end

      def redirect_to_frontend(**params)
        query = params.compact.to_query
        frontend_url = ENV.fetch('FRONTEND_URL', 'http://localhost:5173')
        redirect_to "#{frontend_url}/auth/callback?#{query}", allow_other_host: true
      end
    end
  end
end
