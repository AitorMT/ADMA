locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Allow public ingress to frontend ALB"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-alb-sg"
  })
}

resource "aws_security_group" "frontend" {
  name        = "${local.name_prefix}-frontend-sg"
  description = "Allow ALB ingress to frontend tasks"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-frontend-sg"
  })
}

resource "aws_security_group" "backend" {
  name        = "${local.name_prefix}-backend-sg"
  description = "Allow ingress to backend only from frontend tasks"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-backend-sg"
  })
}

resource "aws_security_group" "db" {
  name        = "${local.name_prefix}-db-sg"
  description = "Allow database access only from backend tasks"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-db-sg"
  })
}

resource "aws_security_group" "vpc_endpoint" {
  name        = "${local.name_prefix}-vpce-sg"
  description = "Restrict interface endpoint access to ECS tasks"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-vpce-sg"
  })
}

# ALB ingress rules
resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  for_each = toset(var.alb_ingress_cidrs)

  security_group_id = aws_security_group.alb.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = each.value
  description       = "Public HTTP access"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  for_each = var.allow_https_from_cidr ? toset(var.alb_ingress_cidrs) : toset([])

  security_group_id = aws_security_group.alb.id
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = each.value
  description       = "Public HTTPS access"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_frontend" {
  security_group_id            = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = var.frontend_port
  to_port                      = var.frontend_port
  referenced_security_group_id = aws_security_group.frontend.id
  description                  = "ALB forwards traffic only to frontend service"
}

# Frontend: ingress only from ALB
resource "aws_vpc_security_group_ingress_rule" "frontend_from_alb" {
  security_group_id            = aws_security_group.frontend.id
  ip_protocol                  = "tcp"
  from_port                    = var.frontend_port
  to_port                      = var.frontend_port
  referenced_security_group_id = aws_security_group.alb.id
  description                  = "Allow ALB traffic to frontend"
}

# Frontend: egress only to backend + VPC endpoints + DNS resolver
resource "aws_vpc_security_group_egress_rule" "frontend_to_backend" {
  security_group_id            = aws_security_group.frontend.id
  ip_protocol                  = "tcp"
  from_port                    = var.backend_port
  to_port                      = var.backend_port
  referenced_security_group_id = aws_security_group.backend.id
  description                  = "Frontend may call backend service"
}

resource "aws_vpc_security_group_egress_rule" "frontend_to_vpce" {
  security_group_id            = aws_security_group.frontend.id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.vpc_endpoint.id
  description                  = "Frontend task runtime access to AWS API endpoints"
}

resource "aws_vpc_security_group_egress_rule" "frontend_dns_udp" {
  security_group_id = aws_security_group.frontend.id
  ip_protocol       = "udp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = var.vpc_cidr
  description       = "DNS resolution in VPC"
}

resource "aws_vpc_security_group_egress_rule" "frontend_dns_tcp" {
  security_group_id = aws_security_group.frontend.id
  ip_protocol       = "tcp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = var.vpc_cidr
  description       = "DNS resolution in VPC"
}

# Backend: ingress only from frontend
resource "aws_vpc_security_group_ingress_rule" "backend_from_frontend" {
  security_group_id            = aws_security_group.backend.id
  ip_protocol                  = "tcp"
  from_port                    = var.backend_port
  to_port                      = var.backend_port
  referenced_security_group_id = aws_security_group.frontend.id
  description                  = "Only frontend can reach backend"
}

# Backend: egress only to RDS + VPC endpoints + DNS
resource "aws_vpc_security_group_egress_rule" "backend_to_db" {
  security_group_id            = aws_security_group.backend.id
  ip_protocol                  = "tcp"
  from_port                    = var.db_port
  to_port                      = var.db_port
  referenced_security_group_id = aws_security_group.db.id
  description                  = "Backend may reach database"
}

resource "aws_vpc_security_group_egress_rule" "backend_to_vpce" {
  security_group_id            = aws_security_group.backend.id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.vpc_endpoint.id
  description                  = "Backend task runtime access to AWS API endpoints"
}

resource "aws_vpc_security_group_egress_rule" "backend_dns_udp" {
  security_group_id = aws_security_group.backend.id
  ip_protocol       = "udp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = var.vpc_cidr
  description       = "DNS resolution in VPC"
}

resource "aws_vpc_security_group_egress_rule" "backend_dns_tcp" {
  security_group_id = aws_security_group.backend.id
  ip_protocol       = "tcp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = var.vpc_cidr
  description       = "DNS resolution in VPC"
}

# Database: inbound only from backend SG
resource "aws_vpc_security_group_ingress_rule" "db_from_backend" {
  security_group_id            = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = var.db_port
  to_port                      = var.db_port
  referenced_security_group_id = aws_security_group.backend.id
  description                  = "Backend-only DB access"
}

resource "aws_vpc_security_group_egress_rule" "db_internal" {
  security_group_id = aws_security_group.db.id
  ip_protocol       = "-1"
  cidr_ipv4         = var.vpc_cidr
  description       = "Allow DB response traffic inside VPC"
}

# Interface endpoints: only frontend/backend SGs can connect over TLS
resource "aws_vpc_security_group_ingress_rule" "vpce_from_frontend" {
  security_group_id            = aws_security_group.vpc_endpoint.id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.frontend.id
  description                  = "Frontend to VPC endpoints"
}

resource "aws_vpc_security_group_ingress_rule" "vpce_from_backend" {
  security_group_id            = aws_security_group.vpc_endpoint.id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.backend.id
  description                  = "Backend to VPC endpoints"
}

resource "aws_vpc_security_group_egress_rule" "vpce_all" {
  security_group_id = aws_security_group.vpc_endpoint.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
  description       = "Endpoint-managed return traffic"
}
