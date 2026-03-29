# infra/rds.tf

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t3.micro"

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"

  db_name  = "recolly_production"
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # シングルAZ（無料枠対応）
  multi_az            = false
  publicly_accessible = false

  # ストレージ暗号化（追加コストなし）
  storage_encrypted = true

  # バックアップ設定
  backup_retention_period = 7
  backup_window           = "03:00-04:00"

  # メンテナンスウィンドウ
  maintenance_window = "sun:04:00-sun:05:00"

  # 削除保護（誤削除防止）
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project_name}-db-final-snapshot"

  # パフォーマンスインサイト（無料枠内）
  performance_insights_enabled = true

  # terraform apply時にパスワードが意図せず変更されるのを防ぐ
  lifecycle { ignore_changes = [password] }

  tags = { Name = "${var.project_name}-db" }
}
