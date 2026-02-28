# Variables del proyecto para hacerlo reutilizable

variable "region" {
  default = "eu-south-2"
}

variable "project" {
  default = "adma-sa2-sa3"
}

# Modo de despliegue: "demo" (mínimo coste) o "production" (más réplicas)
variable "environment" {
  default     = "demo"
  description = "demo | production"
  validation {
    condition     = contains(["demo", "production"], var.environment)
    error_message = "El entorno debe ser 'demo' o 'production'."
  }
}

# Imágenes Docker (ya almacenadas en ECR público)
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

# Secreto JWT (mínimo 32 caracteres)
variable "jwt_secret" {
  sensitive   = true
  description = "Clave secreta para firmar los tokens JWT (mín. 32 caracteres)"
}

variable "jwt_expiration_ms" {
  default = 86400000
}

# ── Escalado (controlado por environment) ─────────────────────────────────────
locals {
  # Número mínimo/máximo de tareas por servicio según el entorno
  frontend_min = var.environment == "production" ? 2 : 1
  frontend_max = var.environment == "production" ? 4 : 2
  backend_min  = var.environment == "production" ? 2 : 1
  backend_max  = var.environment == "production" ? 4 : 2

  # Tamaño de la instancia RDS según entorno
  db_instance_class = var.environment == "production" ? "db.t3.small" : "db.t3.micro"
}
