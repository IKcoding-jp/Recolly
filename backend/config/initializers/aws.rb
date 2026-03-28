# frozen_string_literal: true

# AWS SDK共通設定
# 署名付きURL発行とS3操作で使用する
Aws.config.update(
  region: ENV.fetch("AWS_REGION", "ap-northeast-1"),
  credentials: Aws::Credentials.new(
    ENV.fetch("AWS_ACCESS_KEY_ID", ""),
    ENV.fetch("AWS_SECRET_ACCESS_KEY", "")
  )
)
