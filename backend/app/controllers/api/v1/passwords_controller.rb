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
          # code ベースのエラー形式（既存の ApiErrorCodes パターンに準拠）
          # 原因が何であれ（無効トークン/期限切れ/パスワード要件違反）、
          # ユーザー向けには統一して「リンクが無効または期限切れ」と案内する
          render json: {
            code: ApiErrorCodes::PASSWORD_RESET_FAILED,
            error: 'リンクが無効または期限切れです',
            errors: resource.errors.full_messages
          }, status: :unprocessable_content
        end
      end
    end
  end
end
