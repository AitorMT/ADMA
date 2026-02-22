output "s3_endpoint_id" {
  value = aws_vpc_endpoint.s3.id
}

output "interface_endpoint_ids" {
  value = [for endpoint in aws_vpc_endpoint.interface : endpoint.id]
}
