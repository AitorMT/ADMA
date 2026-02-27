# Obtengo las zonas de disponibilidad disponibles en la región
data "aws_availability_zones" "available" {}

# Creo la VPC principal donde irá toda la infraestructura
resource "aws_vpc" "this" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  # Nombre identificativo
  tags = {
    Name = "${var.project}-vpc"
  }
}
# ================================
# SUBREDES
# ================================

# Subredes públicas (para el Load Balancer)
# Uso count para crear 2 subredes, una en cada AZ, para alta disponibilidad, pero sin crear más de 2 para no complicar la red
resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet("10.0.0.0/16", 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project}-public-subnet-${count.index}"
  }
}

# Subredes privadas para ECS (contenedores)
# Uso count para crear 2 subredes, una en cada AZ, para alta disponibilidad, pero sin crear más de 2 para no complicar la red
resource "aws_subnet" "private_app" {
  count = 2

  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet("10.0.0.0/16", 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${var.project}-private-app-${count.index}"
  }
}

# Subred privada para la base de datos
resource "aws_subnet" "private_db" {
  count = 2

  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet("10.0.0.0/16", 8, count.index + 20)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${var.project}-private-db-${count.index}"
  }
}

# ================================
# INTERNET Y RUTAS
# ================================

# Gateway para acceso a internet
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "${var.project}-igw"
  }
}

# Tabla de rutas pública
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "${var.project}-public-rt"
  }
}

# Ruta hacia internet
resource "aws_route" "internet_access" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.igw.id
}

# Asociación de subredes públicas
resource "aws_route_table_association" "public_assoc" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
