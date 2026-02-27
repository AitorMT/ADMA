# Output para acceder a la aplicación desde el navegador

output "alb_dns" {
  value = aws_lb.this.dns_name
}
# Output para obtener el ID del security group de ECS, para utilizar en cdk-drift-control
output "ecs_sg_id" {
  value = aws_security_group.ecs_sg.id
}
