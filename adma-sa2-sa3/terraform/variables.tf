# Variables del proyecto para hacerlo reutilizable

variable "region" {
  default = "eu-south-2"
}

variable "project" {
  default = "adma-sa2-sa3"
}

# Imágenes Docker (las crearé yo previamente)
variable "frontend_image" {}
variable "backend_image" {}

# Configuración de la base de datos
variable "db_name" {
  default = "appdb"
}

variable "db_user" {
  default = "appuser"
}

variable "db_pass" {
  sensitive = true
}
variable "jwt_expiration_ms" {
  default = 86400000
}
