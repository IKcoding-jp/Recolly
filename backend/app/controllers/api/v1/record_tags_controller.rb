# frozen_string_literal: true

module Api
  module V1
    class RecordTagsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_record
      before_action :authorize_record!

      # POST /api/v1/records/:record_id/tags
      def create
        tag = find_or_create_tag
        return if performed?

        record_tag = @record.record_tags.build(tag: tag)
        if record_tag.save
          render json: { tag: tag }, status: :created
        else
          render json: { errors: record_tag.errors.full_messages }, status: :unprocessable_content
        end
      end

      # DELETE /api/v1/records/:record_id/tags/:id
      def destroy
        record_tag = @record.record_tags.find_by!(tag_id: params[:id])
        record_tag.destroy!
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

      def find_or_create_tag
        tag = current_user.tags.find_or_initialize_by(name: tag_params[:name])
        return tag if tag.persisted?

        tag.save || render(json: { errors: tag.errors.full_messages }, status: :unprocessable_content)
        tag
      end

      def tag_params
        params.expect(tag: %i[name])
      end
    end
  end
end
