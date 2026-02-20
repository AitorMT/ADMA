# ADMA URL Shortener — Documentación completa

> Stack: **Spring Boot 3.4.2 · React 18 · PostgreSQL 16 · Docker · AWS ECS Fargate + ECR + RDS + ALB**

---

## Índice

1. [Descripción del proyecto](#1-descripción-del-proyecto)
2. [Arquitectura](#2-arquitectura)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Estructura del repositorio](#4-estructura-del-repositorio)
5. [Variables de entorno](#5-variables-de-entorno)
6. [Desarrollo local (Docker Compose)](#6-desarrollo-local-docker-compose)
7. [Reglas de negocio](#7-reglas-de-negocio)
8. [API Reference](#8-api-reference)
9. [Migración a AWS](#9-migración-a-aws)
   - [9.1 Prerrequisitos](#91-prerrequisitos)
   - [9.2 Diagrama de infraestructura](#92-diagrama-de-infraestructura)
   - [9.3 Paso 1 — Crear repositorios ECR](#93-paso-1--crear-repositorios-ecr)
   - [9.4 Paso 2 — Construir y subir las imágenes](#94-paso-2--construir-y-subir-las-imágenes)
   - [9.5 Paso 3 — RDS PostgreSQL](#95-paso-3--rds-postgresql)
   - [9.6 Paso 4 — Secrets Manager / SSM Parameter Store](#96-paso-4--secrets-manager--ssm-parameter-store)
   - [9.7 Paso 5 — ECS Cluster + Task Definitions](#97-paso-5--ecs-cluster--task-definitions)
   - [9.8 Paso 6 — Application Load Balancer](#98-paso-6--application-load-balancer)
   - [9.9 Paso 7 — ECS Services](#99-paso-7--ecs-services)
   - [9.10 Paso 8 — HTTPS con ACM](#910-paso-8--https-con-acm)
   - [9.11 Paso 9 — Variables de entorno en producción](#911-paso-9--variables-de-entorno-en-producción)
   - [9.12 Security Groups](#912-security-groups)
   - [9.13 Task Definition JSON completo](#913-task-definition-json-completo)
10. [CI/CD con GitHub Actions](#10-cicd-con-github-actions)
11. [Checklist de producción](#11-checklist-de-producción)

---

## 1. Descripción del proyecto

Acortador de URLs con dos modos de uso:

| Modo            | Comportamiento                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| **Anónimo**     | Crea enlaces temporales con TTL de **8 horas**. Se almacenan en `localStorage` y se sincronizan al hacer login. |
| **Autenticado** | Crea enlaces **permanentes**. El usuario puede verlos, copiarlos y eliminarlos.                                 |

Funcionalidades principales:

- Registro y login con **JWT** (HS256, 24 h de validez)
- Shortcodes alfanuméricos de 7 caracteres generados aleatoriamente
- Redirección HTTP 302 con medición de **latencia real** (media de Welford)
- **HTTP 410 Gone** para enlaces expirados (distinto de 404 Not Found)
- Estadísticas públicas en tiempo real (total de enlaces, redirecciones, latencia media)
- Limpieza automática de enlaces expirados cada 15 minutos (`@Scheduled`)
- Sincronización de URLs anónimas al autenticarse

---

## 2. Arquitectura

### Desarrollo local

```
Browser
  │
  ├─▶ http://localhost        → Frontend (Nginx :80)
  │                              └─ React SPA
  │
  └─▶ http://localhost:8080   → Backend (Spring Boot :8080)
                                 └─ PostgreSQL (localhost:5432)
```

### Producción (AWS)

```
Internet
    │
    ▼
Route 53 (DNS)
    │
    ▼
ACM Certificate (HTTPS)
    │
    ▼
Application Load Balancer  (puerto 443 → 80/8080)
    │               │
    │               │
    ▼               ▼
ECS Service      ECS Service
(frontend)       (backend)
Fargate          Fargate
nginx:80         spring:8080
    │               │
    │               ▼
    │           AWS RDS
    │           PostgreSQL 16
    │           (subnet privada)
    │
    └─── Ambos en subnets privadas
         ALB en subnet pública
```

---

## 3. Stack tecnológico

### Backend

| Componente        | Versión     | Notas                               |
| ----------------- | ----------- | ----------------------------------- |
| Java              | 21          | LTS, soporte Fargate ARM64          |
| Spring Boot       | 3.4.2       | Web, Security, Data JPA, Validation |
| Hibernate         | 6.6.5       | ORM, `ddl-auto: update` en dev      |
| JJWT              | 0.12.6      | HS256, firmado con `JWT_SECRET`     |
| BCrypt            | strength 12 | OWASP recommendation                |
| PostgreSQL driver | 42.7.5      |                                     |
| Gradle            | 9.3.0       | Wrapper incluido                    |

### Frontend

| Componente    | Versión | Notas                                   |
| ------------- | ------- | --------------------------------------- |
| React         | 18      |                                         |
| TypeScript    | 5       | strict mode                             |
| Vite          | 5       | `VITE_API_BASE_URL` baked at build time |
| React Router  | 6       | Client-side routing                     |
| Tailwind CSS  | 3       |                                         |
| shadcn/ui     | latest  | Componentes accesibles                  |
| Framer Motion | latest  | Animaciones                             |
| Bun           | latest  | Package manager + build runner          |

### Infraestructura

| Componente                | Servicio AWS                          |
| ------------------------- | ------------------------------------- |
| Imágenes Docker           | ECR (Elastic Container Registry)      |
| Ejecución de contenedores | ECS Fargate (serverless, sin EC2)     |
| Base de datos             | RDS PostgreSQL 16 (Multi-AZ opcional) |
| Load Balancer             | ALB (Application Load Balancer)       |
| HTTPS                     | ACM (AWS Certificate Manager)         |
| DNS                       | Route 53                              |
| Secretos                  | SSM Parameter Store o Secrets Manager |
| Logs                      | CloudWatch Logs                       |

---

## 4. Estructura del repositorio

```
adma-sa2-sa3/
├── docker-compose.yml          # Stack completo para desarrollo local
├── README.md                   # Esta documentación
│
├── backend/                    # Spring Boot API
│   ├── Dockerfile              # Multi-stage: gradle:8.5-jdk21 → temurin:21-jre-alpine
│   ├── build.gradle
│   └── src/main/java/adma/sa2_sa3/backend/
│       ├── BackendApplication.java      # @EnableScheduling
│       ├── config/
│       │   ├── AppConfig.java           # base-url resolver
│       │   └── SecurityConfig.java      # JWT stateless, CORS, rutas públicas
│       ├── controller/
│       │   ├── AuthController.java      # POST /api/auth/register, /login
│       │   ├── ShortUrlController.java  # GET/POST/DELETE /api/urls
│       │   ├── RedirectController.java  # GET /{shortCode} — mide latencia
│       │   └── StatsController.java     # GET /api/stats — público
│       ├── domain/
│       │   ├── ShortUrl.java            # Entidad: LinkType, LinkStatus, analytics
│       │   └── User.java
│       ├── dto/
│       │   ├── ShortUrlResponse.java
│       │   ├── StatsResponse.java
│       │   └── ...
│       ├── exception/
│       │   ├── LinkExpiredException.java      # HTTP 410 Gone
│       │   ├── ResourceNotFoundException.java # HTTP 404
│       │   └── GlobalExceptionHandler.java
│       ├── repository/
│       │   ├── ShortUrlRepository.java  # JPQL aggregates + cleanup queries
│       │   └── UserRepository.java
│       ├── security/
│       │   ├── JwtTokenProvider.java
│       │   └── JwtAuthenticationFilter.java
│       └── service/
│           ├── ExpiredUrlCleanupService.java  # @Scheduled cada 15 min
│           └── impl/ShortUrlServiceImpl.java  # Welford avg, TTL, sync
│
└── frontend/                   # React SPA
    ├── Dockerfile              # Multi-stage: node:20-alpine → nginx:stable-alpine
    ├── nginx.conf              # SPA fallback + gzip
    └── src/
        ├── context/AuthContext.tsx      # JWT en localStorage, evento 401 global
        ├── hooks/use-stats.ts           # useStats() + useCountUp()
        ├── lib/
        │   ├── api.ts                   # Cliente HTTP centralizado
        │   └── localUrlStore.ts         # TTL 8h para URLs anónimas
        └── components/
            ├── UrlShortener.tsx         # Página principal
            ├── ShortenedUrlCard.tsx     # Card con analytics + delete
            └── StatsFooter.tsx          # Estadísticas en tiempo real
```

---

## 5. Variables de entorno

### Backend (runtime — inyectar en ECS Task Definition)

| Variable               | Obligatoria | Ejemplo                                    | Descripción                                   |
| ---------------------- | ----------- | ------------------------------------------ | --------------------------------------------- |
| `DB_HOST`              | ✅          | `my-rds.xxxxx.eu-west-1.rds.amazonaws.com` | Host de RDS                                   |
| `DB_PORT`              | ✅          | `5432`                                     | Puerto PostgreSQL                             |
| `DB_NAME`              | ✅          | `urlshortener`                             | Nombre de la base de datos                    |
| `DB_USERNAME`          | ✅          | `appuser`                                  | Usuario de la BD                              |
| `DB_PASSWORD`          | ✅          | _(secreto)_                                | Contraseña — usar SSM/Secrets Manager         |
| `JWT_SECRET`           | ✅          | _(mínimo 32 chars)_                        | Clave de firma JWT — usar SSM/Secrets Manager |
| `JWT_EXPIRATION_MS`    | —           | `86400000`                                 | Expiración del token (ms). Default: 24h       |
| `APP_BASE_URL`         | ✅          | `https://go.tudominio.com`                 | Base para construir URLs cortas               |
| `CORS_ALLOWED_ORIGINS` | ✅          | `https://tudominio.com`                    | Origins permitidos (CORS)                     |
| `SERVER_PORT`          | —           | `8080`                                     | Puerto de escucha. Default: 8080              |

### Frontend (build-time — pasar como `--build-arg` al construir la imagen)

| Variable            | Obligatoria | Ejemplo                     | Descripción                                                                                           |
| ------------------- | ----------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | ✅          | `https://api.tudominio.com` | URL base del backend. Se bake en el bundle JS en tiempo de build. **No se puede cambiar en runtime.** |

> ⚠️ **Crítico**: `VITE_API_BASE_URL` NO es una variable de entorno de ECS. Debe conocerse **antes de construir la imagen**. En CI/CD se pasa como `--build-arg`.

---

## 6. Desarrollo local (Docker Compose)

### Primera ejecución

```bash
# Desde la raíz del repo
cd adma-sa2-sa3

# Levantar todo (construye las imágenes si no existen)
docker compose up --build

# En background
docker compose up -d --build
```

### Resetear la base de datos (schema nuevo)

```bash
# Borra el volumen de postgres y recrea todo
docker compose down -v
docker compose up -d --build
```

### Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f backend
docker compose logs -f frontend

# Verificar estado
docker compose ps

# Parar todo
docker compose down

# Probar el API
curl http://localhost:8080/api/stats
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"password123"}'
```

### Acceso

- **Frontend**: http://localhost
- **Backend API**: http://localhost:8080
- **PostgreSQL**: localhost:5432 (usuario: `postgres`, contraseña: `changeme`)

---

## 7. Reglas de negocio

| Regla                   | Detalle                                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TTL anónimo**         | 8 horas exactas desde la creación. Valor en backend: `ANON_TTL_HOURS = 8`. Valor en frontend `localUrlStore.ts`: `TTL_MS = 8 * 60 * 60 * 1000`. Deben coincidir siempre.                                                     |
| **Links permanentes**   | Los usuarios autenticados crean links con `expiresAt = null` y `linkType = PERMANENT`. Nunca expiran.                                                                                                                        |
| **Expiración HTTP 410** | Un shortcode expirado devuelve `410 Gone`, no `404 Not Found`. Los crawlers interpretan 410 como "eliminado permanentemente".                                                                                                |
| **Cleanup automático**  | `ExpiredUrlCleanupService` corre cada 15 minutos. Primero marca como `EXPIRED`, luego borra. En AWS ECS, el servicio del backend debe tener `desiredCount = 1` para evitar que dos instancias corran el job simultáneamente. |
| **Sincronización**      | Al hacer login, los URLs anónimos del `localStorage` se envían a `POST /api/urls/sync`. El backend los reclama (cambia `userId`, `expiresAt = null`, `linkType = PERMANENT`) o crea entradas nuevas.                         |
| **Latencia Welford**    | La latencia media de redirección se actualiza con el algoritmo de Welford: `μₙ = μₙ₋₁ + (xₙ − μₙ₋₁) / n`. No requiere almacenar el historial.                                                                                |
| **Soft delete**         | Borrar un link establece `status = DELETED`. No se elimina físicamente de la BD hasta el siguiente ciclo de cleanup o manualmente.                                                                                           |

---

## 8. API Reference

Todos los endpoints están bajo `/api` excepto el redirect (`GET /{shortCode}`).

### Auth (público)

| Método | Ruta                 | Body                      | Respuesta              |
| ------ | -------------------- | ------------------------- | ---------------------- |
| `POST` | `/api/auth/register` | `{name, email, password}` | `{token, email, name}` |
| `POST` | `/api/auth/login`    | `{email, password}`       | `{token, email, name}` |

### URLs (autenticado — requiere `Authorization: Bearer <token>`)

| Método   | Ruta             | Body               | Respuesta        |
| -------- | ---------------- | ------------------ | ---------------- |
| `GET`    | `/api/urls`      | —                  | `ShortUrl[]`     |
| `POST`   | `/api/urls`      | `{originalUrl}`    | `ShortUrl`       |
| `DELETE` | `/api/urls/{id}` | —                  | `204 No Content` |
| `POST`   | `/api/urls/sync` | `{urls: string[]}` | `ShortUrl[]`     |

### URLs (anónimo — público)

| Método | Ruta               | Body            | Respuesta                    |
| ------ | ------------------ | --------------- | ---------------------------- |
| `POST` | `/api/urls/public` | `{originalUrl}` | `ShortUrl` (con `expiresAt`) |

### Redirect (público)

| Método | Ruta           | Respuesta                                      |
| ------ | -------------- | ---------------------------------------------- |
| `GET`  | `/{shortCode}` | `302 Found` → originalUrl / `404` / `410 Gone` |

### Stats (público)

| Método | Ruta         | Respuesta                                    |
| ------ | ------------ | -------------------------------------------- |
| `GET`  | `/api/stats` | `{totalLinks, totalRedirects, avgLatencyMs}` |

---

## 9. Migración a AWS

### 9.1 Prerrequisitos

Tener instalado y configurado:

```bash
# AWS CLI v2
aws --version
# aws-cli/2.x.x

# Configurar credenciales (o usar IAM Role en CI/CD)
aws configure
# AWS Access Key ID: ...
# AWS Secret Access Key: ...
# Default region name: eu-west-1   ← elige tu región
# Default output format: json
```

Permisos IAM mínimos necesarios para el despliegue:

- `AmazonECR_FullAccess`
- `AmazonECS_FullAccess`
- `AmazonRDSFullAccess`
- `ElasticLoadBalancingFullAccess`
- `AmazonSSMFullAccess`
- `AmazonVPCFullAccess`
- `IAMFullAccess` (para el Task Execution Role)

---

### 9.2 Diagrama de infraestructura

```
┌─────────────────────────────────────────────────────────────────────┐
│  VPC  10.0.0.0/16                                                   │
│                                                                     │
│  ┌─────────────────────┐    ┌─────────────────────┐                 │
│  │  Subnet pública A   │    │  Subnet pública B   │                 │
│  │  10.0.1.0/24        │    │  10.0.2.0/24        │                 │
│  │                     │    │                     │                 │
│  │  ┌───────────────┐  │    │                     │                 │
│  │  │      ALB      │  │    │                     │                 │
│  │  │  :80 → :443   │  │    │                     │                 │
│  │  └───────┬───────┘  │    │                     │                 │
│  └──────────┼──────────┘    └─────────────────────┘                 │
│             │                                                       │
│  ┌──────────┼──────────────────────────────────────┐                │
│  │  Subnet privada A          Subnet privada B     │                │
│  │  10.0.10.0/24              10.0.11.0/24         │                │
│  │                                                 │                │
│  │  ┌─────────────┐         ┌─────────────┐        │                │
│  │  │  ECS Task   │         │  ECS Task   │        │                │
│  │  │  frontend   │         │  backend    │        │                │
│  │  │  nginx:80   │         │  spring:8080│        │                │
│  │  └─────────────┘         └──────┬──────┘        │                │
│  │                                 │               │                │
│  │  ┌──────────────────────────────▼─────────────┐ │                │
│  │  │         RDS PostgreSQL 16                  │ │                │
│  │  │         (subnet privada — sin acceso       │ │                │
│  │  │          público desde internet)           │ │                │
│  │  └────────────────────────────────────────────┘ │                │
│  └─────────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
```

**Flujo de tráfico:**

1. Usuario → Route 53 → ALB puerto 443 (HTTPS)
2. ALB redirige HTTP 80 → HTTPS 443 automáticamente
3. ALB → Target Group frontend (nginx:80) para rutas `/`
4. ALB → Target Group backend (spring:8080) para rutas `/api/*` y `/{shortCode}`
5. Backend → RDS en subnet privada (solo accesible desde el SG del backend)

---

### 9.3 Paso 1 — Crear repositorios ECR

```bash
REGION="eu-west-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Crear repositorio para el backend
aws ecr create-repository \
  --repository-name adma/backend \
  --region $REGION \
  --image-scanning-configuration scanOnPush=true

# Crear repositorio para el frontend
aws ecr create-repository \
  --repository-name adma/frontend \
  --region $REGION \
  --image-scanning-configuration scanOnPush=true

echo "ECR base URL: $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
```

---

### 9.4 Paso 2 — Construir y subir las imágenes

```bash
REGION="eu-west-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_BASE="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

# Autenticar Docker contra ECR
aws ecr get-login-password --region $REGION \
  | docker login --username AWS --password-stdin $ECR_BASE

# ── Backend ──────────────────────────────────────────────────────────
cd backend

docker build \
  -t $ECR_BASE/adma/backend:latest \
  -t $ECR_BASE/adma/backend:$(git rev-parse --short HEAD) \
  .

docker push $ECR_BASE/adma/backend:latest
docker push $ECR_BASE/adma/backend:$(git rev-parse --short HEAD)

# ── Frontend ─────────────────────────────────────────────────────────
cd ../frontend

# ⚠️  VITE_API_BASE_URL se bake en el bundle — debe ser la URL final de producción
docker build \
  --build-arg VITE_API_BASE_URL=https://api.tudominio.com \
  -t $ECR_BASE/adma/frontend:latest \
  -t $ECR_BASE/adma/frontend:$(git rev-parse --short HEAD) \
  .

docker push $ECR_BASE/adma/frontend:latest
docker push $ECR_BASE/adma/frontend:$(git rev-parse --short HEAD)
```

> 💡 **Tip**: usa el hash del commit como tag además de `latest`. Así puedes hacer rollback fácilmente con `aws ecs update-service --force-new-deployment`.

---

### 9.5 Paso 3 — RDS PostgreSQL

```bash
# Crear subnet group para RDS (usa tus subnets privadas reales)
aws rds create-db-subnet-group \
  --db-subnet-group-name adma-rds-subnet-group \
  --db-subnet-group-description "ADMA RDS subnet group" \
  --subnet-ids subnet-AAAAAAAA subnet-BBBBBBBB

# Crear la instancia RDS
aws rds create-db-instance \
  --db-instance-identifier adma-postgres \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version "16.3" \
  --master-username appuser \
  --master-user-password "TU_PASSWORD_SEGURA" \
  --db-name urlshortener \
  --db-subnet-group-name adma-rds-subnet-group \
  --vpc-security-group-ids sg-RDS_SECURITY_GROUP \
  --no-publicly-accessible \
  --storage-type gp3 \
  --allocated-storage 20 \
  --backup-retention-period 7 \
  --deletion-protection
```

Una vez creada, obtén el endpoint:

```bash
aws rds describe-db-instances \
  --db-instance-identifier adma-postgres \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
# → adma-postgres.xxxxxxxx.eu-west-1.rds.amazonaws.com
```

---

### 9.6 Paso 4 — Secrets Manager / SSM Parameter Store

Nunca pongas secretos directamente en la Task Definition. Usa SSM:

```bash
# Contraseña de la BD
aws ssm put-parameter \
  --name "/adma/prod/DB_PASSWORD" \
  --value "TU_PASSWORD_SEGURA" \
  --type SecureString \
  --region eu-west-1

# Clave JWT (mínimo 32 caracteres, generada aleatoriamente)
aws ssm put-parameter \
  --name "/adma/prod/JWT_SECRET" \
  --value "$(openssl rand -base64 48)" \
  --type SecureString \
  --region eu-west-1
```

La Task Execution Role de ECS necesita permisos para leer estos parámetros:

```json
{
  "Effect": "Allow",
  "Action": ["ssm:GetParameters", "ssm:GetParameter"],
  "Resource": ["arn:aws:ssm:eu-west-1:ACCOUNT_ID:parameter/adma/prod/*"]
}
```

---

### 9.7 Paso 5 — ECS Cluster + Task Definitions

```bash
# Crear el cluster (Fargate — sin EC2)
aws ecs create-cluster \
  --cluster-name adma-cluster \
  --capacity-providers FARGATE \
  --region eu-west-1
```

Registrar las Task Definitions (ver JSON completo en [sección 9.13](#913-task-definition-json-completo)):

```bash
# Backend
aws ecs register-task-definition \
  --cli-input-json file://infrastructure/task-def-backend.json \
  --region eu-west-1

# Frontend
aws ecs register-task-definition \
  --cli-input-json file://infrastructure/task-def-frontend.json \
  --region eu-west-1
```

---

### 9.8 Paso 6 — Application Load Balancer

```bash
# Crear el ALB (subnets públicas)
aws elbv2 create-load-balancer \
  --name adma-alb \
  --subnets subnet-PUBLICA-A subnet-PUBLICA-B \
  --security-groups sg-ALB \
  --scheme internet-facing \
  --type application

# Target group para el frontend (nginx:80)
aws elbv2 create-target-group \
  --name adma-frontend-tg \
  --protocol HTTP \
  --port 80 \
  --vpc-id vpc-XXXXXXXX \
  --target-type ip \
  --health-check-path "/"

# Target group para el backend (spring:8080)
aws elbv2 create-target-group \
  --name adma-backend-tg \
  --protocol HTTP \
  --port 8080 \
  --vpc-id vpc-XXXXXXXX \
  --target-type ip \
  --health-check-path "/actuator/health"

# Listener HTTPS (puerto 443) — con reglas de routing
# Regla 1: rutas /api/* y /{shortCode} → backend
# Regla 2 (default): todo lo demás → frontend
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:eu-west-1:ACCOUNT:certificate/XXXX \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:.../adma-frontend-tg

# Regla de routing: /api/* → backend
aws elbv2 create-rule \
  --listener-arn arn:aws:elasticloadbalancing:... \
  --priority 10 \
  --conditions '[{"Field":"path-pattern","Values":["/api/*"]}]' \
  --actions Type=forward,TargetGroupArn=arn:...adma-backend-tg

# Regla de routing: shortcodes /{4-10 chars} → backend
aws elbv2 create-rule \
  --listener-arn arn:aws:elasticloadbalancing:... \
  --priority 20 \
  --conditions '[{"Field":"path-pattern","Values":["/?????","/??????????"]}]' \
  --actions Type=forward,TargetGroupArn=arn:...adma-backend-tg

# Listener HTTP (80) → redirige a HTTPS
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTP \
  --port 80 \
  --default-actions \
    Type=redirect,\
    RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'
```

---

### 9.9 Paso 7 — ECS Services

```bash
# Servicio backend (desiredCount=1 — importante para el job de cleanup)
aws ecs create-service \
  --cluster adma-cluster \
  --service-name adma-backend \
  --task-definition adma-backend:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration \
    "awsvpcConfiguration={
       subnets=[subnet-PRIVADA-A,subnet-PRIVADA-B],
       securityGroups=[sg-BACKEND],
       assignPublicIp=DISABLED
     }" \
  --load-balancers \
    "targetGroupArn=arn:...adma-backend-tg,
     containerName=backend,
     containerPort=8080"

# Servicio frontend (puede escalar horizontalmente)
aws ecs create-service \
  --cluster adma-cluster \
  --service-name adma-frontend \
  --task-definition adma-frontend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration \
    "awsvpcConfiguration={
       subnets=[subnet-PRIVADA-A,subnet-PRIVADA-B],
       securityGroups=[sg-FRONTEND],
       assignPublicIp=DISABLED
     }" \
  --load-balancers \
    "targetGroupArn=arn:...adma-frontend-tg,
     containerName=frontend,
     containerPort=80"
```

> ⚠️ `desiredCount=1` en el backend es **intencionado**: el `ExpiredUrlCleanupService` usa `@Scheduled` dentro del JVM. Si hubiera dos instancias, el job se ejecutaría dos veces. En el futuro, si necesitas escalar el backend, migra el job a un ECS Scheduled Task separado o usa Quartz con bloqueo en BD.

---

### 9.10 Paso 8 — HTTPS con ACM

```bash
# Solicitar certificado (validación por DNS)
aws acm request-certificate \
  --domain-name tudominio.com \
  --subject-alternative-names "*.tudominio.com" \
  --validation-method DNS \
  --region eu-west-1
```

Tras solicitar el certificado, AWS te dará un registro CNAME que debes añadir en Route 53. Una vez validado, úsalo en el listener HTTPS del ALB (paso 9.8).

---

### 9.11 Paso 9 — Variables de entorno en producción

En la Task Definition del backend, las variables de entorno se definen así:

```json
"environment": [
  { "name": "DB_HOST",              "value": "adma-postgres.xxxxx.eu-west-1.rds.amazonaws.com" },
  { "name": "DB_PORT",              "value": "5432" },
  { "name": "DB_NAME",              "value": "urlshortener" },
  { "name": "DB_USERNAME",          "value": "appuser" },
  { "name": "APP_BASE_URL",         "value": "https://go.tudominio.com" },
  { "name": "CORS_ALLOWED_ORIGINS", "value": "https://tudominio.com" },
  { "name": "SERVER_PORT",          "value": "8080" }
],
"secrets": [
  {
    "name": "DB_PASSWORD",
    "valueFrom": "arn:aws:ssm:eu-west-1:ACCOUNT:parameter/adma/prod/DB_PASSWORD"
  },
  {
    "name": "JWT_SECRET",
    "valueFrom": "arn:aws:ssm:eu-west-1:ACCOUNT:parameter/adma/prod/JWT_SECRET"
  }
]
```

---

### 9.12 Security Groups

Crea 3 security groups en tu VPC:

#### `sg-ALB` — Application Load Balancer

| Dirección | Protocolo | Puerto | Origen      |
| --------- | --------- | ------ | ----------- |
| Inbound   | TCP       | 80     | `0.0.0.0/0` |
| Inbound   | TCP       | 443    | `0.0.0.0/0` |
| Outbound  | All       | All    | `0.0.0.0/0` |

#### `sg-FRONTEND` — Contenedor Nginx

| Dirección | Protocolo | Puerto | Origen                                           |
| --------- | --------- | ------ | ------------------------------------------------ |
| Inbound   | TCP       | 80     | `sg-ALB`                                         |
| Outbound  | TCP       | 443    | `0.0.0.0/0` (para llamadas salientes si las hay) |

#### `sg-BACKEND` — Contenedor Spring Boot

| Dirección | Protocolo | Puerto | Origen                             |
| --------- | --------- | ------ | ---------------------------------- |
| Inbound   | TCP       | 8080   | `sg-ALB`                           |
| Outbound  | TCP       | 5432   | `sg-RDS`                           |
| Outbound  | TCP       | 443    | `0.0.0.0/0` (para SSM, CloudWatch) |

#### `sg-RDS` — PostgreSQL

| Dirección | Protocolo | Puerto | Origen       |
| --------- | --------- | ------ | ------------ |
| Inbound   | TCP       | 5432   | `sg-BACKEND` |

---

### 9.13 Task Definition JSON completo

Guarda estos archivos en `infrastructure/` dentro del repositorio.

#### `infrastructure/task-def-backend.json`

```json
{
  "family": "adma-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "ACCOUNT_ID.dkr.ecr.eu-west-1.amazonaws.com/adma/backend:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8080,
          "hostPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DB_HOST",
          "value": "adma-postgres.xxxxx.eu-west-1.rds.amazonaws.com"
        },
        { "name": "DB_PORT", "value": "5432" },
        { "name": "DB_NAME", "value": "urlshortener" },
        { "name": "DB_USERNAME", "value": "appuser" },
        { "name": "APP_BASE_URL", "value": "https://go.tudominio.com" },
        { "name": "CORS_ALLOWED_ORIGINS", "value": "https://tudominio.com" },
        { "name": "SERVER_PORT", "value": "8080" },
        { "name": "JWT_EXPIRATION_MS", "value": "86400000" }
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:ssm:eu-west-1:ACCOUNT_ID:parameter/adma/prod/DB_PASSWORD"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:ssm:eu-west-1:ACCOUNT_ID:parameter/adma/prod/JWT_SECRET"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/adma-backend",
          "awslogs-region": "eu-west-1",
          "awslogs-stream-prefix": "backend"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:8080/actuator/health || exit 1"
        ],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

#### `infrastructure/task-def-frontend.json`

```json
{
  "family": "adma-frontend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "frontend",
      "image": "ACCOUNT_ID.dkr.ecr.eu-west-1.amazonaws.com/adma/frontend:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 80,
          "hostPort": 80,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/adma-frontend",
          "awslogs-region": "eu-west-1",
          "awslogs-stream-prefix": "frontend"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:80/ || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 10
      }
    }
  ]
}
```

> **Sustituye** todos los valores `ACCOUNT_ID`, `xxxxx`, `tudominio.com` por los reales antes de registrar las Task Definitions.

---

## 10. CI/CD con GitHub Actions

Crea el fichero `.github/workflows/deploy.yml`:

```yaml
name: Build & Deploy to AWS ECS

on:
  push:
    branches: [main]

env:
  AWS_REGION: eu-west-1
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.eu-west-1.amazonaws.com
  BACKEND_IMAGE: adma/backend
  FRONTEND_IMAGE: adma/frontend

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write # Para OIDC (recomendado sobre access keys)
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/github-actions-role
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build & push backend
        run: |
          docker build \
            -t $ECR_REGISTRY/$BACKEND_IMAGE:${{ github.sha }} \
            -t $ECR_REGISTRY/$BACKEND_IMAGE:latest \
            ./backend
          docker push $ECR_REGISTRY/$BACKEND_IMAGE:${{ github.sha }}
          docker push $ECR_REGISTRY/$BACKEND_IMAGE:latest

      - name: Build & push frontend
        run: |
          docker build \
            --build-arg VITE_API_BASE_URL=${{ secrets.VITE_API_BASE_URL }} \
            -t $ECR_REGISTRY/$FRONTEND_IMAGE:${{ github.sha }} \
            -t $ECR_REGISTRY/$FRONTEND_IMAGE:latest \
            ./frontend
          docker push $ECR_REGISTRY/$FRONTEND_IMAGE:${{ github.sha }}
          docker push $ECR_REGISTRY/$FRONTEND_IMAGE:latest

      - name: Deploy backend to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: infrastructure/task-def-backend.json
          service: adma-backend
          cluster: adma-cluster
          wait-for-service-stability: true

      - name: Deploy frontend to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: infrastructure/task-def-frontend.json
          service: adma-frontend
          cluster: adma-cluster
          wait-for-service-stability: true
```

**Secrets de GitHub** necesarios (Settings → Secrets → Actions):
| Secret | Valor |
|---|---|
| `AWS_ACCOUNT_ID` | Tu ID de cuenta AWS (12 dígitos) |
| `VITE_API_BASE_URL` | `https://api.tudominio.com` |

---

## 11. Checklist de producción

Antes del primer despliegue en producción, revisa:

- [ ] `JWT_SECRET` es aleatorio (≥ 32 chars) y está en SSM `SecureString`, **no** en el código
- [ ] `DB_PASSWORD` está en SSM `SecureString`
- [ ] `ddl-auto` cambiado de `update` a `validate` en `application.yml` (usar Flyway para migraciones controladas)
- [ ] RDS con `deletion-protection` activado
- [ ] RDS sin acceso público (`no-publicly-accessible`)
- [ ] ALB redirige HTTP 80 → HTTPS 443
- [ ] Certificado ACM válido y asociado al listener 443
- [ ] `CORS_ALLOWED_ORIGINS` apunta solo a tu dominio de producción (no localhost)
- [ ] `APP_BASE_URL` apunta al dominio de producción (para generar las URLs cortas correctas)
- [ ] `VITE_API_BASE_URL` en el build de la imagen frontend apunta a la URL del ALB/backend
- [ ] Security groups revisados: RDS solo acepta conexiones desde `sg-BACKEND`
- [ ] CloudWatch Log Groups creados: `/ecs/adma-backend` y `/ecs/adma-frontend`
- [ ] Task Execution Role tiene permisos para leer SSM y escribir CloudWatch
- [ ] Backend `desiredCount=1` (por el `@Scheduled` cleanup job)
- [ ] Health checks configurados en los Target Groups del ALB
- [ ] Imágenes ECR con tag por commit SHA (no solo `latest`) para rollbacks
