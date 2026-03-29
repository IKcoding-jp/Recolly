# frozen_string_literal: true

module Api
  module V1
    class RecordsController < ApplicationController
      include RecordFilterable

      before_action :authenticate_user!
      before_action :set_record, only: %i[show update destroy]
      before_action :authorize_record!, only: %i[show update destroy]

      # GET /api/v1/records
      def index
        records = apply_sort(apply_filters(current_user.records.includes(work: :images, tags: [])))

        if pagination_requested?
          render json: paginated_response(records)
        else
          render json: { records: records_json(records) }
        end
      end

      # GET /api/v1/records/:id
      def show
        render json: { record: record_json(@record) }
      end

      # POST /api/v1/records
      def create
        work = find_or_create_work
        return render json: { error: 'work_id または work_data が必要です' }, status: :unprocessable_content unless work

        record = current_user.records.new(work: work, **record_create_params)

        if record.save
          render json: { record: record_json(record) }, status: :created
        else
          render json: { errors: record.errors.full_messages }, status: :unprocessable_content
        end
      end

      # PATCH /api/v1/records/:id
      def update
        if @record.update(record_update_params)
          render json: { record: record_json(@record) }
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
          records: records_json(records.offset((page - 1) * per_page).limit(per_page)),
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
        @record = Record.includes(work: :images, tags: []).find(params[:id])
      end

      def authorize_record!
        return if @record.user_id == current_user.id

        render json: { error: '権限がありません' }, status: :forbidden
      end

      # Recordのレスポンス用JSON（Workのas_jsonオーバーライドを確実に適用する）
      def record_json(record)
        record.as_json(include: :tags).merge('work' => record.work.as_json)
      end

      def records_json(records)
        records.map { |r| record_json(r) }
      end

      def record_create_params
        params.fetch(:record, {}).permit(:status, :rating)
      end

      def record_update_params
        # visibilityはフェーズ2では受け付けない（スペック参照）。フェーズ3で追加する
        params.expect(record: %i[status rating current_episode started_at completed_at review_text rewatch_count])
      end

      def find_or_create_work
        if params.dig(:record, :work_id).present?
          Work.find_by(id: params[:record][:work_id])
        elsif params.dig(:record, :work_data).present?
          find_or_create_from_external
        end
      end

      def find_or_create_from_external
        data = work_data_params
        return Work.create!(data) unless external_api_present?(data)

        find_or_create_external_work(data)
      rescue ActiveRecord::RecordNotUnique
        # 並行リクエストによるレースコンディション時は既存レコードを返す
        Work.find_by!(external_api_id: data[:external_api_id], external_api_source: data[:external_api_source])
      rescue ActiveRecord::RecordInvalid
        nil
      end

      def work_data_params
        params.expect(record: {
                        work_data: %i[title media_type description
                                      cover_image_url total_episodes
                                      external_api_id external_api_source]
                      })[:work_data]
      end

      # metadata はネストされたハッシュのため、params.expect の配列指定では取得できない
      # 受け入れるキーを明示的に列挙し、Mass Assignment を防止する
      def work_metadata
        meta = params.dig(:record, :work_data, :metadata)
        return nil unless meta.respond_to?(:permit)

        meta.permit(:status, :season_year, :popularity, :title_english, :title_romaji, genres: []).to_h
      end

      def external_api_present?(data)
        data[:external_api_id].present? && data[:external_api_source].present?
      end

      def find_or_create_external_work(data)
        metadata = work_metadata
        Work.find_or_create_by!(
          external_api_id: data[:external_api_id],
          external_api_source: data[:external_api_source]
        ) do |work|
          work.assign_attributes(data.except(:external_api_id, :external_api_source))
          work.metadata = metadata if metadata.present?
        end
      end
    end
  end
end
