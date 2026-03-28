# frozen_string_literal: true

# S3からファイルを削除するサービス
# 画像削除時と、メタデータ登録失敗時のロールバックで使用
class S3DeleteService
  def self.call(s3_key)
    Aws::S3::Client.new.delete_object(
      bucket: ENV.fetch('S3_BUCKET_NAME'),
      key: s3_key
    )
  end
end
