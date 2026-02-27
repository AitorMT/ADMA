# Defino la versión mínima de Terraform y el provider de AWS
# Esto evita problemas de compatibilidad

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
