# frozen_string_literal: true

module Api
  module V1
    class SessionsController < Devise::SessionsController
      respond_to :json

      # POST /api/v1/login
      def create
        self.resource = warden.authenticate!(auth_options)
        sign_in(resource_name, resource)
        render json: { user: user_json(resource) }, status: :ok
      end

      # DELETE /api/v1/logout
      def destroy
        if current_user
          sign_out(current_user)
          render json: { message: 'ログアウトしました' }, status: :ok
        else
          render json: { error: 'ログインが必要です' }, status: :unauthorized
        end
      end
    end
  end
end
