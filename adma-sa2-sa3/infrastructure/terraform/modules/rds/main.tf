locals {
  name_prefix = "${var.project_name}-${var.environment}"
  major_engine_version = split(".", var.db_engine_version)[0]
}

resource "aws_db_subnet_group" "this" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-db-subnet-group"
  })
}

resource "random_id" "final_snapshot_suffix" {
  byte_length = 3
}

resource "aws_db_parameter_group" "this" {
  name   = "${local.name_prefix}-postgres-params"
  family = "postgres${local.major_engine_version}"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-postgres-params"
  })
}

resource "aws_db_instance" "this" {
  identifier                        = "${local.name_prefix}-postgres"
  engine                            = "postgres"
  engine_version                    = var.db_engine_version
  instance_class                    = var.db_instance_class
  db_name                           = var.db_name
  username                          = var.db_username
  port                              = var.db_port
  manage_master_user_password       = true
  allocated_storage                 = var.db_allocated_storage
  max_allocated_storage             = var.db_max_allocated_storage
  storage_type                      = "gp3"
  storage_encrypted                 = true
  multi_az                          = var.db_multi_az
  backup_retention_period           = var.db_backup_retention_days
  backup_window                     = "03:00-04:00"
  maintenance_window                = "Mon:04:00-Mon:05:00"
  auto_minor_version_upgrade        = true
  apply_immediately                 = var.db_apply_immediately
  deletion_protection               = var.db_deletion_protection
  skip_final_snapshot               = var.db_skip_final_snapshot
  final_snapshot_identifier         = var.db_skip_final_snapshot ? null : "${local.name_prefix}-final-${random_id.final_snapshot_suffix.hex}"
  copy_tags_to_snapshot             = true
  publicly_accessible               = false
  db_subnet_group_name              = aws_db_subnet_group.this.name
  parameter_group_name              = aws_db_parameter_group.this.name
  vpc_security_group_ids            = [var.db_security_group_id]
  performance_insights_enabled      = false
  monitoring_interval               = 0
  enabled_cloudwatch_logs_exports   = ["postgresql"]

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-postgres"
  })
}
