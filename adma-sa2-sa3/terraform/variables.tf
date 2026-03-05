# Variables del proyecto para hacerlo reutilizable

variable "region" {
  type    = string
  default = "eu-south-2"
}

variable "project" {
  type    = string
  default = "adma-sa2-sa3"
}

# Modo de despliegue: "demo" (mínimo coste) o "production" (más réplicas)
variable "environment" {
  type        = string
  default     = "demo"
  description = "demo | production"
  validation {
    condition     = contains(["demo", "production"], var.environment)
    error_message = "El entorno debe ser 'demo' o 'production'."
  }
}

# Imágenes Docker (ya almacenadas en ECR público)
variable "frontend_image" {
  type = string
}
variable "backend_image" {
  type = string
}

# Configuración de la base de datos
variable "db_name" {
  type    = string
  default = "appdb"
}

variable "db_user" {
  type    = string
  default = "appuser"
}

variable "db_pass" {
  type      = string
  sensitive = true
}

# Secreto JWT (mínimo 32 caracteres)
variable "jwt_secret" {
  type        = string
  sensitive   = true
  description = "Clave secreta para firmar los tokens JWT (mín. 32 caracteres)"
  validation {
    condition     = length(var.jwt_secret) >= 32
    error_message = "jwt_secret debe tener al menos 32 caracteres ASCII para HS256."
  }
}

variable "jwt_expiration_ms" {
  type    = number
  default = 86400000
}

variable "domain_name" {
  type        = string
  default     = "otakudojo.es"
  description = "Dominio raíz público de la aplicación."
}

variable "hosted_zone_id" {
  type        = string
  default     = null
  description = "ID de una hosted zone Route53 existente. Si es null, Terraform crea la zona."
}

variable "subject_alternative_names" {
  type        = list(string)
  default     = []
  description = "SANs para el certificado ACM."
}

variable "additional_cors_origins" {
  type        = list(string)
  default     = []
  description = "Orígenes extra permitidos por CORS."
}

variable "alb_ssl_policy" {
  type        = string
  default     = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  description = "Política TLS del listener HTTPS del ALB."
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

  public_base_url = "https://${var.domain_name}"
  cert_sans       = distinct(concat(["www.${var.domain_name}"], var.subject_alternative_names))
  default_https_origins = [
    "https://${var.domain_name}",
    "https://www.${var.domain_name}"
  ]
  cors_allowed_origins = join(",", distinct(concat(local.default_https_origins, var.additional_cors_origins)))
}
