# frozen_string_literal: true

# S3の署名付きURL（一時的な合鍵）を発行するサービス
# PUT: フロントエンドからS3に直接アップロードするために使用（有効期限5分）
# GET: プライベートバケットの画像を閲覧するために使用（有効期限15分）
class S3PresignService
  UPLOAD_EXPIRATION = 300  # 5分
  VIEW_EXPIRATION = 900    # 15分

  def self.presign_put(s3_key, content_type)
    presigner.presigned_url(
      :put_object,
      bucket: bucket_name,
      key: s3_key,
      content_type: content_type,
      expires_in: UPLOAD_EXPIRATION
    )
  end

  def self.presign_get(s3_key)
    presigner.presigned_url(
      :get_object,
      bucket: bucket_name,
      key: s3_key,
      expires_in: VIEW_EXPIRATION
    )
  end

  def self.presigner
    Aws::S3::Presigner.new(client: Aws::S3::Client.new)
  end

  def self.bucket_name
    ENV.fetch('S3_BUCKET_NAME')
  end
end
