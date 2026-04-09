# frozen_string_literal: true

module Api
  module V1
    class RegistrationsController < Devise::RegistrationsController
      respond_to :json

      private

      def respond_with(resource, _opts = {})
        if resource.persisted?
          # ADR-0036: password_set_at は User#before_create でアトミックに設定される
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
