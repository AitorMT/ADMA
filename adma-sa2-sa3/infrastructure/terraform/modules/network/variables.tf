variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "public_subnet_cidrs" {
  type = list(string)
}

variable "private_subnet_cidrs" {
  type = list(string)
}

variable "availability_zone_cnt" {
  type = number

  validation {
    condition     = var.availability_zone_cnt >= 2
    error_message = "At least two availability zones are required."
  }
}

variable "tags" {
  type    = map(string)
  default = {}
}
