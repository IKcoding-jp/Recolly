# frozen_string_literal: true

module Api
  module V1
    class WorksController < ApplicationController
      before_action :authenticate_user!

      # GET /api/v1/works/search?q=キーワード&media_type=anime
      def search
        query = params[:q]
        return render json: { error: '検索キーワードを入力してください' }, status: :unprocessable_content if query.blank?

        results = WorkSearchService.new.search(query, media_type: params[:media_type])
        render json: { results: results.map(&:to_h) }
      end

      # POST /api/v1/works（手動登録）
      def create
        work = Work.new(work_params)

        if work.save
          render json: { work: work.as_json }, status: :created
        else
          render json: { errors: work.errors.full_messages }, status: :unprocessable_content
        end
      end

      # POST /api/v1/works/:id/sync
      # AniListからデータを再取得して更新する
      def sync
        work = Work.find(params[:id])
        sync_service = AniListSyncService.new

        sync_service.sync_work(work) if sync_service.needs_sync?(work)

        render json: { work: work.reload.as_json }
      end

      private

      def work_params
        params.expect(work: %i[title media_type description cover_image_url total_episodes])
      end
    end
  end
end
