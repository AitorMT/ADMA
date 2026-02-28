# Decisiones de Diseño

Este documento recopila las decisiones técnicas más relevantes del proyecto, explicando **qué se decidió**, **por qué** y **qué alternativas se descartaron**.

---

## 1. ¿Por qué ECS Fargate en lugar de EC2?

|                      | ECS Fargate                      | EC2                                 |
| -------------------- | -------------------------------- | ----------------------------------- |
| Gestión del servidor | AWS gestiona los servidores      | Tú gestionas las instancias         |
| Coste en demo        | Pagas solo por contenedor activo | Pagas la instancia 24/7             |
| Escalado             | Automático por tarea             | Hay que escalar instancias + tareas |
| Complejidad          | Baja                             | Alta                                |

**Decisión:** Fargate. Para un proyecto educativo/demo, no tiene sentido gestionar servidores. Fargate abstrae toda la infraestructura y permite enfocarse en los contenedores.

---

## 2. ¿Por qué ECR público en lugar de privado?

|               | ECR Público                             | ECR Privado                                              |
| ------------- | --------------------------------------- | -------------------------------------------------------- |
| Acceso        | Cualquiera puede descargar las imágenes | Solo cuentas autorizadas                                 |
| VPC Endpoints | No necesario                            | Necesita VPC Endpoint (~7$/mes) o NAT Gateway (~30$/mes) |
| Autenticación | `us-east-1` para login                  | Región local                                             |

**Decisión:** ECR público. Las imágenes del proyecto no contienen secretos (la configuración se inyecta en runtime). Usar ECR público evita el coste de un VPC Endpoint o NAT Gateway.

---

## 3. ¿Por qué subredes públicas para ECS (sin NAT Gateway)?

**Problema:** ECS Fargate necesita acceso a internet para descargar imágenes de ECR y enviar logs a CloudWatch.

**Alternativas:**

1. **NAT Gateway:** ~30$/mes. Excesivo para demo.
2. **VPC Endpoints:** ~7$/mes por endpoint (ECR + CloudWatch + S3 = ~21$/mes).
3. **Subredes públicas con IP pública:** 0$/mes adicional.

**Decisión:** Subredes públicas con `assign_public_ip = true`. El ahorro es significativo y la seguridad no se compromete porque los Security Groups limitan el tráfico entrante solo al ALB.

---

## 4. ¿Por qué el routing lo gestiona el ALB y no Nginx?

**Problema original:** Las URLs acortadas (`/D4gZeDT`) y las rutas de la SPA (`/login`) son indistinguibles por formato.

**Alternativa descartada — Nginx como proxy reverso:**

- Nginx usaba una regex para detectar short codes y reenviarlos al backend.
- Causó tres bugs encadenados:
  1. `envsubst` expandía `{4,10}` como variable shell.
  2. Nginx interpretaba `{` como inicio de bloque.
  3. `/login` (5 chars alfanuméricos) coincidía con la regex de short codes.
- Además, la conectividad directa frontend → backend vía Cloud Map era poco fiable.

**Solución actual — ALB routing por prioridad:**

- P10: `/api/*`, `/auth/*` → backend.
- P20: `/`, `/login`, `/register`, `/r/*`, `/assets/*` → frontend.
- P30: `/*` (catch-all) → backend (short codes).

**¿Por qué es mejor?**

- Cero configuración en Nginx — solo sirve archivos estáticos.
- Sin problemas de regex, envsubst ni DNS interno.
- Las reglas se definen en Terraform, versionadas y auditables.
- Si se añade una nueva ruta SPA, basta con añadirla a la lista de P20 y hacer `terraform apply`.

---

## 5. ¿Por qué `/{shortCode}` sin regex en Spring Security?

**Problema:** `requestMatchers(HttpMethod.GET, "/{shortCode:[a-zA-Z0-9]{4,10}}")` causaba `403 Forbidden` para todos los short codes.

