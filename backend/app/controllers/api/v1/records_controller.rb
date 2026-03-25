# frozen_string_literal: true

module Api
  module V1
    class RecordsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_record, only: %i[show update destroy]
      before_action :authorize_record!, only: %i[show update destroy]

      # GET /api/v1/records
      def index
        records = apply_sort(apply_filters(current_user.records.includes(:work)))

        if pagination_requested?
          render json: paginated_response(records)
        else
          render json: { records: records.as_json(include: :work) }
        end
      end

      # GET /api/v1/records/:id
      def show
        render json: { record: @record.as_json(include: :work) }
      end

      # POST /api/v1/records
      def create
        work = find_or_create_work
        return render json: { error: 'work_id または work_data が必要です' }, status: :unprocessable_content unless work

        record = current_user.records.new(work: work, **record_create_params)

        if record.save
          render json: { record: record.as_json(include: :work) }, status: :created
        else
          render json: { errors: record.errors.full_messages }, status: :unprocessable_content
        end
      end

      # PATCH /api/v1/records/:id
      def update
        if @record.update(record_update_params)
          render json: { record: @record.as_json(include: :work) }
        else
          render json: { errors: @record.errors.full_messages }, status: :unprocessable_content
        end
      end

      # DELETE /api/v1/records/:id
      def destroy
        @record.destroy!
        head :no_content
      end

      private

      def pagination_requested?
        params[:page].present? || params[:per_page].present?
      end

      def paginated_response(records)
        page = current_page
        per_page = per_page_limit
        total_count = records.count

        {
          records: records.offset((page - 1) * per_page).limit(per_page).as_json(include: :work),
          meta: pagination_meta(page, per_page, total_count)
        }
      end

      def current_page
        [params.fetch(:page, 1).to_i, 1].max
      end

      def per_page_limit
        params.fetch(:per_page, 20).to_i.clamp(1, 100)
      end

      def pagination_meta(page, per_page, total_count)
        { current_page: page, total_pages: (total_count.to_f / per_page).ceil,
          total_count: total_count, per_page: per_page }
      end

      def set_record
        @record = Record.find(params[:id])
      end

      def authorize_record!
        return if @record.user_id == current_user.id

        render json: { error: '権限がありません' }, status: :forbidden
      end

      def record_create_params
        params.fetch(:record, {}).permit(:status, :rating)
      end

      def record_update_params
        # visibilityはフェーズ2では受け付けない（スペック参照）。フェーズ3で追加する
        params.expect(record: %i[status rating current_episode started_at completed_at review_text rewatch_count])
      end

      def apply_filters(records)
        records = filter_by_status(records)
        records = filter_by_media_type(records)
        filter_by_work_id(records)
      end

      def filter_by_status(records)
        return records if params[:status].blank?

        records.where(status: params[:status])
      end

      def filter_by_media_type(records)
        return records if params[:media_type].blank?

        records.joins(:work).where(works: { media_type: params[:media_type] })
      end

      def filter_by_work_id(records)
        return records if params[:work_id].blank?

        records.where(work_id: params[:work_id])
      end

      def apply_sort(records)
        case params[:sort]
        when 'rating'
          records.order(rating: :desc)
        when 'rating_asc'
          records.order(rating: :asc)
        when 'title'
          records.joins(:work).order('works.title DESC')
        when 'title_asc'
          records.joins(:work).order('works.title ASC')
        when 'updated_at_asc'
          records.order(updated_at: :asc)
        else
          records.order(updated_at: :desc)
        end
      end

      def find_or_create_work
        if params.dig(:record, :work_id).present?
          Work.find_by(id: params[:record][:work_id])
        elsif params.dig(:record, :work_data).present?
          find_or_create_from_external
        end
      end

      def find_or_create_from_external
        data = params.expect(record: {
                               work_data: %i[title media_type description
                                             cover_image_url total_episodes
                                             external_api_id external_api_source]
                             })[:work_data]

        if data[:external_api_id].present? && data[:external_api_source].present?
          Work.find_or_create_by!(
            external_api_id: data[:external_api_id],
            external_api_source: data[:external_api_source]
          ) do |work|
            work.assign_attributes(data.except(:external_api_id, :external_api_source))
          end
        else
          Work.create!(data)
        end
      rescue ActiveRecord::RecordNotUnique
        # 並行リクエストによるレースコンディション時は既存レコードを返す
        Work.find_by!(external_api_id: data[:external_api_id], external_api_source: data[:external_api_source])
      rescue ActiveRecord::RecordInvalid
        nil
      end
    end
  end
end
