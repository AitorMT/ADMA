# Grupo de subredes para la base de datos (subredes privadas, sin acceso a internet)
resource "aws_db_subnet_group" "this" {
  name       = "${var.project}-db-subnet-group"
  subnet_ids = aws_subnet.private_db[*].id

  tags = {
    Name = "${var.project}-db-subnet-group"
  }
}

# Instancia PostgreSQL privada
# - skip_final_snapshot = true  → permite destruirla limpiamente con terraform destroy
# - publicly_accessible = false → solo accesible desde dentro de la VPC
resource "aws_db_instance" "this" {
  identifier     = "${var.project}-rds"
  engine         = "postgres"
  engine_version = "16"
  instance_class = local.db_instance_class

  allocated_storage = 20
  storage_type      = "gp2"

  db_name  = var.db_name
  username = var.db_user
  password = var.db_pass

  vpc_security_group_ids = [aws_security_group.db_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.this.name

  publicly_accessible = false
  skip_final_snapshot = true
  deletion_protection = false

  tags = {
    Name = "${var.project}-rds"
  }
}

