# URL pública para acceder a la aplicación desde el navegador
output "app_url" {
  description = "Abre esta URL en el navegador para acceder a la aplicación"
  value       = "http://${aws_lb.this.dns_name}"
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
