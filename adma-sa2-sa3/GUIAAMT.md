# GUÍA DE DESPLIEGUE — ADMA SA2/SA3

Guía completa para construir las imágenes Docker, subirlas a ECR y desplegar/destruir la infraestructura en AWS con Terraform.

---

## Índice

1. [Prerrequisitos](#1-prerrequisitos)
2. [Arquitectura de routing](#2-arquitectura-de-routing)
3. [Build y push a ECR](#3-build-y-push-a-ecr)
   - [Frontend](#31-frontend)
   - [Backend](#32-backend)
4. [Desplegar la infraestructura](#4-desplegar-la-infraestructura)
5. [Verificar que todo funciona](#5-verificar-que-todo-funciona)
6. [Destruir la infraestructura](#6-destruir-la-infraestructura)
7. [Ciclo completo: destroy → build → deploy](#7-ciclo-completo-destroy--build--deploy)
8. [Solución de problemas frecuentes](#8-solución-de-problemas-frecuentes)

---

## 1. Prerrequisitos

Asegúrate de tener instalado y configurado:

```bash
# Versiones mínimas requeridas
aws --version          # >= 2.x
terraform --version    # >= 1.5
docker --version       # >= 24.x
bun --version          # >= 1.x  (o node >= 20)
java --version         # >= 21   (solo para builds locales del backend)
```

Credenciales AWS activas con permisos sobre ECS, ECR, RDS, ALB, VPC e IAM:

```bash
aws sts get-caller-identity   # debe devolver tu cuenta y ARN
```

---

## 2. Arquitectura de routing

El ALB gestiona todo el routing. El frontend (nginx) es solo un servidor estático de la SPA.

```
Internet
   │
   ▼
ALB (puerto 80)
   ├── Priority 10 → /api/*  /auth/*            → Backend ECS (8080)
   ├── Priority 20 → /  /login  /register        → Frontend ECS (80)
   │                  /r/*  /assets/*
   ├── Priority 30 → /*  (short codes ej: /D4gZeT) → Backend ECS (8080)
   └── Default     →                              → Frontend ECS (80)

Frontend (nginx): sirve solo la SPA React (try_files $uri /index.html)
Backend (Spring Boot 8080): maneja /api/*, /auth/*, /{shortCode}
RDS PostgreSQL (5432): accesible solo desde backend_sg, subredes privadas
```

> **Importante:** El nginx del frontend **NO hace proxy** hacia el backend. Todo el enrutamiento lo hace el ALB mediante reglas de prioridad.

---

## 3. Build y push a ECR

### Repositorios ECR

| Servicio | ECR Public URI                                 |
| -------- | ---------------------------------------------- |
| Frontend | `public.ecr.aws/a1v1u4e4/adma/frontend:latest` |
| Backend  | `public.ecr.aws/a1v1u4e4/adma/backend:latest`  |

### Login en ECR público

```bash
aws ecr-public get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin public.ecr.aws
```

> ⚠️ ECR **público** siempre requiere autenticarse desde **`us-east-1`**, independientemente de la región donde esté tu infraestructura.

---

### 3.1 Frontend

#### Parámetros del build

| Parámetro           | Tipo          | Valor para este proyecto             | Descripción                                                                                                                                                                     |
| ------------------- | ------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | `--build-arg` | `""` (cadena vacía, **por defecto**) | URL base de la API. Vacío = rutas relativas (`/api/...`), que el navegador resuelve contra el mismo origen (ALB). **No cambiar** salvo que la API esté en un dominio diferente. |

> ✅ **No es necesario pasar `--build-arg`**. El valor por defecto `""` es correcto para este proyecto porque el frontend y el backend comparten el mismo ALB. Las llamadas `/api/...` y `/auth/...` se resuelven automáticamente contra el origen que sirve la página.

#### Comandos

```bash
cd adma-sa2-sa3/frontend

# Build (sin build-arg — usa el valor por defecto "")
docker build \
  --platform linux/amd64 \
  -t public.ecr.aws/a1v1u4e4/adma/frontend:latest \
  .

# Push a ECR
docker push public.ecr.aws/a1v1u4e4/adma/frontend:latest
```

> 💡 `--platform linux/amd64` es obligatorio si compilas desde un Mac con Apple Silicon (M1/M2/M3), ya que ECS Fargate usa `x86_64`.

---

### 3.2 Backend

#### Parámetros del build

El backend **no necesita ningún `--build-arg`**. Toda la configuración (URL de la BD, secreto JWT, CORS, etc.) se inyecta como **variables de entorno en runtime** por la task definition de ECS, no en el build.

| Variable de entorno     | Dónde se configura              | Valor                                         |
| ----------------------- | ------------------------------- | --------------------------------------------- |
| `SPRING_DATASOURCE_URL` | ECS task definition (Terraform) | `jdbc:postgresql://<rds-endpoint>:5432/appdb` |
| `DB_HOST`               | ECS task definition             | `<rds-endpoint>` (auto desde Terraform)       |
| `DB_PORT`               | ECS task definition             | `5432`                                        |
| `DB_NAME`               | ECS task definition             | `appdb`                                       |
| `DB_USERNAME`           | ECS task definition             | `appuser`                                     |
| `DB_PASSWORD`           | `terraform.tfvars`              | `password123`                                 |
| `JWT_SECRET`            | `terraform.tfvars`              | mín. 32 chars                                 |
| `CORS_ALLOWED_ORIGINS`  | ECS task definition             | `http://<alb-dns>` (auto desde Terraform)     |
| `SERVER_PORT`           | ECS task definition             | `8080`                                        |

> ✅ **No pasar ningún `--build-arg`** al build del backend.

#### Comandos

```bash
cd adma-sa2-sa3/backend

# Build
docker build \
  --platform linux/amd64 \
  -t public.ecr.aws/a1v1u4e4/adma/backend:latest \
  .

# Push a ECR
docker push public.ecr.aws/a1v1u4e4/adma/backend:latest
```

> ⏱️ El build del backend es lento (~3-5 min) porque descarga dependencias de Gradle. En builds sucesivos se aprovecha el caché de Docker si no cambia `build.gradle`.

---

## 4. Desplegar la infraestructura

### 4.1 Verificar `terraform.tfvars`

Fichero: `adma-sa2-sa3/terraform/terraform.tfvars`

```hcl
environment = "demo"

frontend_image = "public.ecr.aws/a1v1u4e4/adma/frontend:latest"
backend_image  = "public.ecr.aws/a1v1u4e4/adma/backend:latest"

db_pass    = "password123"
jwt_secret = "changeme-replace-this-with-a-real-secret!!"
```

> ⚠️ `jwt_secret` debe tener **mínimo 32 caracteres**.

### 4.2 Inicializar Terraform (solo la primera vez o tras borrar `.terraform/`)

```bash
cd adma-sa2-sa3/terraform
terraform init
```

### 4.3 Plan (opcional, para ver qué se va a crear)

```bash
terraform plan
```

### 4.4 Apply completo

```bash
terraform apply -auto-approve
```

> ⏱️ El proceso tarda unos **5-8 minutos**. La RDS tarda más en arrancar. El backend esperará a que la BD esté disponible antes de considerarse healthy.

### 4.5 Obtener la URL de la aplicación

```bash
terraform output app_url
```

La salida será algo como:

```
http://adma-sa2-sa3-alb-XXXXXXXXXX.eu-south-2.elb.amazonaws.com
```

---

## 5. Verificar que todo funciona

```bash
ALB_DNS=$(terraform output -raw alb_dns)

# Frontend (debe devolver 200 con Server: nginx)
curl -s -o /dev/null -w "%{http_code}" "http://$ALB_DNS/"

# Login y Register (SPA, debe devolver 200)
curl -s -o /dev/null -w "%{http_code}" "http://$ALB_DNS/login"
curl -s -o /dev/null -w "%{http_code}" "http://$ALB_DNS/register"

# API de estadísticas (debe devolver 200 con JSON)
curl -s "http://$ALB_DNS/api/stats"

# Short code redirect (debe devolver 302 hacia la URL original)
# Sustituye D4gZeDT por un short code real de tu BD
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}" \
  "http://$ALB_DNS/D4gZeDT"
```

Resultados esperados:
| Endpoint | Código esperado |
|------------------|-----------------|
| `/` | `200` |
| `/login` | `200` |
| `/register` | `200` |
| `/api/stats` | `200` |
| `/<shortCode>` | `302` |

---

## 6. Destruir la infraestructura

```bash
cd adma-sa2-sa3/terraform
terraform destroy -auto-approve
```

> ⏱️ Tarda unos **5-10 minutos**. La RDS puede tardar más en eliminarse.
>
> ⚠️ Esto elimina **todos los datos** de la base de datos. `skip_final_snapshot = true` está activado intencionalmente para el entorno demo.

---

## 7. Ciclo completo: destroy → build → deploy

Este es el flujo completo cuando quieres empezar desde cero (por ejemplo, para entregar o hacer una demo limpia):

```bash
# ─── 0. Situarse en la raíz del proyecto ───────────────────────────────────
cd adma-sa2-sa3

# ─── 1. Login en ECR público ────────────────────────────────────────────────
aws ecr-public get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin public.ecr.aws

# ─── 2. Build y push del Frontend ───────────────────────────────────────────
cd frontend
docker build --platform linux/amd64 \
  -t public.ecr.aws/a1v1u4e4/adma/frontend:latest .
docker push public.ecr.aws/a1v1u4e4/adma/frontend:latest
cd ..

# ─── 3. Build y push del Backend ────────────────────────────────────────────
cd backend
docker build --platform linux/amd64 \
  -t public.ecr.aws/a1v1u4e4/adma/backend:latest .
docker push public.ecr.aws/a1v1u4e4/adma/backend:latest
cd ..

# ─── 4. Destruir infraestructura anterior (si existe) ───────────────────────
cd terraform
terraform destroy -auto-approve
cd ..

# ─── 5. Desplegar infraestructura nueva ─────────────────────────────────────
cd terraform
terraform init   # solo necesario si es la primera vez o se borró .terraform/
terraform apply -auto-approve

# ─── 6. Obtener URL de la aplicación ────────────────────────────────────────
terraform output app_url
```

---

## 8. Solución de problemas frecuentes

### Backend no arranca: `SocketTimeoutException` / `HikariPool - Connection is not available`

**Causa:** Drift de estado de Terraform — la regla de egress al puerto 5432 no está aplicada en AWS.

```bash
# Forzar re-aplicación de las reglas de seguridad de BD
terraform apply \
  -target=aws_security_group_rule.backend_to_db \
  -target=aws_security_group_rule.db_from_backend \
  -auto-approve

# Reiniciar el servicio backend
aws ecs update-service \
  --cluster adma-sa2-sa3-cluster \
  --service backend-service \
  --force-new-deployment \
  --region eu-south-2
```

---

### Short codes devuelven 403

**Causa:** Spring Security bloqueando `/{shortCode}`.

Verificar en `SecurityConfig.java` que el matcher sea **sin regex**:

```java
// ✅ Correcto
.requestMatchers(HttpMethod.GET, "/{shortCode}").permitAll()

// ❌ Incorrecto — Spring Security no soporta regex en AntPathMatcher
.requestMatchers(HttpMethod.GET, "/{shortCode:[a-zA-Z0-9]{4,10}}").permitAll()
```

---

### El navegador muestra 403 en `/` tras un cambio

**Causa:** Caché del navegador con la respuesta anterior.

```
Mac:     Cmd + Shift + R
Windows: Ctrl + Shift + R
O abrir en ventana privada/incógnito
```

---

### Logs del backend en CloudWatch

```bash
aws logs tail /ecs/adma-sa2-sa3/backend \
  --region eu-south-2 \
  --follow \
  --format short
```

### Logs del frontend en CloudWatch

```bash
aws logs tail /ecs/adma-sa2-sa3/frontend \
  --region eu-south-2 \
  --follow \
  --format short
```

---

### Ver tasks ECS activas

```bash
# Listar servicios
aws ecs list-services \
  --cluster adma-sa2-sa3-cluster \
  --region eu-south-2

# Ver estado del backend
aws ecs describe-services \
  --cluster adma-sa2-sa3-cluster \
  --services backend-service \
  --region eu-south-2 \
  --query 'services[0].{running:runningCount,desired:desiredCount,events:events[:3][].message}'
```

---

### Terraform: sincronizar estado con AWS (evitar drifts)

Tras varios `apply --target`, hacer siempre un apply completo para sincronizar:

```bash
cd adma-sa2-sa3/terraform
terraform plan    # ver qué hay pendiente
terraform apply -auto-approve
```
