output "alb_dns_name" {
  description = "Public DNS name of the frontend ALB."
  value       = module.ecs.alb_dns_name
}

output "frontend_ecr_repository_url" {
  description = "Frontend ECR repository URL."
  value       = local.frontend_ecr_repository_url
}

output "backend_ecr_repository_url" {
  description = "Backend ECR repository URL."
  value       = local.backend_ecr_repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.ecs.cluster_name
}

output "frontend_service_name" {
  description = "ECS frontend service name."
  value       = module.ecs.frontend_service_name
}

output "backend_service_name" {
  description = "ECS backend service name."
  value       = module.ecs.backend_service_name
}

output "backend_service_discovery_fqdn" {
  description = "Internal DNS name used by frontend to reach backend."
  value       = module.ecs.backend_service_discovery_fqdn
}

output "db_endpoint" {
  description = "RDS endpoint hostname."
  value       = module.rds.db_endpoint
}

output "db_name" {
  description = "Application database name."
  value       = module.rds.db_name
}

output "db_master_secret_arn" {
  description = "Secrets Manager ARN holding the DB master credentials."
  value       = module.rds.master_user_secret_arn
}

output "jwt_secret_arn" {
  description = "Secrets Manager ARN storing the backend JWT secret."
  value       = aws_secretsmanager_secret.jwt.arn
}
