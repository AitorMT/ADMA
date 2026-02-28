# Infraestructura AWS

Toda la infraestructura se define con **Terraform** (Infraestructura como Código). Esto garantiza que es reproducible, versionable y se puede destruir y recrear con un solo comando.

## Ficheros Terraform

| Fichero            | Descripción                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| `provider.tf`      | Configura el provider de AWS y la región (`eu-south-2`)                |
| `versions.tf`      | Versiones mínimas de Terraform (≥ 1.5) y del provider AWS (~> 5.0)     |
| `variables.tf`     | Variables del proyecto: imágenes Docker, credenciales BD, JWT, entorno |
| `terraform.tfvars` | Valores reales de las variables (no commitear en producción)           |
| `networking.tf`    | VPC, subredes públicas/privadas, Internet Gateway, tablas de rutas     |
| `security.tf`      | Security Groups para ALB, frontend, backend y base de datos            |
| `rds.tf`           | Instancia PostgreSQL (RDS) en subredes privadas                        |
| `alb.tf`           | Application Load Balancer, Target Groups y reglas de routing           |
| `ecs.tf`           | Cluster ECS, Task Definitions, Services y Auto Scaling                 |
| `iam.tf`           | Role de ejecución de ECS (pull de imágenes, CloudWatch Logs)           |
| `outputs.tf`       | URL de la aplicación y DNS del ALB como outputs                        |

## Recursos creados

### Red (networking.tf)

```
VPC 10.0.0.0/16
├── Subnet pública 10.0.0.0/24  (AZ-a)  ← ALB + ECS
├── Subnet pública 10.0.1.0/24  (AZ-b)  ← ALB + ECS
├── Subnet privada 10.0.20.0/24 (AZ-a)  ← RDS
├── Subnet privada 10.0.21.0/24 (AZ-b)  ← RDS
├── Internet Gateway                      ← Acceso a internet para subredes públicas
├── Route Table pública                   ← 0.0.0.0/0 → IGW
└── Route Table privada                   ← Sin ruta a internet (aislada)
```

**¿Por qué dos subredes por tipo?**
Porque AWS exige un mínimo de dos zonas de disponibilidad (AZ) tanto para el ALB como para el RDS Subnet Group. Esto proporciona alta disponibilidad.

**¿Por qué NO hay NAT Gateway?**
Un NAT Gateway cuesta ~30$/mes. En un entorno de demo/educativo es un gasto innecesario. En su lugar, ECS Fargate se ejecuta en subredes públicas con IP pública (`assign_public_ip = true`), lo que le permite descargar imágenes de ECR y enviar logs a CloudWatch directamente por internet.

### Base de datos (rds.tf)

| Propiedad             | Valor                                       | Justificación                                   |
| --------------------- | ------------------------------------------- | ----------------------------------------------- |
| Motor                 | PostgreSQL 16                               | Motor relacional maduro y open-source           |
| Instancia             | `db.t3.micro` (demo) / `db.t3.small` (prod) | Mínimo coste en demo                            |
| Almacenamiento        | 20 GB gp2                                   | Suficiente para URLs acortadas                  |
| Acceso público        | `false`                                     | Solo accesible desde dentro de la VPC           |
| `skip_final_snapshot` | `true`                                      | Permite `terraform destroy` limpio sin snapshot |
| `deletion_protection` | `false`                                     | Permite destruir la BD sin protección extra     |

### Contenedores (ecs.tf)

| Servicio | CPU             | Memoria | Puerto | Imagen                               |
| -------- | --------------- | ------- | ------ | ------------------------------------ |
| Frontend | 256 (0.25 vCPU) | 512 MB  | 80     | `public.ecr.aws/.../frontend:latest` |
| Backend  | 512 (0.5 vCPU)  | 1024 MB | 8080   | `public.ecr.aws/.../backend:latest`  |

**Auto Scaling:**

| Entorno      | Réplicas mín/máx | Métrica                | Umbral |
| ------------ | ---------------- | ---------------------- | ------ |
| `demo`       | 1 / 2            | CPU media del servicio | 70%    |
| `production` | 2 / 4            | CPU media del servicio | 70%    |

El cooldown de scale-out es agresivo (60s) para responder rápido a picos, mientras que el cooldown de scale-in es conservador (300s) para evitar "flapping".

### IAM (iam.tf)

Se crea un único role (`ecs_task_execution`) con la policy gestionada de AWS `AmazonECSTaskExecutionRolePolicy`. Esta policy permite a ECS:

- Descargar imágenes de ECR.
- Enviar logs a CloudWatch.

Se usa `name_prefix` en lugar de `name` para evitar conflictos si el role ya existe de un despliegue anterior.

## Variables y configuración

### `terraform.tfvars` (ejemplo)

```hcl
environment = "demo"

frontend_image = "public.ecr.aws/a1v1u4e4/adma/frontend:latest"
backend_image  = "public.ecr.aws/a1v1u4e4/adma/backend:latest"

db_pass    = "password123"
jwt_secret = "changeme-replace-this-with-a-real-secret!!"
```

> ⚠️ En un entorno real, las credenciales deberían gestionarse con AWS Secrets Manager o SSM Parameter Store, no en un fichero de texto plano.

### Variables de entorno del backend

Terraform inyecta automáticamente todas las variables de entorno del backend en la task definition de ECS. El desarrollador solo necesita configurar `terraform.tfvars`:

| Variable                | Origen en Terraform                                           |
| ----------------------- | ------------------------------------------------------------- |
| `SPRING_DATASOURCE_URL` | Generada automáticamente desde `aws_db_instance.this.address` |
| `DB_HOST` / `DB_PORT`   | Leídos del recurso RDS                                        |
| `CORS_ALLOWED_ORIGINS`  | URL del ALB (`http://<alb-dns>`)                              |
| `APP_BASE_URL`          | URL del ALB                                                   |
| `JWT_SECRET`            | Desde `var.jwt_secret`                                        |

## Ciclo de vida

```bash
# Primera vez o tras borrar .terraform/
terraform init

# Ver qué va a crear
terraform plan

# Desplegar todo (~5-8 min)
terraform apply -auto-approve

# Obtener URL de la app
terraform output app_url

# Destruir todo (~5-10 min)
terraform destroy -auto-approve
```
