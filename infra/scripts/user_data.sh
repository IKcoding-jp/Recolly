#!/bin/bash
# infra/scripts/user_data.sh
# EC2起動時に自動実行されるスクリプト

set -euo pipefail

# Docker インストール
yum update -y
yum install -y docker
systemctl start docker
systemctl enable docker

# ec2-userにDockerグループを追加
usermod -aG docker ec2-user

# AWS CLI v2（Amazon Linux 2023にはプリインストール済み）
# ECRログインヘルパーの準備のみ

# swapメモリの設定（2GB）
# t2.micro（RAM 1GB）のメモリ不足を補うため。
# デプロイ時のdocker pull + db:prepare + 旧コンテナ同時実行でメモリが不足する問題の対策。
dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile swap swap defaults 0 0' >> /etc/fstab

# deploy.shの配置
# CD（cd.yml）はSSM経由で/home/ec2-user/deploy.shを実行する前提のため、
# インスタンス再作成時にも自己完結でデプロイできるようS3から取得しておく。
aws s3 cp s3://recolly-images-ap-northeast-1/deploy/deploy.sh /home/ec2-user/deploy.sh
chmod +x /home/ec2-user/deploy.sh
chown ec2-user:ec2-user /home/ec2-user/deploy.sh
