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
