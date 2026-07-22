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
        return unless authorize_imageable!

        image = Image.new(image_params)
        # 投稿者を本人に固定する（paramsからは受け取らずなりすましを防ぐ、診断M-3）
        image.user = current_user

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
      def destroy
        image = Image.find(params.expect(:id))
        return unless authorize_image!(image)

        s3_key = image.s3_key
        image.destroy!
        S3DeleteService.call(s3_key)
        head :no_content
      end

      private

      # create用の認可（診断M-3）。許可するのは以下のいずれか:
      #   1. その作品を記録済みのユーザー（記録者は表紙画像を提供できる）
      #   2. まだ誰も記録・画像を持たない新規作品（＝手動登録直後の最初の1枚）
      # これにより「未記録ユーザーが人気作品の表紙を上書きする」経路を塞ぐ。
      def authorize_imageable! # rubocop:disable Naming/PredicateMethod
        imageable_type = image_params[:imageable_type]

        unless Image::ALLOWED_IMAGEABLE_TYPES.include?(imageable_type)
          render json: { error: '無効なリソースタイプです' }, status: :unprocessable_content
          return false
        end

        work = Work.find_by(id: image_params[:imageable_id])
        if work.nil?
          render json: { error: '指定されたリソースが見つかりません' }, status: :not_found
          return false
        end

        return true if allowed_to_attach_image?(work)

        render json: { error: '権限がありません' }, status: :forbidden
        false
      end

      def allowed_to_attach_image?(work)
        return true if current_user.records.exists?(work_id: work.id)

        work.records.none? && work.images.none?
      end

      # destroy用の認可（診断M-3）: 投稿者本人のみ削除可。
      # 旧データ（投稿者不明）は後方互換として従来ルール（作品の記録所有者）を維持する。
      def authorize_image!(image) # rubocop:disable Naming/PredicateMethod
        return true if image.user_id == current_user.id
        return true if image.user_id.nil? && legacy_deletable?(image)

        render json: { error: '権限がありません' }, status: :forbidden
        false
      end

      def legacy_deletable?(image)
        image.imageable_type == 'Work' &&
          current_user.records.exists?(work_id: image.imageable_id)
      end

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
