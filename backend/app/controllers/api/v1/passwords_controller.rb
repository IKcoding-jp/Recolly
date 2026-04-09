# frozen_string_literal: true

module Api
  module V1
    class PasswordsController < Devise::PasswordsController
      respond_to :json

      # POST /api/v1/password — パスワードリセットメール送信
      def create
        self.resource = resource_class.send_reset_password_instructions(resource_params)

        # セキュリティ上、登録有無に関わらず同じレスポンスを返す
        render json: { message: 'パスワードリセットの手順をメールで送信しました' }, status: :ok
      end

      # PUT /api/v1/password — リセットトークンによる新パスワード設定
      def update
        self.resource = resource_class.reset_password_by_token(resource_params)

        if resource.errors.empty?
          render json: { message: 'パスワードを更新しました' }, status: :ok
        else
          render json: {
            error: 'password_reset_failed',
            errors: resource.errors.full_messages
          }, status: :unprocessable_content
        end
      end
    end
  end
end
