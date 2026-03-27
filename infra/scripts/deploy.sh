#!/bin/bash
# infra/scripts/deploy.sh
# EC2上で実行されるデプロイスクリプト
# GitHub Actionsから SSH 経由で呼び出される

set -euo pipefail

AWS_REGION="ap-northeast-1"
ECR_REGISTRY="$1"
IMAGE_TAG="$2"
APP_NAME="recolly"
CONTAINER_NAME="${APP_NAME}-api"
ENV_PREFIX="/${APP_NAME}/production"

echo "=== デプロイ開始: ${IMAGE_TAG} ==="

# ECRにログイン
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$ECR_REGISTRY"

# 新しいイメージをpull
docker pull "${ECR_REGISTRY}/${APP_NAME}-backend:${IMAGE_TAG}"

# SSM Parameter Storeから環境変数を取得
get_param() {
  aws ssm get-parameter \
    --name "${ENV_PREFIX}/$1" \
    --with-decryption \
    --query "Parameter.Value" \
    --output text \
    --region "$AWS_REGION"
}

DATABASE_URL=$(get_param "DATABASE_URL")
SECRET_KEY_BASE=$(get_param "SECRET_KEY_BASE")
RAILS_MASTER_KEY=$(get_param "RAILS_MASTER_KEY")
RAILS_ENV=$(get_param "RAILS_ENV")
TMDB_API_KEY=$(get_param "TMDB_API_KEY")
GOOGLE_BOOKS_API_KEY=$(get_param "GOOGLE_BOOKS_API_KEY")
IGDB_CLIENT_ID=$(get_param "IGDB_CLIENT_ID")
IGDB_CLIENT_SECRET=$(get_param "IGDB_CLIENT_SECRET")
GOOGLE_CLIENT_ID=$(get_param "GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET=$(get_param "GOOGLE_CLIENT_SECRET")
FRONTEND_URL=$(get_param "FRONTEND_URL")
# SSMパラメータ未作成でもデプロイを止めない（puma.rbが未設定時はSolid Queueを起動しない）
SOLID_QUEUE_IN_PUMA=$(get_param "SOLID_QUEUE_IN_PUMA" 2>/dev/null || echo "")

# DB準備（マイグレーション + 未作成DBのスキーマ適用）
# db:prepare = db:migrate + db:schema:load（Solid Cache等のスキーマ対応）
echo "=== DB準備 ==="
docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  -e SECRET_KEY_BASE="$SECRET_KEY_BASE" \
  -e RAILS_MASTER_KEY="$RAILS_MASTER_KEY" \
  -e RAILS_ENV="$RAILS_ENV" \
  "${ECR_REGISTRY}/${APP_NAME}-backend:${IMAGE_TAG}" \
  bin/rails db:prepare

# 既存コンテナを停止・削除
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# 新しいコンテナを起動
echo "=== コンテナ起動 ==="
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p 80:3000 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e SECRET_KEY_BASE="$SECRET_KEY_BASE" \
  -e RAILS_MASTER_KEY="$RAILS_MASTER_KEY" \
  -e RAILS_ENV="$RAILS_ENV" \
  -e TMDB_API_KEY="$TMDB_API_KEY" \
  -e GOOGLE_BOOKS_API_KEY="$GOOGLE_BOOKS_API_KEY" \
  -e IGDB_CLIENT_ID="$IGDB_CLIENT_ID" \
  -e IGDB_CLIENT_SECRET="$IGDB_CLIENT_SECRET" \
  -e GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  -e GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
  -e FRONTEND_URL="$FRONTEND_URL" \
  -e SOLID_QUEUE_IN_PUMA="$SOLID_QUEUE_IN_PUMA" \
  -e RAILS_LOG_TO_STDOUT=1 \
  "${ECR_REGISTRY}/${APP_NAME}-backend:${IMAGE_TAG}"

# ヘルスチェック
echo "=== ヘルスチェック ==="
for i in $(seq 1 30); do
  if curl -sf http://localhost/api/v1/health > /dev/null 2>&1; then
    echo "デプロイ完了（ヘルスチェックOK）"
    exit 0
  fi
  sleep 2
done

echo "ヘルスチェック失敗"
exit 1
