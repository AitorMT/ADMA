aws_region   = "eu-south-2"
project_name = "adma"
environment  = "prod"

# Networking
vpc_cidr             = "10.42.0.0/16"
public_subnet_cidrs  = ["10.42.0.0/24", "10.42.1.0/24"]
private_subnet_cidrs = ["10.42.10.0/24", "10.42.11.0/24"]

# Domain/TLS (optional)
enable_https        = false
# acm_certificate_arn = "arn:aws:acm:eu-south-2:912390896205:certificate/xxxx"

# Container images
create_ecr_repositories = true
frontend_image_tag      = "latest"
backend_image_tag       = "latest"

# If reusing existing ECR repos instead of creating them:
# create_ecr_repositories              = false
# existing_frontend_ecr_repository_url = "912390896205.dkr.ecr.eu-south-2.amazonaws.com/adma/prod/frontend"
# existing_backend_ecr_repository_url  = "912390896205.dkr.ecr.eu-south-2.amazonaws.com/adma/prod/backend"

# Backend runtime URL settings
# Set to your custom domain when available. If omitted, ALB DNS is used.
frontend_public_url = null
app_base_url        = null
cors_allowed_origins = []

# RDS cost/perf defaults
db_engine_version      = "16.12"    # latest PostgreSQL 16 available in eu-south-2
# db_instance_class      = "db.t4g.micro"
# db_multi_az            = false
# db_deletion_protection = true

# ── DESTROY OVERRIDES ────────────────────────────────────────────
# Uncomment ALL of these before running `terraform destroy`
# db_deletion_protection = false   # disables RDS deletion protection
# db_skip_final_snapshot = true    # skips the final DB snapshot (env already deleted)
# ecr_force_delete       = true    # allows deleting ECR repos even if they have images
# ─────────────────────────────────────────────────────────────────

# Optional tags
tags = {
  Owner = "platform-team"
}
