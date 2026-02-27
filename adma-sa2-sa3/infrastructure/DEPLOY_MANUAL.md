# Despliegue manual — ECR + ECS Fargate

Guía paso a paso para subir las imágenes a ECR y configurar Fargate sin automatizaciones.

> **Requisitos previos**
>
> - AWS CLI v2 instalado y configurado (`aws configure`)
> - Docker Desktop en ejecución
> - Tu cuenta AWS tiene los permisos necesarios (ECR, ECS, RDS, IAM, SSM, ELB)

---

## Variables que usarás en todos los comandos

Edita estos valores antes de empezar y expórtalos en tu terminal. Así solo los escribes una vez.

```bash
export AWS_REGION="eu-south-2"                        # tu región
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_BASE="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
export APP_DOMAIN="tudominio.com"                     # tu dominio final
export API_URL="https://api.$APP_DOMAIN"              # URL pública del backend
```

Verifica que funciona:

```bash
echo $ACCOUNT_ID   # debe imprimir tu ID de cuenta (12 dígitos)
echo $ECR_BASE     # 912390896205.dkr.ecr.eu-south-2.amazonaws.com
```

---

## PARTE 1 — ECR: Crear repositorios y subir imágenes

### Paso 1 · Crear los repositorios en ECR

```bash
# Repositorio del backend
aws ecr create-repository \
  --repository-name adma/backend \
  --region $AWS_REGION \
  --image-scanning-configuration scanOnPush=true

# Repositorio del frontend
aws ecr create-repository \
  --repository-name adma/frontend \
  --region $AWS_REGION \
  --image-scanning-configuration scanOnPush=true
```

Verifica en la consola AWS → ECR → Repositories que aparecen `adma/backend` y `adma/frontend`.

---

### Paso 2 · Autenticar Docker contra ECR

Este token caduca en 12 horas. Repítelo si ves errores de autenticación.

```bash
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $ECR_BASE
```

Respuesta esperada: `Login Succeeded`

---

### Paso 3 · Construir y subir la imagen del backend

```bash
cd /ruta/a/adma-sa2-sa3/backend

docker build \
  -t $ECR_BASE/adma/backend:latest \
  .

docker push $ECR_BASE/adma/backend:latest
```

---

### Paso 4 · Construir y subir la imagen del frontend

⚠️ `VITE_API_BASE_URL` se **hornea** en el bundle JavaScript en este momento.
Debe ser la URL pública definitiva del backend. Si la cambias, tienes que reconstruir y volver a subir.

```bash
cd /ruta/a/adma-sa2-sa3/frontend

docker build \
  --build-arg VITE_API_BASE_URL=$API_URL \
  -t $ECR_BASE/adma/frontend:latest \
  .

docker push $ECR_BASE/adma/frontend:latest
```

Verifica en la consola AWS → ECR → adma/backend y adma/frontend que aparece la imagen con la etiqueta `latest`.

---

## PARTE 2 — RDS: Base de datos PostgreSQL

### Paso 5 · Crear la base de datos en RDS

En la consola AWS → RDS → Create database:

| Campo                  | Valor                                 |
| ---------------------- | ------------------------------------- |
| Engine                 | PostgreSQL 16                         |
| Template               | Free tier (para pruebas) o Production |
| DB instance identifier | `adma-postgres`                       |
| Master username        | `appuser`                             |
| Master password        | Una contraseña segura (guárdala)      |
| DB name                | `urlshortener`                        |
| Public access          | **No**                                |
| VPC security group     | Crea uno nuevo: `sg-rds`              |

Tras crear la instancia (tarda ~5 min), anota el **Endpoint**:

```
adma-postgres.xxxxxxxx.eu-west-1.rds.amazonaws.com
```

---

## PARTE 3 — SSM: Almacenar los secretos

### Paso 6 · Guardar la contraseña de BD y JWT en SSM Parameter Store

Nunca pongas estos valores directamente en la Task Definition.

```bash
# Contraseña de la base de datos
aws ssm put-parameter \
  --name "/adma/prod/DB_PASSWORD" \
  --value "TU_PASSWORD_DE_RDS" \
  --type SecureString \
  --region $AWS_REGION

# Clave JWT — genera una aleatoria de 48 bytes en base64
aws ssm put-parameter \
  --name "/adma/prod/JWT_SECRET" \
  --value "$(openssl rand -base64 48)" \
  --type SecureString \
  --region $AWS_REGION
```

Verifica en la consola AWS → Systems Manager → Parameter Store que aparecen los dos parámetros con el candado (SecureString).

---

## PARTE 4 — IAM: Roles para ECS

### Paso 7 · Crear el Task Execution Role

Este rol permite a ECS leer las imágenes de ECR, escribir logs en CloudWatch y leer los secretos de SSM.

En la consola AWS → IAM → Roles → Create role:

1. **Trusted entity**: `AWS service` → `Elastic Container Service Task`
2. **Attach policies**:
   - `AmazonECSTaskExecutionRolePolicy` (política gestionada de AWS)
3. **Name**: `ecsTaskExecutionRole`

