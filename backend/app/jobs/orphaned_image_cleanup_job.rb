# frozen_string_literal: true

# S3にあるがDBに記録がない孤立ファイルを削除するジョブ
# Solid Queueで1日1回実行する
class OrphanedImageCleanupJob < ApplicationJob
  queue_as :default

  UPLOADS_PREFIX = 'uploads/images/'

  def perform
    client = Aws::S3::Client.new
    bucket = ENV.fetch('S3_BUCKET_NAME')
    db_keys = Image.pluck(:s3_key).to_set

    each_s3_object(client, bucket) do |object|
      next if db_keys.include?(object.key)

      client.delete_object(bucket: bucket, key: object.key)
      Rails.logger.info("[OrphanedImageCleanup] 孤立ファイルを削除: #{object.key}")
    end
  end

  private

  # S3のページネーションを処理しながらオブジェクトを1つずつ返す
  def each_s3_object(client, bucket, &block)
    continuation_token = nil
    loop do
      response = client.list_objects_v2(
        bucket: bucket,
        prefix: UPLOADS_PREFIX,
        continuation_token: continuation_token
      )

      response.contents.each(&block)

      break unless response.is_truncated

      continuation_token = response.next_continuation_token
    end
  end
end
