# Grupo de subredes para la base de datos
resource "aws_db_subnet_group" "this" {
  subnet_ids = aws_subnet.private_db[*].id

  tags = {
    Name = "${var.project}-db-subnet-group"
  }
}

# Instancia MySQL privada
resource "aws_db_instance" "this" {
  engine            = "mysql"
  instance_class    = "db.t3.micro"
  allocated_storage = 20

  db_name  = var.db_name
  username = var.db_user
  # password = var.db_pass
  # Para evitar exponer la contraseña en el código, se recomienda usar AWS Secrets Manager o SSM Parameter Store
  manage_master_user_password = true

  vpc_security_group_ids = [aws_security_group.db_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.this.name

  publicly_accessible = false
  skip_final_snapshot = true

  tags = {
    Name = "${var.project}-rds"
  }
}

