# frozen_string_literal: true

module Api
  module V1
    class RegistrationsController < Devise::RegistrationsController
      respond_to :json

      private

      def respond_with(resource, _opts = {})
        if resource.persisted?
          # ADR-0036: メール+パスワード登録は「ユーザー自身がパスワードを設定した」状態。
          # has_password 判定を password_set_at で行うため、登録時に明示的にセットする。
          resource.update_column(:password_set_at, Time.current) if resource.password_set_at.nil? # rubocop:disable Rails/SkipsModelValidations
          render json: { user: user_json(resource) }, status: :created
        else
          render json: { errors: resource.errors.full_messages }, status: :unprocessable_content
        end
      end

      # deviseのデフォルトではemail + passwordのみ許可。usernameを追加
      def sign_up_params
        params.expect(user: %i[username email password password_confirmation])
      end
    end
  end
end
