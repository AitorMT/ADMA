# Arquitectura General

## Diagrama de alto nivel

```
┌──────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTP :80
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Application Load Balancer                     │
│                    (adma-sa2-sa3-alb)                             │
│                                                                  │
│  Reglas de routing por path:                                     │
│    P10: /api/* /auth/*         → Backend TG (:8080)              │
│    P20: / /login /register     → Frontend TG (:80)               │
│         /r/* /assets/*                                           │
│    P30: /* (short codes)       → Backend TG (:8080)              │
│    Default:                    → Frontend TG (:80)               │
└────────┬───────────────────────────────┬────────────────────────┘
         │                               │
         ▼                               ▼
┌─────────────────────┐    ┌──────────────────────────┐
│  Frontend (ECS)     │    │  Backend (ECS)           │
│  Nginx :80          │    │  Spring Boot :8080       │
│  SPA estática React │    │  API REST + Redirects    │
│  256 CPU / 512 MB   │    │  512 CPU / 1024 MB       │
└─────────────────────┘    └────────────┬─────────────┘
                                        │ TCP :5432
                                        ▼
                           ┌──────────────────────────┐
                           │  PostgreSQL (RDS)        │
                           │  Subredes privadas       │
                           │  Sin acceso a internet   │
                           └──────────────────────────┘
```

## Componentes

### Frontend

- **Qué es:** Una aplicación React (SPA) compilada en archivos HTML/JS/CSS estáticos.
- **Dónde corre:** Dentro de un contenedor Nginx en AWS ECS Fargate.
- **Qué hace:** Muestra la interfaz de usuario. El acortamiento de URLs, login, registro y las estadísticas se realizan llamando al backend vía `/api/*` y `/auth/*`.
- **Importante:** Nginx NO hace proxy al backend. Solo sirve archivos estáticos. Es el ALB quien decide qué peticiones van al frontend y cuáles al backend.

### Backend

- **Qué es:** Una API REST hecha con Spring Boot (Java 21).
- **Dónde corre:** Dentro de un contenedor en AWS ECS Fargate, puerto 8080.
- **Qué hace:**
  - `/auth/*` → Registro y login de usuarios (JWT).
  - `/api/urls/*` → CRUD de URLs acortadas.
  - `/api/stats` → Estadísticas públicas de la plataforma.
  - `/{shortCode}` → Redirección 302 al destino original.

### Base de datos

- **Qué es:** PostgreSQL 16 gestionado por AWS RDS.
- **Dónde corre:** En subredes privadas aisladas de internet.
- **Quién accede:** Exclusivamente el backend, a través del puerto 5432.
- **Persistencia:** `skip_final_snapshot = true` — en modo demo los datos se pierden al destruir.

### ALB (Application Load Balancer)

- **Qué es:** El punto de entrada único de la aplicación.
- **Qué hace:** Recibe todo el tráfico HTTP en el puerto 80 y lo distribuye al frontend o al backend según reglas de path (ver [Routing del ALB](Routing-ALB.md)).

## Red (VPC)

| Componente             | CIDR                           | Acceso a Internet        | Uso                                   |
| ---------------------- | ------------------------------ | ------------------------ | ------------------------------------- |
| VPC                    | `10.0.0.0/16`                  | —                        | Contenedor de toda la infraestructura |
| Subredes públicas (×2) | `10.0.0.0/24`, `10.0.1.0/24`   | ✅ Sí (Internet Gateway) | ALB + ECS Fargate                     |
| Subredes privadas (×2) | `10.0.20.0/24`, `10.0.21.0/24` | ❌ No                    | RDS PostgreSQL                        |

**¿Por qué ECS está en subredes públicas?**
Porque ECS Fargate necesita descargar las imágenes Docker de ECR público. Para eso necesita acceso a internet. La alternativa sería un NAT Gateway (~30$/mes), que es un coste excesivo para un entorno de demo.
