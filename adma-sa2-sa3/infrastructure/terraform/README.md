# AWS Terraform Infrastructure (ECS Fargate + RDS)

This folder contains a production-oriented Terraform stack for deploying this project on AWS with:

- Dedicated VPC (2+ AZs, public + private subnets)
- Internet-facing ALB for frontend only
- Private ECS Fargate backend (no internet ingress)
- Private RDS PostgreSQL
- Secrets Manager for DB password and JWT secret
- Least-privilege IAM roles for ECS tasks
- ECS autoscaling (CPU + memory target tracking)
- VPC endpoints to avoid NAT Gateway costs

## 1) Project Review Findings

### Repository structure

- `frontend/`: React + Vite SPA served by Nginx
- `backend/`: Spring Boot API (Java 21) + PostgreSQL
- `docker-compose.yml`: local stack with Postgres + backend + frontend
- `infrastructure/`: previous manual deployment artifacts

### Containerization and runtime details

- Frontend Docker image:
  - Build stage: Node/Bun + Vite
  - Runtime stage: Nginx (`EXPOSE 80`)
  - Build-time dependency: `VITE_API_BASE_URL`
- Backend Docker image:
  - Build stage: Gradle bootJar
  - Runtime stage: Temurin JRE Alpine (`EXPOSE 8080`)

### Required runtime environment (backend)

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`
- `JWT_SECRET`, `JWT_EXPIRATION_MS`
- `APP_BASE_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`
- `SERVER_PORT`

### Ports and traffic behavior

- Frontend container: `80`
- Backend container: `8080`
- DB: `5432`
- Backend health endpoint used in this Terraform: `/api/stats`
  - (`/actuator/health` is referenced in legacy task JSON but Spring Actuator is not included in `build.gradle`)

### Container suitability

Both applications are suitable for ECS Fargate deployment.

To satisfy strict network policy (public frontend, private backend), frontend Nginx now reverse-proxies:

- `/auth/*` -> backend
- `/api/*` -> backend
- `/<shortCode>` -> backend redirect endpoint

This keeps browser traffic on frontend origin while backend stays private.

## 2) Assumptions

- You will build and push container images to ECR before ECS rollout (or use existing ECR repos).
- If using HTTPS, `enable_https=true` and `acm_certificate_arn` is provided.
- For production, frontend image is built with `VITE_API_BASE_URL` as:
  - empty string (`""`) for same-origin API calls, or
  - public frontend URL (same ALB/custom domain).
- `db.t4g.micro` is acceptable as cost baseline (can be changed in tfvars).
- `aws_region` is explicitly provided in `terraform.tfvars`.

## 3) Security Model Enforced

Security groups explicitly enforce required rules:

- Internet -> Frontend: allowed (ALB 80/443)
- Frontend -> Backend: allowed (frontend SG egress to backend SG on 8080)
- Internet -> Backend: denied (backend has no ALB exposure, no public IP, ingress only from frontend SG)
- Frontend -> Database: denied (no frontend SG rule to DB SG)
- Backend -> Database: allowed (backend SG egress + DB SG ingress on 5432)

Additional controls:

- ECS tasks run in private subnets (`assign_public_ip=false`)
- DB is private (`publicly_accessible=false`) and encrypted at rest
- DB password and JWT secret are stored in Secrets Manager
- ECS execution role can only read the exact required secrets
- DB connection enforces TLS in transit via `SPRING_DATASOURCE_URL` with `sslmode=require`
- RDS parameter group sets `rds.force_ssl=1` to reject non-TLS DB sessions

## 4) Cost Optimizations

- No NAT Gateway (major recurring-cost reduction)
- Private subnets use VPC endpoints for ECR, CloudWatch Logs, Secrets Manager, and S3 gateway
- Right-sized Fargate defaults:
  - Frontend: `256 CPU / 512 MiB`
  - Backend: `512 CPU / 1024 MiB`
- Single-AZ RDS disabled by default? No: Multi-AZ is disabled by default to reduce cost (`db_multi_az=false`)
- ECR lifecycle policy retains only the latest 20 images per repo

## 5) Module Layout

```text
infrastructure/terraform/
├── main.tf
├── variables.tf
├── outputs.tf
├── terraform.tfvars.example
└── modules/
    ├── network/
    ├── security/
    ├── vpc_endpoints/
    ├── ecr/
    ├── iam/
    ├── rds/
    └── ecs/
```

## 6) Deployment Steps

1. Copy example vars:

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
```

2. Edit `terraform.tfvars` (region, domain/cert, sizing, etc.).

3. Initialize and plan:

```bash
terraform init
terraform plan
```

4. Apply:

```bash
terraform apply
```

5. Build and push images to ECR using output repository URLs, then force a new deployment:

```bash
aws ecs update-service --cluster <cluster> --service <frontend-service> --force-new-deployment
aws ecs update-service --cluster <cluster> --service <backend-service> --force-new-deployment
```

## 7) Important Prerequisite for Frontend Build

Use one of these at image build time:

- `--build-arg VITE_API_BASE_URL=""` (recommended)
- `--build-arg VITE_API_BASE_URL="https://<frontend-domain>"`

Do not set it to a private backend URL, because browsers cannot reach private VPC endpoints directly.
