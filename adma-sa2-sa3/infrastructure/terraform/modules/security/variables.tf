variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "alb_ingress_cidrs" {
  type = list(string)
}

variable "frontend_port" {
  type = number
}

variable "backend_port" {
  type = number
}

variable "db_port" {
  type = number
}

variable "allow_https_from_cidr" {
  type    = bool
  default = false
}

variable "tags" {
  type    = map(string)
  default = {}
}
