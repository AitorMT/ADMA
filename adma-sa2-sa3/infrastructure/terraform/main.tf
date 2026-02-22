resource "terraform_data" "input_validation" {
  lifecycle {
    precondition {
      condition     = !var.enable_https || var.acm_certificate_arn != null
      error_message = "acm_certificate_arn is required when enable_https is true."
    }

    precondition {
      condition = var.create_ecr_repositories || (
        var.existing_frontend_ecr_repository_url != null &&
        var.existing_backend_ecr_repository_url != null
      )
      error_message = "Set existing_frontend_ecr_repository_url and existing_backend_ecr_repository_url when create_ecr_repositories is false."
    }
  }
}

module "network" {
  source = "./modules/network"

  project_name          = var.project_name
  environment           = var.environment
  vpc_cidr              = var.vpc_cidr
  public_subnet_cidrs   = var.public_subnet_cidrs
  private_subnet_cidrs  = var.private_subnet_cidrs
  availability_zone_cnt = max(length(var.public_subnet_cidrs), length(var.private_subnet_cidrs))
  tags                  = local.common_tags
}

module "security" {
  source = "./modules/security"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.network.vpc_id
  vpc_cidr              = module.network.vpc_cidr
  alb_ingress_cidrs     = var.alb_ingress_cidrs
  frontend_port         = var.frontend_container_port
  backend_port          = var.backend_container_port
  db_port               = var.db_port
  allow_https_from_cidr = var.enable_https
  tags                  = local.common_tags
}

module "vpc_endpoints" {
  source = "./modules/vpc_endpoints"

  project_name             = var.project_name
  environment              = var.environment
  region                   = var.aws_region
  vpc_id                   = module.network.vpc_id
  private_subnet_ids       = module.network.private_subnet_ids
  private_route_table_ids  = module.network.private_route_table_ids
  endpoint_security_group  = module.security.vpc_endpoint_sg_id
  tags                     = local.common_tags
}

module "ecr" {
  count  = var.create_ecr_repositories ? 1 : 0
  source = "./modules/ecr"

  project_name  = var.project_name
  environment   = var.environment
  force_delete  = var.ecr_force_delete
  scan_on_push  = true
  tags          = local.common_tags
}

locals {
  frontend_ecr_repository_url = var.create_ecr_repositories ? module.ecr[0].frontend_repository_url : var.existing_frontend_ecr_repository_url
  backend_ecr_repository_url  = var.create_ecr_repositories ? module.ecr[0].backend_repository_url : var.existing_backend_ecr_repository_url
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "/${var.project_name}/${var.environment}/jwt-secret"
  description             = "JWT signing secret for ${local.name_prefix} backend"
  recovery_window_in_days = 7
}

resource "random_password" "jwt_secret" {
  length           = 64
  special          = true
  override_special = "_-+=@#%"
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt_secret.result
}

module "rds" {
  source = "./modules/rds"

  project_name            = var.project_name
  environment             = var.environment
  private_subnet_ids      = module.network.private_subnet_ids
  db_security_group_id    = module.security.db_sg_id
  db_name                 = var.db_name
  db_username             = var.db_username
  db_port                 = var.db_port
  db_engine_version       = var.db_engine_version
  db_instance_class       = var.db_instance_class
  db_allocated_storage    = var.db_allocated_storage
  db_max_allocated_storage = var.db_max_allocated_storage
  db_backup_retention_days = var.db_backup_retention_days
  db_multi_az             = var.db_multi_az
  db_deletion_protection  = var.db_deletion_protection
  db_skip_final_snapshot  = var.db_skip_final_snapshot
  db_apply_immediately    = var.db_apply_immediately
  tags                    = local.common_tags
}

module "iam" {
  source = "./modules/iam"

  project_name           = var.project_name
  environment            = var.environment
  jwt_secret_arn         = aws_secretsmanager_secret.jwt.arn
  rds_master_secret_arn  = module.rds.master_user_secret_arn
  tags                   = local.common_tags
}

module "ecs" {
  source = "./modules/ecs"

  project_name                    = var.project_name
  environment                     = var.environment
  region                          = var.aws_region
  vpc_id                          = module.network.vpc_id
  public_subnet_ids               = module.network.public_subnet_ids
  private_subnet_ids              = module.network.private_subnet_ids
  alb_sg_id                       = module.security.alb_sg_id
  frontend_sg_id                  = module.security.frontend_sg_id
  backend_sg_id                   = module.security.backend_sg_id
  execution_role_arn              = module.iam.execution_role_arn
  task_role_arn                   = module.iam.task_role_arn
  frontend_repository_url         = local.frontend_ecr_repository_url
  backend_repository_url          = local.backend_ecr_repository_url
  frontend_image_tag              = var.frontend_image_tag
  backend_image_tag               = var.backend_image_tag
  frontend_container_port         = var.frontend_container_port
  backend_container_port          = var.backend_container_port
  frontend_task_cpu               = var.frontend_task_cpu
  frontend_task_memory            = var.frontend_task_memory
  backend_task_cpu                = var.backend_task_cpu
  backend_task_memory             = var.backend_task_memory
  frontend_desired_count          = var.frontend_desired_count
  backend_desired_count           = var.backend_desired_count
  frontend_min_capacity           = var.frontend_min_capacity
  frontend_max_capacity           = var.frontend_max_capacity
  backend_min_capacity            = var.backend_min_capacity
  backend_max_capacity            = var.backend_max_capacity
  frontend_target_cpu_utilization = var.frontend_target_cpu_utilization
  frontend_target_memory_utilization = var.frontend_target_memory_utilization
  backend_target_cpu_utilization  = var.backend_target_cpu_utilization
  backend_target_memory_utilization = var.backend_target_memory_utilization
  ecs_log_retention_days          = var.ecs_log_retention_days
  enable_ecs_exec                 = var.enable_ecs_exec
  enable_container_insights       = var.enable_container_insights
  enable_https                    = var.enable_https
  acm_certificate_arn             = var.acm_certificate_arn
  backend_health_check_path       = var.backend_health_check_path
  backend_service_discovery_name  = var.backend_service_discovery_name
  private_dns_namespace_name      = var.private_dns_namespace_name
  jwt_expiration_ms               = var.jwt_expiration_ms
  db_endpoint                     = module.rds.db_endpoint
  db_port                         = module.rds.db_port
  db_name                         = module.rds.db_name
  db_username                     = module.rds.db_username
  db_password_secret_arn          = module.rds.master_user_secret_arn
  jwt_secret_arn                  = aws_secretsmanager_secret.jwt.arn
  app_base_url                    = var.app_base_url
  frontend_public_url             = var.frontend_public_url
  cors_allowed_origins            = var.cors_allowed_origins
  tags                            = local.common_tags

  depends_on = [
    terraform_data.input_validation,
    module.vpc_endpoints,
    aws_secretsmanager_secret_version.jwt,
  ]
}
