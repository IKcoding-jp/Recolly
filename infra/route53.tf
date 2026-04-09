# infra/route53.tf

# メインドメイン → CloudFront
resource "aws_route53_record" "main" {
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

# www → メインドメイン（CNAMEで向けてCloudFront Functionsでリダイレクト）
resource "aws_route53_record" "www" {
  zone_id = var.route53_zone_id
  name    = "www.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.domain_name]
}

# === SES DKIM 検証レコード（ADR-0037, Issue #108） ===

# SES が生成した 3 つの DKIM トークンを CNAME で Route53 に登録する。
# これにより AWS SES が受信側メールサーバー（Gmail 等）から DKIM 署名検証を
# 受けられるようになる。登録から数分で AWS が自動的に検証完了する。
resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.recolly_net.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.recolly_net.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# === SPF レコード ===

# recolly.net から SES 経由でメール送信することを DNS で宣言する。
# 受信側メールサーバーはこのレコードを見て「送信元が正規のサーバーか」を判定する。
# 既存の TXT レコードと衝突する場合は手動でマージする必要がある（運用手順書参照）。
resource "aws_route53_record" "ses_spf" {
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# === DMARC レコード（初期: p=none モニタリングのみ） ===

# SPF / DKIM 検証に失敗したメールをどう扱うかを宣言する。
# p=none = モニタリングのみ（失敗しても受信拒否しない、設定ミスの影響を最小化）
# 運用が安定したら p=quarantine → p=reject に段階的に強化する。
# rua はレポート受信用エイリアス（実装は別 Issue）。
resource "aws_route53_record" "ses_dmarc" {
  zone_id = var.route53_zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=none; rua=mailto:dmarc-reports@${var.domain_name}"]
}
