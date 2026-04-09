# frozen_string_literal: true

module Api
  module V1
    # Google Identity Services (ADR-0035) で発行されたID Tokenを受け取り、
    # 検証してログイン処理を行うコントローラー。
    #
    # 旧OmniauthCallbacksControllerの置き換え。旧方式はブラウザリダイレクトを
    # 伴うためPWAスタンドアロンモードで白画面不具合があったが、本方式は
    # JavaScript内でID Tokenを受け取るためページ遷移が発生しない。
    class GoogleIdTokenSessionsController < ApplicationController
      # APIモードではActionController::APIがcookiesを持たないため明示的にinclude
      include ActionController::Cookies
      include Devise::Controllers::Rememberable

      # ID Token自体が改ざん不能な署名付きトークンなので、CSRFトークンは不要
      # （かつログイン前なのでsessionにCSRFトークンが存在しない）
      skip_forgery_protection

      SESSION_EXPIRY_MINUTES = 15

      def create
        credential = params[:credential]
        return render_bad_request if credential.blank?

        payload = verify_credential(credential)
        return render_unauthorized if payload.nil?

        handle_service_result(payload)
      end

      private

      def verify_credential(credential)
        GoogleIdTokenVerifier.new(credential: credential).call
      rescue Google::Auth::IDTokens::VerificationError, ArgumentError
        nil
      end

      def handle_service_result(payload)
        result = Oauth::FindOrCreateUserService.new(
          provider: 'google_oauth2',
          uid: payload[:sub],
          email: payload[:email],
          name: payload[:name]
        ).call

        case result[:status]
        when :existing_user
          sign_in_existing_user(result[:user])
        when :new_user
          store_oauth_data_and_prompt_username(result[:oauth_data])
        when :conflict
          render_conflict(result[:error])
        end
      end

      def sign_in_existing_user(user)
        sign_in(user)
        remember_me(user)
        render json: { status: 'success', user: user_json(user) }, status: :ok
      end

      def store_oauth_data_and_prompt_username(oauth_data)
        session[:oauth_data] = oauth_data.merge(
          expires_at: SESSION_EXPIRY_MINUTES.minutes.from_now.to_i
        )
        render json: { status: 'new_user' }, status: :ok
      end

      def render_conflict(error)
        render json: {
          status: 'error',
          code: error[:code],
          message: error[:message]
        }, status: :conflict
      end

      def render_unauthorized
        render json: { error: '認証に失敗しました' }, status: :unauthorized
      end

      def render_bad_request
        render json: { error: 'credentialが必要です' }, status: :bad_request
      end
    end
  end
end
