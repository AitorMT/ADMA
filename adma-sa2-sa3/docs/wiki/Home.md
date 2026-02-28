# ADMA SA2/SA3 — URL Shortener

Acortador de URLs desplegado en AWS con infraestructura como código (Terraform).

## Índice de la Wiki

| Página                                          | Descripción                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| [Arquitectura General](Arquitectura-General.md) | Visión global del sistema, componentes y cómo se comunican entre sí |
| [Frontend](Frontend.md)                         | SPA React con Vite, servida por Nginx en ECS Fargate                |
| [Backend](Backend.md)                           | API REST con Spring Boot, JWT y PostgreSQL                          |
| [Infraestructura AWS](Infraestructura-AWS.md)   | VPC, subredes, ALB, ECS, RDS — todo gestionado con Terraform        |
| [Routing del ALB](Routing-ALB.md)               | Cómo el ALB decide qué petición va al frontend y cuál al backend    |
| [Seguridad](Seguridad.md)                       | Security Groups, JWT, CORS y decisiones de diseño                   |
| [Decisiones de Diseño](Decisiones-de-Diseno.md) | Por qué se eligió cada tecnología y enfoque arquitectónico          |

---

## Stack tecnológico

| Capa          | Tecnología                    | Versión          |
| ------------- | ----------------------------- | ---------------- |
| Frontend      | React + TypeScript + Vite     | React 18, Vite 5 |
| UI            | Tailwind CSS + shadcn/ui      | —                |
| Backend       | Spring Boot + Spring Security | 3.4.2            |
| Base de datos | PostgreSQL (AWS RDS)          | 16               |
| Contenedores  | Docker → AWS ECS Fargate      | —                |
| IaC           | Terraform                     | ≥ 1.5            |
| Registry      | AWS ECR Public                | —                |
| Load Balancer | AWS ALB                       | —                |
