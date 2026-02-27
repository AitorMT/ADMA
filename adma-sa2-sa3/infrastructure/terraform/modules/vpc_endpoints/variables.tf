variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "private_route_table_ids" {
  type = list(string)
}

variable "endpoint_security_group" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
