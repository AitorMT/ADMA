# ================================
# SECURITY GROUP - ALB
# ================================

# Permite tráfico HTTP desde internet hacia el Load Balancer
resource "aws_security_group" "alb_sg" {
  name   = "${var.project}-alb-sg"
  vpc_id = aws_vpc.this.id

  ingress {
    description = "HTTP desde internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS desde internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project}-alb-sg"
  }
}

# ================================
# SECURITY GROUP - FRONTEND (ECS)
# ================================

# El frontend solo acepta tráfico del ALB en el puerto 80.
# Solo necesita egress HTTPS para descargar la imagen de ECR público
# y enviar logs a CloudWatch.
resource "aws_security_group" "frontend_sg" {
  name   = "${var.project}-frontend-sg"
  vpc_id = aws_vpc.this.id

  ingress {
    description     = "HTTP desde el ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    description = "HTTPS for ECR public and CloudWatch Logs"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS TCP"
    from_port   = 53
    to_port     = 53
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS UDP"
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project}-frontend-sg"
  }
}

# ================================
# SECURITY GROUP - BACKEND (ECS)
# ================================

# El backend acepta tráfico del ALB en el puerto 8080.
# El ALB enruta /api/*, /auth/* y /{shortCode} directamente aquí.
# La regla de egress hacia la BD se añade por separado.
resource "aws_security_group" "backend_sg" {
  name   = "${var.project}-backend-sg"
  vpc_id = aws_vpc.this.id

  ingress {
    description     = "HTTP desde el ALB (rutas /api/* /auth/*)"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    description = "HTTPS for ECR public and CloudWatch Logs"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS TCP"
    from_port   = 53
    to_port     = 53
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS UDP"
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project}-backend-sg"
  }
}

# Regla de egress del backend hacia la BD (separada para romper el ciclo)
resource "aws_security_group_rule" "backend_to_db" {
  type                     = "egress"
  description              = "Acceso a PostgreSQL"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.backend_sg.id
  source_security_group_id = aws_security_group.db_sg.id
}

# ================================
# SECURITY GROUP - BASE DE DATOS
# ================================

# Solo acepta conexiones PostgreSQL desde el backend.
# Sin egress → la BD no puede iniciar conexiones salientes.
resource "aws_security_group" "db_sg" {
  name   = "${var.project}-db-sg"
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "${var.project}-db-sg"
  }
}

# Regla de ingress de la BD desde el backend (separada para romper el ciclo)
resource "aws_security_group_rule" "db_from_backend" {
  type                     = "ingress"
  description              = "PostgreSQL desde el backend"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.db_sg.id
  source_security_group_id = aws_security_group.backend_sg.id
}
