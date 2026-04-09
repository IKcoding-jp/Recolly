# infra/ses.tf

# === AWS SES: 本番メール送信基盤（ADR-0037, Issue #108） ===

# recolly.net を SES の送信元ドメインとして登録する。
# Route53 に DKIM 検証レコードを追加すると AWS が自動的に検証を完了する。
resource "aws_ses_domain_identity" "recolly_net" {
  domain = var.domain_name
}

# SES に DKIM トークンを生成させる。
# このトークンを使って Route53 に CNAME レコードを 3 つ登録する（route53.tf 参照）。
# DKIM 検証が完了すると recolly.net から送信されるメールに DKIM 署名が付く。
resource "aws_ses_domain_dkim" "recolly_net" {
  domain = aws_ses_domain_identity.recolly_net.domain
}
