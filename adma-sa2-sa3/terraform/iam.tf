# Role que usan las tareas de ECS para arrancar (pull de imágenes, logs, etc.)
# Usamos name_prefix para que Terraform genere un nombre único y evitar
# conflictos si el role ya existe de un despliegue anterior.
resource "aws_iam_role" "ecs_task_execution" {
  name_prefix = "${var.project}-ecs-exec-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  # Garantiza que Terraform destruya el role antes de crear uno nuevo
  lifecycle {
    create_before_destroy = true
  }
}

# Policy gestionada por AWS necesaria para que ECS pueda:
# - descargar imágenes de ECR
# - escribir logs en CloudWatch
resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
