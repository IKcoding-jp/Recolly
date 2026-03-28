# frozen_string_literal: true

module Api
  module V1
    class ImagesController < ApplicationController
      before_action :authenticate_user!

      ALLOWED_CONTENT_TYPES = %w[image/jpeg image/png image/gif image/webp].freeze
      MAX_FILE_SIZE = 10.megabytes

      # POST /api/v1/images/presign
      # フロントエンドがS3に直接アップロードするための署名付きURLを発行する
      def presign
        content_type = presign_params[:content_type]
        file_size = presign_params[:file_size].to_i
        file_name = presign_params[:file_name]

        unless ALLOWED_CONTENT_TYPES.include?(content_type)
          return render json: { error: '対応していないファイル形式です' }, status: :unprocessable_content
        end

        if file_size > MAX_FILE_SIZE
          return render json: { error: 'ファイルサイズが10MBを超えています' }, status: :unprocessable_content
        end

        extension = File.extname(file_name).delete('.')
        s3_key = "uploads/images/#{SecureRandom.uuid}.#{extension}"
        presigned_url = S3PresignService.presign_put(s3_key, content_type)

        render json: { presigned_url: presigned_url, s3_key: s3_key }
      end

      # POST /api/v1/images
      # S3アップロード完了後、画像メタデータをDBに登録する
      def create
        image = Image.new(image_params)

        if image.save
          render json: { image: image_json(image) }, status: :created
        else
          # バリデーション失敗時、既にS3にアップロード済みのファイルを削除（ロールバック）
          # セキュリティ: 他ユーザーの画像を削除されないよう、DB未登録のキーのみ削除する
          cleanup_orphaned_s3_file(image_params[:s3_key])
          render json: { errors: image.errors.full_messages }, status: :unprocessable_content
        end
      end

      # DELETE /api/v1/images/:id
      # DBレコードとS3ファイルの両方を削除する
      # TODO: Workは共有リソースのため現時点では所有者チェックなし。
      #       User等のユーザー固有imageableが追加された際に、所有者認可チェックを実装すること。
      def destroy
        image = Image.find(params[:id])
        s3_key = image.s3_key
        image.destroy!
        S3DeleteService.call(s3_key)
        head :no_content
      end

      private

      def presign_params
        params.expect(image: %i[file_name content_type file_size])
      end

      def image_params
        params.expect(image: %i[s3_key file_name content_type file_size imageable_type imageable_id])
      end

      # S3ロールバック: presignで発行したキー形式のみ許可し、DB未登録のキーのみ削除する
      def cleanup_orphaned_s3_file(s3_key)
        return if s3_key.blank?
        return unless s3_key.match?(%r{\Auploads/images/[0-9a-f-]+\.\w+\z})
        return if Image.exists?(s3_key: s3_key)

        S3DeleteService.call(s3_key)
      end

      def image_json(image)
        fields = %i[id s3_key file_name content_type file_size imageable_type imageable_id created_at]
        image.as_json(only: fields).merge(
          'url' => S3PresignService.presign_get(image.s3_key)
        )
      end
    end
  end
end
