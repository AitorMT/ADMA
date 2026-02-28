# Seguridad

Este documento explica las medidas de seguridad implementadas en cada capa del proyecto y la justificación de cada decisión.

## 1. Security Groups (capa de red)

Los Security Groups actúan como firewalls virtuales. Cada componente solo puede comunicarse con quien necesita.

```
                Internet
                   │
         ┌─────── │ ──────────────┐
         │    ALB SG              │
         │  ingress: 80 (0.0.0.0) │
         │  egress:  * (0.0.0.0)  │
         └────┬───────────┬───────┘
              │           │
     ┌────────▼──┐   ┌────▼──────────┐
     │ Frontend  │   │ Backend SG    │
     │ SG        │   │               │
     │ in: 80    │   │ in: 8080      │
     │  (ALB)    │   │  (ALB)        │
     │ out: 443  │   │ out: 443      │
     │ (internet)│   │  (internet)   │
     └───────────┘   │ out: 5432     │
                     │  (DB SG)      │
                     └────┬──────────┘
                          │
                   ┌──────▼──────────┐
                   │ DB SG           │
                   │ in: 5432        │
                   │  (Backend SG)   │
                   │ out: (ninguno)  │
                   └─────────────────┘
```

### Principio de mínimo privilegio

| Security Group | Ingress permitido              | Egress permitido                              | Justificación                                                                        |
| -------------- | ------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `alb_sg`       | Puerto 80 desde `0.0.0.0/0`    | Todo                                          | El ALB es el único punto expuesto a internet                                         |
| `frontend_sg`  | Puerto 80 desde `alb_sg`       | Puerto 443 a internet                         | Solo recibe tráfico del ALB. Solo necesita HTTPS saliente para ECR y CloudWatch      |
| `backend_sg`   | Puerto 8080 desde `alb_sg`     | Puerto 443 a internet + puerto 5432 a `db_sg` | Recibe del ALB, necesita alcanzar la BD y servicios AWS                              |
| `db_sg`        | Puerto 5432 desde `backend_sg` | Ninguno                                       | Solo acepta conexiones PostgreSQL del backend. No puede iniciar conexiones salientes |

**¿Por qué las reglas del backend y la BD están en recursos separados (`aws_security_group_rule`)?**
Para evitar **dependencias circulares** en Terraform. Si `backend_sg` referenciara a `db_sg` en su definición, y `db_sg` referenciara a `backend_sg`, Terraform no podría determinar cuál crear primero. Al separar las reglas en recursos independientes, Terraform resuelve el grafo de dependencias correctamente.

## 2. Base de datos aislada

| Medida                | Implementación                                         |
| --------------------- | ------------------------------------------------------ |
| Sin acceso a internet | Subredes privadas sin ruta al Internet Gateway         |
| Sin acceso público    | `publicly_accessible = false`                          |
| Firewall              | Solo acepta conexiones del `backend_sg` en puerto 5432 |
| Sin egress            | La BD no puede conectarse a ningún sitio externo       |

**Resultado:** La base de datos es inaccesible desde internet. Solo el backend dentro de la VPC puede hablarle.

## 3. Autenticación: JWT stateless

```
  ┌───────┐     POST /auth/login      ┌─────────┐
  │Browser│ ─────────────────────────→ │ Backend │
  │       │ ←───────────────────────── │         │
  │       │     { "token": "eyJ..." }  │         │
  │       │                            │         │
  │       │  GET /api/urls             │         │
  │       │  Authorization: Bearer eyJ │         │
  │       │ ─────────────────────────→ │         │
  └───────┘                            └─────────┘
```

| Aspecto        | Decisión                                   | Justificación                                                           |
| -------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| Tipo de token  | JWT (JSON Web Token)                       | Stateless: no requiere sesión del lado del servidor                     |
| Almacenamiento | `SessionCreationPolicy.STATELESS`          | No se crea `HttpSession`; cada request se valida de forma independiente |
| Algoritmo      | HMAC-SHA con secreto simétrico             | Suficiente para un solo servicio; no necesitamos RSA                    |
| Expiración     | 24h (configurable vía `JWT_EXPIRATION_MS`) | Balance entre seguridad y UX                                            |
| Secreto        | Inyectado como variable de entorno         | Nunca hardcodeado en el código fuente                                   |

**¿Por qué CSRF está desactivado?**
Porque usamos JWT en el header `Authorization: Bearer ...`, no cookies. CSRF (Cross-Site Request Forgery) solo es relevante cuando la autenticación viaja en cookies automáticas. Con JWT en headers, el navegador no envía el token automáticamente.

## 4. Contraseñas: BCrypt

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
}
```

| Propiedad       | Valor      | Justificación                                                                     |
| --------------- | ---------- | --------------------------------------------------------------------------------- |
| Algoritmo       | BCrypt     | Recomendado por OWASP. Resistente a ataques de diccionario                        |
| Factor de coste | 12         | Cada hash tarda ~250ms, lo que hace inviable el fuerza bruta pero no afecta al UX |
| Salt            | Automático | BCrypt genera un salt aleatorio por contraseña                                    |

## 5. CORS

```java
config.setAllowedOrigins(origins);  // Solo el ALB
config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
config.setAllowCredentials(true);
```

Los orígenes permitidos se leen de la variable de entorno `CORS_ALLOWED_ORIGINS`. En producción, Terraform configura solo la URL del ALB. Esto impide que una página web maliciosa haga peticiones al backend desde otro dominio.

## 6. Contenedores: usuario no-root

El backend corre como un usuario sin privilegios dentro del contenedor:

```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```

**¿Por qué?**
Si un atacante logra ejecutar código dentro del contenedor (ej. a través de una vulnerabilidad), no tendría permisos de root. Esto limita el impacto de una posible intrusión.

## 7. Secretos en producción

En el estado actual (entorno demo), los secretos están en `terraform.tfvars`:

```hcl
db_pass    = "password123"
jwt_secret = "changeme-replace-this-with-a-real-secret!!"
```

> ⚠️ **Esto NO es aceptable en producción.** Para un entorno productivo se debería migrar a:
>
> - **AWS Secrets Manager** o **SSM Parameter Store** para almacenar secretos.
> - Referencia desde la task definition de ECS vía `secrets` (en lugar de `environment`).
> - `terraform.tfvars` nunca debería contener credenciales reales ni estar en el repositorio.
