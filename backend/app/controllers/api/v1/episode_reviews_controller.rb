# frozen_string_literal: true

module Api
  module V1
    class EpisodeReviewsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_record
      before_action :authorize_record!
      before_action :set_episode_review, only: %i[update destroy]

      def index
        reviews = @record.episode_reviews.order(episode_number: :asc)
        render json: { episode_reviews: reviews }
      end

      def create
        review = @record.episode_reviews.build(episode_review_params)

        if review.save
          render json: { episode_review: review }, status: :created
        else
          render json: { errors: review.errors.full_messages }, status: :unprocessable_content
        end
      end

      def update
        if @episode_review.update(episode_review_update_params)
          render json: { episode_review: @episode_review }
        else
          render json: { errors: @episode_review.errors.full_messages }, status: :unprocessable_content
        end
      end

      def destroy
        @episode_review.destroy!
        head :no_content
      end

      private

      def set_record
        @record = Record.find(params[:record_id])
      end

      def authorize_record!
        return if @record.user_id == current_user.id

        render json: { error: '権限がありません' }, status: :forbidden
      end

      def set_episode_review
        @episode_review = @record.episode_reviews.find(params[:id])
      end

      def episode_review_params
        params.expect(episode_review: %i[episode_number body])
      end

      def episode_review_update_params
        params.expect(episode_review: %i[body])
      end
    end
  end
end
