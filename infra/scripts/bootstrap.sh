#!/bin/bash
# infra/scripts/bootstrap.sh
# tfstate保管用のS3バケットを作成するブートストラップスクリプト
# このバケットはTerraform管理外（1回だけ手動実行）

set -euo pipefail

AWS_REGION="ap-northeast-1"
BUCKET_NAME="recolly-terraform-state"

echo "tfstate用S3バケットを作成中..."
aws s3api create-bucket \
  --bucket "$BUCKET_NAME" \
  --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"

# バージョニング有効化（tfstateの履歴を保持）
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled

# パブリックアクセスをブロック
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "完了: s3://$BUCKET_NAME"
