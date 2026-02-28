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

# Endpoint de la base de datos (para depuración, nunca exponer públicamente)
output "db_endpoint" {
  description = "Endpoint privado de RDS (solo accesible desde la VPC)"
  value       = aws_db_instance.this.address
  sensitive   = true
}
