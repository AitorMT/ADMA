# Backend

## Tecnologías

| Tecnología            | Propósito                                                                      |
| --------------------- | ------------------------------------------------------------------------------ |
| Java 21               | Lenguaje principal (LTS)                                                       |
| Spring Boot 3.4.2     | Framework web + inyección de dependencias                                      |
| Spring Security       | Autenticación y autorización                                                   |
| Spring Data JPA       | Acceso a base de datos con Hibernate                                           |
| PostgreSQL 16         | Base de datos relacional (AWS RDS)                                             |
| JWT (JSON Web Tokens) | Autenticación stateless                                                        |
| ShedLock              | Evita ejecuciones duplicadas de tareas programadas en entornos multi-instancia |
| Lombok                | Reducción de código boilerplate                                                |
| BCrypt                | Hashing de contraseñas                                                         |

## Estructura de carpetas

```
backend/src/main/java/adma/sa2_sa3/backend/
├── BackendApplication.java       ← Punto de entrada
├── config/
│   ├── AppConfig.java            ← Configuración general
│   └── SecurityConfig.java       ← Cadena de filtros de seguridad, CORS, JWT
├── controller/
│   ├── AuthController.java       ← POST /auth/register, POST /auth/login
│   ├── ShortUrlController.java   ← CRUD de URLs (/api/urls/*)
│   ├── RedirectController.java   ← GET /{shortCode} → 302 redirect
│   └── StatsController.java      ← GET /api/stats
├── domain/                       ← Entidades JPA
├── dto/                          ← Objetos de transferencia (request/response)
├── exception/                    ← Manejador global de excepciones
├── repository/                   ← Interfaces JPA Repository
├── security/                     ← JwtAuthenticationFilter, JwtUtils
├── service/                      ← Lógica de negocio
│   └── ExpiredUrlCleanupService  ← Tarea programada: purga URLs expiradas
└── util/                         ← Utilidades
```

## Endpoints de la API

### Públicos (sin JWT)

| Método | Ruta               | Descripción                            |
| ------ | ------------------ | -------------------------------------- |
| `POST` | `/auth/register`   | Registro de usuario                    |
| `POST` | `/auth/login`      | Login → devuelve JWT                   |
| `POST` | `/api/urls/public` | Acortar URL sin cuenta                 |
| `GET`  | `/api/stats`       | Estadísticas globales de la plataforma |
| `GET`  | `/{shortCode}`     | Redirección 302 al destino original    |

### Protegidos (requieren JWT)

| Método   | Ruta             | Descripción                         |
| -------- | ---------------- | ----------------------------------- |
| `GET`    | `/api/urls`      | Listar URLs del usuario autenticado |
| `POST`   | `/api/urls`      | Crear URL acortada (autenticado)    |
| `DELETE` | `/api/urls/{id}` | Eliminar URL propia                 |

## Dockerfile (multi-stage)

```
Stage 1 (build):  gradle:8.5-jdk21
  └── gradle bootJar → genera build/libs/app.jar

Stage 2 (runtime):  eclipse-temurin:21-jre-alpine
  └── Copia app.jar
  └── Corre como usuario no-root (appuser)
  └── JVM optimizada para contenedores:
      -XX:+UseContainerSupport
      -XX:MaxRAMPercentage=75.0
```

**¿Por qué no se pasan build-args?**
Toda la configuración del backend (URL de la BD, JWT, CORS) se inyecta como **variables de entorno en runtime** por la task definition de ECS. Esto permite usar exactamente la misma imagen Docker en cualquier entorno sin reconstruirla.

## Configuración (`application.yml`)

Todas las propiedades sensibles se leen de variables de entorno con valores por defecto para desarrollo local:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:urlshortener}
    username: ${DB_USERNAME:postgres}
    password: ${DB_PASSWORD:changeme}

app:
  jwt:
    secret: ${JWT_SECRET:...}
    expiration-ms: ${JWT_EXPIRATION_MS:86400000}
  cors:
    allowed-origins: ${CORS_ALLOWED_ORIGINS:http://localhost,...}
```

**¿Por qué `${VAR:default}`?**
Así la app arranca correctamente en local (`docker-compose`) sin necesidad de configurar nada. En AWS, Terraform inyecta los valores reales automáticamente.

## Seguridad (Spring Security)

```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/auth/**").permitAll()
    .requestMatchers(HttpMethod.GET, "/{shortCode}").permitAll()
    .requestMatchers(HttpMethod.POST, "/api/urls/public").permitAll()
    .requestMatchers(HttpMethod.GET, "/api/stats").permitAll()
    .anyRequest().authenticated()
)
```

**Decisión importante:** El matcher de `/{shortCode}` usa un **path genérico** sin regex.

¿Por qué? Porque Spring Security usa `AntPathMatcher` internamente, que **no soporta** la sintaxis regex de Spring MVC (`{shortCode:[a-zA-Z0-9]{4,10}}`). Si se usara regex, Spring Security no lo reconocería y respondería con `403 Forbidden` a todas las peticiones de short codes. La validación del formato la realiza el controlador (`RedirectController`).

## Tarea programada: limpieza de URLs expiradas

`ExpiredUrlCleanupService` ejecuta una tarea periódica (vía `@Scheduled`) que purga URLs cuya fecha de expiración ya pasó. Usa **ShedLock** para evitar que múltiples instancias del backend ejecuten la misma tarea simultáneamente (relevante cuando Auto Scaling escala a >1 réplica).
