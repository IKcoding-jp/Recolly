# frozen_string_literal: true

module Api
  module V1
    class RecordsController < ApplicationController
      before_action :authenticate_user!

      # POST /api/v1/records
      def create
        work = find_or_create_work
        return render json: { error: 'work_id または work_data が必要です' }, status: :unprocessable_content unless work

        record = current_user.records.new(work: work)

        if record.save
          render json: { record: record.as_json(include: :work) }, status: :created
        else
          render json: { errors: record.errors.full_messages }, status: :unprocessable_content
        end
      end

      private

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
