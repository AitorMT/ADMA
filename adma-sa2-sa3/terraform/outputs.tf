# URL pública para acceder a la aplicación desde el navegador
output "app_url" {
  description = "URL pública principal HTTPS de la aplicación"
  value       = local.public_base_url
}

output "app_url_www" {
  description = "URL HTTPS alternativa con subdominio www"
  value       = "https://www.${var.domain_name}"
}

# DNS del ALB (útil para scripts o CI/CD)
output "alb_dns" {
  description = "DNS del Application Load Balancer"
  value       = aws_lb.this.dns_name
}

# Security group ID (útil para scripts o CI/CD)
output "security_group_id" {
  description = "ID del Security Group asociado a la base de datos (útil para scripts o CI/CD)"
  value       = aws_security_group.db_sg.id
}

output "route53_zone_id" {
  description = "Hosted Zone ID de Route53 usada por el despliegue"
  value       = local.route53_zone_id
}

output "route53_name_servers" {
  description = "Name servers de la zona Route53 (útiles si el registrador DNS es externo)"
  value = (
    var.hosted_zone_id == null
    ? aws_route53_zone.public[0].name_servers
    : data.aws_route53_zone.public_existing[0].name_servers
  )
}

output "acm_certificate_arn" {
  description = "ARN del certificado ACM validado para HTTPS"
  value       = aws_acm_certificate_validation.site.certificate_arn
}
