variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "jwt_secret_arn" {
  type = string
}

variable "rds_master_secret_arn" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
