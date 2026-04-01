# frozen_string_literal: true

module Api
  module V1
    class FavoriteWorksController < ApplicationController
      # GET /api/v1/users/:user_id/favorite_works（認証不要）
      def index
        user = User.find(params[:user_id])
        favorite_works = user.favorite_works.includes(:work).order(:position)

        render json: {
          favorite_works: favorite_works.map { |fw| favorite_work_json(fw) },
          display_mode: user.favorite_display_mode
        }
      end
    end
  end
end
