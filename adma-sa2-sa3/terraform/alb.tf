# Load Balancer público
resource "aws_lb" "this" {
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.alb_sg.id]

  tags = {
    Name = "${var.project}-alb"
  }
}

# Target group frontend
resource "aws_lb_target_group" "frontend" {
  vpc_id      = aws_vpc.this.id
  port        = 80
  protocol    = "HTTP"
  target_type = "ip"

  health_check {
    path = "/"
  }

  tags = {
    Name = "${var.project}-tg-frontend"
  }
}

# Target group backend
resource "aws_lb_target_group" "backend" {
  vpc_id      = aws_vpc.this.id
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"

  health_check {
    path = "/health"
  }

  tags = {
    Name = "${var.project}-tg-backend"
  }
}

# Listener principal
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# Regla para enrutar /api al backend
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}
