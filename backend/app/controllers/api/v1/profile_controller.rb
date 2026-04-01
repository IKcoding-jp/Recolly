# frozen_string_literal: true

module Api
  module V1
    class ProfileController < ApplicationController
      before_action :authenticate_user!

      ALLOWED_CONTENT_TYPES = %w[image/jpeg image/png image/gif image/webp].freeze
      MAX_FILE_SIZE = 10.megabytes

      # PATCH /api/v1/profile
      def update
        reset_avatar_url_if_blank

        if current_user.update(filtered_profile_params)
          render json: { user: user_json(current_user) }
        else
          render json: { errors: current_user.errors.full_messages }, status: :unprocessable_content
        end
      end

      # POST /api/v1/profile/presign_avatar
      def presign_avatar
        error = validate_avatar_presign
        return render json: { error: error }, status: :unprocessable_content if error

        s3_key = generate_avatar_s3_key
        presigned_url = S3PresignService.presign_put(s3_key, avatar_presign_params[:content_type])

        render json: { presigned_url: presigned_url, s3_key: s3_key }
      end

      private

      # avatar_urlが空文字で送信された場合、nilにリセットする
      def reset_avatar_url_if_blank
        current_user.avatar_url = nil if profile_params.key?(:avatar_url) && profile_params[:avatar_url].blank?
      end

      # avatar_urlが空文字の場合はupdateパラメータから除外する（nilリセットは別途処理済み）
      def filtered_profile_params
        profile_params.reject { |k, v| k == 'avatar_url' && v.blank? }
      end

      # アバター署名リクエストのバリデーション。エラーメッセージまたはnilを返す
      def validate_avatar_presign
        return '対応していないファイル形式です' unless ALLOWED_CONTENT_TYPES.include?(avatar_presign_params[:content_type])

        'ファイルサイズが10MBを超えています' if avatar_presign_params[:file_size].to_i > MAX_FILE_SIZE
      end

      # アバター用のS3キーを生成する
      def generate_avatar_s3_key
        extension = File.extname(avatar_presign_params[:file_name]).delete('.')
        "uploads/avatars/#{current_user.id}/#{SecureRandom.uuid}.#{extension}"
      end

      def profile_params
        params.expect(profile: %i[bio avatar_url favorite_display_mode])
      end

      def avatar_presign_params
        params.expect(image: %i[file_name content_type file_size])
      end
    end
  end
end
