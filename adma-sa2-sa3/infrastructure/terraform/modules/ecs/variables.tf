variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "alb_sg_id" {
  type = string
}

variable "frontend_sg_id" {
  type = string
}

variable "backend_sg_id" {
  type = string
}

variable "execution_role_arn" {
  type = string
}

variable "task_role_arn" {
  type = string
}

variable "frontend_repository_url" {
  type = string
}

variable "backend_repository_url" {
  type = string
}

variable "frontend_image_tag" {
  type = string
}

variable "backend_image_tag" {
  type = string
}

variable "frontend_container_port" {
  type = number
}

variable "backend_container_port" {
  type = number
}

variable "frontend_task_cpu" {
  type = number
}

variable "frontend_task_memory" {
  type = number
}

variable "backend_task_cpu" {
  type = number
}

variable "backend_task_memory" {
  type = number
}

variable "frontend_desired_count" {
  type = number
}

variable "backend_desired_count" {
  type = number
}

variable "frontend_min_capacity" {
  type = number
}

variable "frontend_max_capacity" {
  type = number
}

variable "backend_min_capacity" {
  type = number
}

variable "backend_max_capacity" {
  type = number
}

variable "frontend_target_cpu_utilization" {
  type = number
}

variable "frontend_target_memory_utilization" {
  type = number
}

variable "backend_target_cpu_utilization" {
  type = number
}

variable "backend_target_memory_utilization" {
  type = number
}

variable "ecs_log_retention_days" {
  type = number
}

variable "enable_ecs_exec" {
  type = bool
}

variable "enable_container_insights" {
  type = bool
}

variable "enable_https" {
  type = bool
}

variable "acm_certificate_arn" {
  type    = string
  default = null
}

variable "backend_health_check_path" {
  type = string
}

variable "backend_service_discovery_name" {
  type = string
}

variable "private_dns_namespace_name" {
  type = string
}

variable "jwt_expiration_ms" {
  type = number
}

variable "db_endpoint" {
  type = string
}

variable "db_port" {
  type = number
}

variable "db_name" {
  type = string
}

variable "db_username" {
  type = string
}

variable "db_password_secret_arn" {
  type = string
}

variable "jwt_secret_arn" {
  type = string
}

variable "app_base_url" {
  type    = string
  default = null
}

variable "frontend_public_url" {
  type    = string
  default = null
}

variable "cors_allowed_origins" {
  type    = list(string)
  default = []
}

variable "tags" {
  type    = map(string)
  default = {}
}