Luego añade esta política inline para leer los secretos SSM:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameters", "ssm:GetParameter"],
      "Resource": "arn:aws:ssm:eu-south-2:ACCOUNT_ID:parameter/adma/prod/*"
    }
  ]
}
```

(Sustituye `ACCOUNT_ID` por tu ID real de 12 dígitos)

---

## PARTE 5 — ECS: Cluster y Task Definitions

### Paso 8 · Crear el Cluster ECS

En la consola AWS → ECS → Clusters → Create cluster:

| Campo          | Valor                        |
| -------------- | ---------------------------- |
| Cluster name   | `adma-cluster`               |
| Infrastructure | **AWS Fargate (serverless)** |

---

### Paso 8b · Crear la tabla ShedLock en RDS

El backend usa **ShedLock** para garantizar que el job de limpieza automática (`@Scheduled`) se ejecute en **una sola instancia** aunque el servicio escale horizontalmente. Antes del primer despliegue debes crear la tabla en tu base de datos RDS.

Conéctate a tu instancia RDS (a través de un bastion host o un cliente SQL con acceso a la VPC) y ejecuta:

```sql
CREATE TABLE IF NOT EXISTS shedlock (
    name       VARCHAR(64)  NOT NULL,
    lock_until TIMESTAMP    NOT NULL,
    locked_at  TIMESTAMP    NOT NULL,
    locked_by  VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
);
```

El fichero también está disponible en `backend/src/main/resources/db/shedlock.sql`.

> ℹ️ En entorno local (`docker compose up`) esta tabla se crea automáticamente gracias a `spring.sql.init`. En producción con RDS la debes crear manualmente una única vez.

---

### Paso 9 · Registrar la Task Definition del backend

1. Abre `infrastructure/task-def-backend.json` del repositorio
2. Sustituye los siguientes valores:

| Placeholder                                        | Valor real                                     |
| -------------------------------------------------- | ---------------------------------------------- |
| `ACCOUNT_ID`                                       | Tu ID de cuenta (12 dígitos) — aparece 3 veces |
| `adma-postgres.xxxxx.eu-south-2.rds.amazonaws.com` | El endpoint de tu RDS (Paso 5)                 |
| `https://go.tudominio.com`                         | Tu dominio final para las URLs cortas          |
| `https://tudominio.com`                            | Tu dominio del frontend (para CORS)            |

3. Registra la Task Definition:

```bash
aws ecs register-task-definition \
  --cli-input-json file://infrastructure/task-def-backend.json \
  --region $AWS_REGION
```

---

### Paso 10 · Registrar la Task Definition del frontend

1. Abre `infrastructure/task-def-frontend.json`
2. Sustituye `ACCOUNT_ID` por tu ID real
3. Registra:

```bash
aws ecs register-task-definition \
  --cli-input-json file://infrastructure/task-def-frontend.json \
  --region $AWS_REGION
```

Verifica en la consola AWS → ECS → Task Definitions que aparecen `adma-backend:1` y `adma-frontend:1`.

---

## PARTE 6 — ALB: Load Balancer

### Paso 11 · Crear el Application Load Balancer

En la consola AWS → EC2 → Load Balancers → Create → Application Load Balancer:

| Campo           | Valor                                                |
| --------------- | ---------------------------------------------------- |
| Name            | `adma-alb`                                           |
| Scheme          | **Internet-facing**                                  |
| IP address type | IPv4                                                 |
| VPC             | Tu VPC                                               |
| Subnets         | Selecciona **2 subnets públicas** (en AZs distintas) |
| Security group  | `sg-alb` (ver abajo)                                 |

**Security group `sg-alb`** — crea uno con estas reglas de entrada:

- TCP 80 desde `0.0.0.0/0`
- TCP 443 desde `0.0.0.0/0`

---

### Paso 12 · Crear los Target Groups

**Target Group del frontend:**

AWS → EC2 → Target Groups → Create:

| Campo             | Valor              |
| ----------------- | ------------------ |
| Target type       | **IP addresses**   |
| Name              | `adma-frontend-tg` |
| Protocol          | HTTP               |
| Port              | 80                 |
| VPC               | Tu VPC             |
| Health check path | `/`                |

**Target Group del backend:**

| Campo             | Valor              |
| ----------------- | ------------------ |
| Target type       | **IP addresses**   |
| Name              | `adma-backend-tg`  |
| Protocol          | HTTP               |
| Port              | 8080               |
| VPC               | Tu VPC             |
| Health check path | `/actuator/health` |

> No añadas targets manualmente — ECS los registra automáticamente cuando arrancan las tasks.

---

### Paso 13 · Configurar los Listeners del ALB

**Listener HTTP :80** — redirige todo a HTTPS:

En el ALB → Listeners → Add listener:

- Protocol: HTTP, Port: 80
- Default action: **Redirect to HTTPS** (301)

**Listener HTTPS :443** — enruta según la ruta:

- Protocol: HTTPS, Port: 443
- Certificate: selecciona el de ACM (si ya lo tienes; si no, ve al Paso 14 primero)
- Default action: Forward to `adma-frontend-tg`

