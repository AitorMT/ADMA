locals {
  route53_zone_id = var.hosted_zone_id != null ? var.hosted_zone_id : aws_route53_zone.public[0].zone_id
}

resource "aws_route53_zone" "public" {
  count = var.hosted_zone_id == null ? 1 : 0
  name  = var.domain_name

  tags = {
    Name = "${var.project}-public-zone"
  }
}

data "aws_route53_zone" "public_existing" {
  count   = var.hosted_zone_id != null ? 1 : 0
  zone_id = var.hosted_zone_id
}

resource "aws_acm_certificate" "site" {
  domain_name               = var.domain_name
  subject_alternative_names = local.cert_sans
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project}-acm-cert"
  }
}

resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.site.domain_validation_options :
    dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  zone_id         = local.route53_zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
}

resource "aws_acm_certificate_validation" "site" {
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for record in aws_route53_record.acm_validation : record.fqdn]
}

resource "aws_route53_record" "apex_alias" {
  zone_id = local.route53_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "www_alias" {
  zone_id = local.route53_zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}
