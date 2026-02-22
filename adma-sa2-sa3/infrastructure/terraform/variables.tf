variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
}

variable "project_name" {
  description = "Project/application short name used in resource naming."
  type        = string
  default     = "adma"
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)."
  type        = string
  default     = "prod"
}

variable "tags" {
  description = "Extra tags to apply to all resources."
  type        = map(string)
  default     = {}
}

variable "vpc_cidr" {
  description = "CIDR block for the dedicated VPC."
  type        = string
  default     = "10.42.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs (ALB only)."
  type        = list(string)
  default     = ["10.42.0.0/24", "10.42.1.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) >= 2
    error_message = "At least two public subnets are required."
  }
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDRs (ECS services, RDS, endpoints)."
  type        = list(string)
  default     = ["10.42.10.0/24", "10.42.11.0/24"]

  validation {
    condition     = length(var.private_subnet_cidrs) >= 2
    error_message = "At least two private subnets are required."
  }
}

variable "alb_ingress_cidrs" {
  description = "CIDRs allowed to reach the public ALB."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "enable_https" {
  description = "If true, create an HTTPS listener on the public ALB."
  type        = bool
  default     = false
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS listener. Required when enable_https=true."
  type        = string
  default     = null
}

variable "frontend_container_port" {
  description = "Frontend container port."
  type        = number
  default     = 80
}

variable "backend_container_port" {
  description = "Backend container port."
  type        = number
  default     = 8080
}

variable "frontend_task_cpu" {
  description = "Frontend Fargate task CPU units."
  type        = number
  default     = 256
}

variable "frontend_task_memory" {
  description = "Frontend Fargate task memory (MiB)."
  type        = number
  default     = 512
}

variable "backend_task_cpu" {
  description = "Backend Fargate task CPU units."
  type        = number
  default     = 512
}

variable "backend_task_memory" {
  description = "Backend Fargate task memory (MiB)."
  type        = number
  default     = 1024
}

variable "frontend_desired_count" {
  description = "Initial desired task count for frontend service."
  type        = number
  default     = 1
}

variable "backend_desired_count" {
  description = "Initial desired task count for backend service."
  type        = number
  default     = 1
}

variable "frontend_min_capacity" {
  description = "Minimum number of frontend tasks for autoscaling."
  type        = number
  default     = 1
}

variable "frontend_max_capacity" {
  description = "Maximum number of frontend tasks for autoscaling."
  type        = number
  default     = 4
}

variable "backend_min_capacity" {
  description = "Minimum number of backend tasks for autoscaling."
  type        = number
  default     = 1
}

variable "backend_max_capacity" {
  description = "Maximum number of backend tasks for autoscaling."
  type        = number
  default     = 4
}

variable "frontend_target_cpu_utilization" {
  description = "Target average CPU utilization (%) for frontend autoscaling."
  type        = number
  default     = 60
}

variable "frontend_target_memory_utilization" {
  description = "Target average memory utilization (%) for frontend autoscaling."
  type        = number
  default     = 75
}

variable "backend_target_cpu_utilization" {
  description = "Target average CPU utilization (%) for backend autoscaling."
  type        = number
  default     = 60
}

variable "backend_target_memory_utilization" {
  description = "Target average memory utilization (%) for backend autoscaling."
  type        = number
  default     = 75
}

variable "frontend_image_tag" {
  description = "Container image tag to deploy for frontend."
  type        = string
  default     = "latest"
}

variable "backend_image_tag" {
  description = "Container image tag to deploy for backend."
  type        = string
  default     = "latest"
}

variable "create_ecr_repositories" {
  description = "Whether to create ECR repositories for frontend/backend images."
  type        = bool
  default     = true
}

variable "existing_frontend_ecr_repository_url" {
  description = "Existing frontend ECR repository URL, used when create_ecr_repositories=false."
  type        = string
  default     = null
}

variable "existing_backend_ecr_repository_url" {
  description = "Existing backend ECR repository URL, used when create_ecr_repositories=false."
  type        = string
  default     = null
}

variable "ecr_force_delete" {
  description = "Allow deleting ECR repositories even if images exist."
  type        = bool
  default     = false
}

variable "ecs_log_retention_days" {
  description = "CloudWatch Logs retention (days) for ECS task logs."
  type        = number
  default     = 14
}

variable "enable_ecs_exec" {
  description = "Enable ECS execute-command for services."
  type        = bool
  default     = false
}

variable "enable_container_insights" {
  description = "Enable ECS container insights on the cluster."
  type        = bool
  default     = false
}

variable "private_dns_namespace_name" {
  description = "Private DNS namespace for ECS service discovery."
  type        = string
  default     = "adma.internal"
}

variable "backend_service_discovery_name" {
  description = "Service discovery DNS label for backend service."
  type        = string
  default     = "backend"
}

variable "backend_health_check_path" {
  description = "Backend HTTP path used by ECS container health checks."
  type        = string
  default     = "/api/stats"
}

variable "jwt_expiration_ms" {
  description = "JWT expiration in milliseconds for backend runtime config."
  type        = number
  default     = 86400000
}

variable "db_name" {
  description = "RDS database name."
  type        = string
  default     = "urlshortener"
}

variable "db_username" {
  description = "RDS master username (password is auto-managed by Secrets Manager)."
  type        = string
  default     = "appuser"
}

variable "db_port" {
  description = "Database port."
  type        = number
  default     = 5432
}

variable "db_engine_version" {
  description = "PostgreSQL engine version."
  type        = string
  default     = "16.4"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage in GiB."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Storage autoscaling max in GiB."
  type        = number
  default     = 100
}

variable "db_backup_retention_days" {
  description = "Number of days to retain automated backups."
  type        = number
  default     = 7
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for RDS instance."
  type        = bool
  default     = false
}

variable "db_deletion_protection" {
  description = "Enable deletion protection for RDS instance."
  type        = bool
  default     = true
}

variable "db_skip_final_snapshot" {
  description = "Skip final snapshot on DB destroy. Set false for production safety."
  type        = bool
  default     = false
}

variable "db_apply_immediately" {
  description = "Apply database modifications immediately (may cause restarts)."
  type        = bool
  default     = false
}

variable "frontend_public_url" {
  description = "Public URL of the frontend (e.g., https://go.example.com). If null, ALB DNS is used."
  type        = string
  default     = null
}

variable "app_base_url" {
  description = "Base URL used by backend to generate short URLs. If null, frontend_public_url/ALB DNS is used."
  type        = string
  default     = null
}

variable "cors_allowed_origins" {
  description = "CORS origins allowed by backend. If empty, frontend_public_url/ALB DNS is used."
  type        = list(string)
  default     = []
}