**Causa raíz:** Spring Security usa `AntPathMatcher`, que **no soporta** la sintaxis regex que sí funciona en `@GetMapping` de Spring MVC.

**Solución:** Usar un path genérico sin regex y delegar la validación al controlador:

```java
// SecurityConfig.java — permite cualquier GET /{algo}
.requestMatchers(HttpMethod.GET, "/{shortCode}").permitAll()

// RedirectController.java — valida el formato y devuelve 404 si no coincide
@GetMapping("/{shortCode:[a-zA-Z0-9]{4,10}}")
```

Esto funciona porque Spring MVC sí evalúa la regex en `@GetMapping`. Si el path no coincide con el patrón, el controlador no se activa y Spring devuelve 404 (no 403).

---

## 6. ¿Por qué `VITE_API_BASE_URL` está vacío por defecto?

**Contexto:** Vite embebe las variables `VITE_*` en el bundle JS en tiempo de build. Son **inmutables** después de compilar.

**Alternativas:**

1. **Pasar la URL del ALB como build-arg:** Obliga a reconstruir la imagen cada vez que cambia el ALB.
2. **Cadena vacía (rutas relativas):** Las llamadas `fetch("/api/...")` se resuelven contra el mismo origen que sirvió la página.

**Decisión:** Cadena vacía. Como el frontend y el backend comparten el mismo ALB, las rutas relativas funcionan automáticamente. La misma imagen Docker sirve para cualquier ALB sin reconstruir.

---

## 7. ¿Por qué Docker multi-stage builds?

|                      | Sin multi-stage                   | Con multi-stage                     |
| -------------------- | --------------------------------- | ----------------------------------- |
| Imagen frontend      | ~500 MB (Node + deps + dist)      | ~30 MB (Nginx + archivos estáticos) |
| Imagen backend       | ~1.2 GB (Gradle + JDK + app)      | ~200 MB (JRE Alpine + fat-JAR)      |
| Superficie de ataque | Grande (compilador, herramientas) | Mínima (solo runtime)               |

**Decisión:** Multi-stage para ambos servicios. Imágenes más pequeñas = arranque más rápido en Fargate + menor superficie de ataque.

---

## 8. ¿Por qué `skip_final_snapshot = true` y `deletion_protection = false`?

**Contexto:** Son configuraciones de la base de datos RDS.

- `skip_final_snapshot = true`: Permite destruir la BD sin crear un snapshot final.
- `deletion_protection = false`: Permite borrar la BD con `terraform destroy`.

**Decisión:** Activados **solo en modo demo**. En producción:

- `skip_final_snapshot` debería ser `false` (para tener backup).
- `deletion_protection` debería ser `true` (para evitar borrados accidentales).
- Se deberían usar backups automatizados y retención.

---

## 9. ¿Por qué separar las reglas de Security Group en recursos independientes?

**Problema:** Terraform no puede resolver dependencias circulares. Si `backend_sg` referencia a `db_sg` y `db_sg` referencia a `backend_sg`, Terraform no sabe cuál crear primero.

**Solución:** Definir los Security Groups sin reglas cross-reference, y añadir las reglas como recursos `aws_security_group_rule` separados:

```hcl
# Se crea primero (sin referencia a db_sg)
resource "aws_security_group" "backend_sg" { ... }

# Se crea después (ya existe backend_sg y db_sg)
resource "aws_security_group_rule" "backend_to_db" {
  security_group_id        = aws_security_group.backend_sg.id
  source_security_group_id = aws_security_group.db_sg.id
  ...
}
```

---

## 10. ¿Por qué `docker-compose.yml` existe si el despliegue es con ECS?

`docker-compose.yml` sirve para **desarrollo local**:

- Levanta PostgreSQL, backend y frontend con un solo comando.
- Simula el mismo entorno que AWS pero sin coste.
- Usa valores por defecto (`localhost`, `changeme`) que no requieren configuración.

En producción, **no se usa** `docker-compose`. Terraform gestiona todo con ECS Fargate.
