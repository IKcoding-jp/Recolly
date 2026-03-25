# frozen_string_literal: true

module Api
  module V1
    class TagsController < ApplicationController
      before_action :authenticate_user!

      # GET /api/v1/tags
      def index
        tags = current_user.tags.order(:name)
        render json: { tags: tags }
      end

      # DELETE /api/v1/tags/:id
      def destroy
        tag = current_user.tags.find_by(id: params[:id])
        if tag.nil?
          render json: { error: '権限がありません' }, status: :forbidden
          return
        end
        tag.destroy!
        head :no_content
      end
    end
  end
end
