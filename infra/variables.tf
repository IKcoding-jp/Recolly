# infra/variables.tf

variable "aws_region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "プロジェクト名（リソースの命名に使用）"
  type        = string
  default     = "recolly"
}

variable "environment" {
  description = "環境名"
  type        = string
  default     = "production"
}

variable "db_username" {
  description = "RDSのマスターユーザー名"
  type        = string
  default     = "recolly"
}

variable "db_password" {
  description = "RDSのマスターパスワード"
  type        = string
  sensitive   = true
}

variable "ssh_public_key_path" {
  description = "EC2用SSHキーのパス"
  type        = string
  default     = "~/.ssh/recolly-ec2.pub"
}

variable "allowed_ssh_cidr" {
  description = "SSH接続を許可するCIDR（自分のIPアドレス/32）"
  type        = string
}

variable "github_org" {
  description = "GitHubオーガニゼーション名（OIDC用）"
  type        = string
  default     = "IKcoding-jp"
}

variable "github_repo" {
  description = "GitHubリポジトリ名（OIDC用）"
  type        = string
  default     = "recolly"
}
