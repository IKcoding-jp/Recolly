# frozen_string_literal: true

# AWS SDK共通設定
# 署名付きURL発行とS3操作で使用する
#
# 認証方式:
#   開発環境 → .envのアクセスキー（AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY）
#   本番環境 → EC2のIAMロール（SDKが自動検出するため、credentials指定不要）
aws_config = { region: ENV.fetch("AWS_REGION", "ap-northeast-1") }

if ENV["AWS_ACCESS_KEY_ID"].present?
  aws_config[:credentials] = Aws::Credentials.new(
    ENV.fetch("AWS_ACCESS_KEY_ID"),
    ENV.fetch("AWS_SECRET_ACCESS_KEY")
  )
end

Aws.config.update(aws_config)
