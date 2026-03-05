# Load Balancer público (accesible desde internet)
resource "aws_lb" "this" {
  name               = "${var.project}-alb"
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.alb_sg.id]

  tags = {
    Name = "${var.project}-alb"
  }
}

# ── Target Groups ─────────────────────────────────────────────────────────────

# Target group para el frontend (Nginx en puerto 80)
resource "aws_lb_target_group" "frontend" {
  name        = "${var.project}-tg-frontend"
  vpc_id      = aws_vpc.this.id
  port        = 80
  protocol    = "HTTP"
  target_type = "ip"

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 10
  }

  tags = {
    Name = "${var.project}-tg-frontend"
  }
}

# Target group para el backend (Spring Boot en puerto 8080)
resource "aws_lb_target_group" "backend" {
  name        = "${var.project}-tg-backend"
  vpc_id      = aws_vpc.this.id
  port        = 8080
  protocol    = "HTTP"
  target_type = "ip"

  health_check {
    # /api/stats es un endpoint GET público real del backend.
    # El proyecto NO tiene Spring Boot Actuator en sus dependencias,
    # así que /actuator/health no existe y daría 404.
    path                = "/api/stats"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 10
  }

  tags = {
    Name = "${var.project}-tg-backend"
  }
}

# ── Listeners ─────────────────────────────────────────────────────────────────

# Listener HTTP en el puerto 80: redirección obligatoria a HTTPS
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = var.alb_ssl_policy
  certificate_arn   = aws_acm_certificate_validation.site.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# Regla (prioridad 10): /api/* y /auth/* → backend
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/auth/*"]
    }
  }
}

# Regla (prioridad 20): rutas SPA conocidas → frontend
# Se evalúa antes del catch-all del backend para que /login,
# /register y /r/* nunca lleguen al backend.
resource "aws_lb_listener_rule" "spa_routes" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  condition {
    path_pattern {
      values = ["/", "/login", "/register", "/r/*", "/assets/*"]
    }
  }
}

# Regla (prioridad 30): todo lo demás → backend (short codes /{code})
# El backend redirige al destino real (302) o devuelve 404 si no existe.
# El frontend (regla default) solo sirve la SPA para /.
resource "aws_lb_listener_rule" "short_codes" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 30

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }
}
