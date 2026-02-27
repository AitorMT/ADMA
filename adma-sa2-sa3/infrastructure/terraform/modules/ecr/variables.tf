variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "force_delete" {
  type    = bool
  default = false
}

variable "scan_on_push" {
  type    = bool
  default = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