Añade estas **reglas de routing** (en orden):

| Prioridad | Condición                                                | Destino            |
| --------- | -------------------------------------------------------- | ------------------ |
| 10        | Path is `/api/*`                                         | `adma-backend-tg`  |
| 20        | Path is `/?????` o `/??????????` (shortcodes 4-10 chars) | `adma-backend-tg`  |
| Default   | (cualquier otra ruta)                                    | `adma-frontend-tg` |

---

### Paso 14 · Certificado HTTPS con ACM (opcional pero recomendado)

```bash
aws acm request-certificate \
  --domain-name $APP_DOMAIN \
  --subject-alternative-names "*.$APP_DOMAIN" \
  --validation-method DNS \
  --region $AWS_REGION
```

AWS te dará un registro CNAME → añádelo en tu proveedor DNS.
Una vez validado (5-30 min), asócialo al Listener 443 del ALB.

---

## PARTE 7 — ECS Services: arrancar los contenedores

### Paso 15 · Security Groups para los contenedores

Crea dos security groups adicionales:

**`sg-backend`:**

- Inbound TCP 8080 desde `sg-alb`
- Outbound TCP 5432 hacia `sg-rds` (el SG de tu RDS)
- Outbound TCP 443 hacia `0.0.0.0/0` (para SSM y CloudWatch)

**`sg-frontend`:**

- Inbound TCP 80 desde `sg-alb`
- Outbound TCP 443 hacia `0.0.0.0/0`

**`sg-rds`** (modificar el que creaste en el Paso 5):

- Inbound TCP 5432 **solo desde `sg-backend`** — bloquea cualquier otro origen

---

### Paso 16 · Crear el Service del backend

En la consola AWS → ECS → adma-cluster → Create Service:

| Campo           | Valor                       |
| --------------- | --------------------------- |
| Launch type     | **FARGATE**                 |
| Task definition | `adma-backend` (revisión 1) |
| Service name    | `adma-backend`              |
| Desired tasks   | **1** (o 2+ para HA)        |
| VPC             | Tu VPC                      |
| Subnets         | Subnets **privadas**        |
| Security group  | `sg-backend`                |
| Public IP       | **Disabled**                |
| Load balancer   | `adma-alb`                  |
| Container       | `backend:8080`              |
| Target group    | `adma-backend-tg`           |

> ✅ **El backend escala horizontalmente de forma segura.** El job de limpieza usa **ShedLock** — un mutex distribuido sobre PostgreSQL — que garantiza que solo una instancia ejecuta el job en cada ciclo, independientemente del número de réplicas que tenga el servicio (`desiredCount=2` o más es perfectamente válido).

---

### Paso 17 · Crear el Service del frontend

| Campo           | Valor                            |
| --------------- | -------------------------------- |
| Launch type     | **FARGATE**                      |
| Task definition | `adma-frontend` (revisión 1)     |
| Service name    | `adma-frontend`                  |
| Desired tasks   | 1 (o 2 para alta disponibilidad) |
| VPC             | Tu VPC                           |
| Subnets         | Subnets **privadas**             |
| Security group  | `sg-frontend`                    |
| Public IP       | **Disabled**                     |
| Load balancer   | `adma-alb`                       |
| Container       | `frontend:80`                    |
| Target group    | `adma-frontend-tg`               |

---

## PARTE 8 — Verificación final

### Paso 18 · Comprobar que todo funciona

```bash
# Sustituye por el DNS de tu ALB (AWS → EC2 → Load Balancers → DNS name)
ALB_DNS="adma-alb-123456789.eu-south-2.elb.amazonaws.com"

# El backend debe responder
curl https://$ALB_DNS/api/stats

# El frontend debe devolver HTML
curl -I https://$ALB_DNS/
```

En la consola AWS → ECS → adma-cluster → Services, las tasks deben aparecer en estado **RUNNING**.

En AWS → EC2 → Target Groups, los targets deben estar en estado **healthy**.

---

## Para actualizar las imágenes en el futuro

Cuando hagas cambios en el código y quieras desplegar una nueva versión:

```bash
# 1. Reautenticar si han pasado más de 12h
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $ECR_BASE

# 2. Reconstruir y subir (backend)
cd backend
docker build -t $ECR_BASE/adma/backend:latest .
docker push $ECR_BASE/adma/backend:latest

# 3. Reconstruir y subir (frontend) — recuerda el --build-arg
cd ../frontend
docker build \
  --build-arg VITE_API_BASE_URL=$API_URL \
  -t $ECR_BASE/adma/frontend:latest .
docker push $ECR_BASE/adma/frontend:latest

# 4. Forzar que ECS descargue las nuevas imágenes
aws ecs update-service \
  --cluster adma-cluster \
  --service adma-backend \
  --force-new-deployment \
  --region $AWS_REGION

aws ecs update-service \
  --cluster adma-cluster \
  --service adma-frontend \
  --force-new-deployment \
  --region $AWS_REGION
```

ECS descargará las nuevas imágenes, arrancará las nuevas tasks y dará de baja las antiguas sin downtime.
