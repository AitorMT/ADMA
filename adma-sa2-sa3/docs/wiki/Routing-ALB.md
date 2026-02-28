# Routing del ALB

Este documento explica **cómo el ALB decide qué petición va al frontend y cuál al backend**. Es una de las decisiones arquitectónicas más importantes del proyecto.

## El problema

Nuestra aplicación tiene dos servicios:

- **Frontend** (Nginx en puerto 80): sirve la SPA React.
- **Backend** (Spring Boot en puerto 8080): sirve la API REST y las redirecciones de URLs acortadas.

Ambos están detrás de un mismo dominio (el DNS del ALB). El reto es:

- `/api/stats` debe ir al backend.
- `/login` debe ir al frontend.
- `/D4gZeDT` (un short code) debe ir al backend.
- `/` debe ir al frontend.

Los short codes (`/D4gZeDT`) y las rutas de la SPA (`/login`) son **indistinguibles a nivel de formato**: ambas son simplemente `/<algo>`.

## La solución: reglas de prioridad en el ALB

El ALB evalúa las reglas en orden de prioridad (número menor = mayor prioridad). La **primera regla que coincide** se ejecuta.

```
 Petición entrante: GET /login
         │
         ▼
 ┌─ P10: ¿path es /api/* o /auth/*? ──→ NO
 │
 ├─ P20: ¿path es / /login /register /r/* /assets/*? ──→ SÍ ──→ Frontend ✅
 │
 ├─ P30: ¿path es /*? ──→ (no se evalúa, P20 ya coincidió)
 │
 └─ Default: Frontend
```

```
 Petición entrante: GET /D4gZeDT
         │
         ▼
 ┌─ P10: ¿path es /api/* o /auth/*? ──→ NO
 │
 ├─ P20: ¿path es / /login /register /r/* /assets/*? ──→ NO
 │
 ├─ P30: ¿path es /*? ──→ SÍ ──→ Backend ✅
 │
 └─ Default: Frontend
```

## Reglas en detalle

### Prioridad 10 — API y autenticación → Backend

```hcl
condition {
  path_pattern {
    values = ["/api/*", "/auth/*"]
  }
}
```

**¿Por qué prioridad 10?**
Son las rutas más claras y predecibles. Siempre empiezan con `/api/` o `/auth/`, así que se evalúan primero sin riesgo de colisión.

### Prioridad 20 — Rutas de la SPA → Frontend

```hcl
condition {
  path_pattern {
    values = ["/", "/login", "/register", "/r/*", "/assets/*"]
  }
}
```

**¿Por qué existe esta regla?**
Porque `/login` (5 caracteres alfanuméricos) y `/register` (8 caracteres alfanuméricos) tienen la misma forma que un short code y caerían en la regla P30 (backend) si no se interceptan antes.

**¿Por qué `/r/*`?**
Es la ruta de redirección con vista previa (`/r/D4gZeDT`). Es una página del frontend, no del backend.

**¿Por qué `/assets/*`?**
Los archivos estáticos generados por Vite (JS, CSS, imágenes) se sirven desde `/assets/`. Sin esta regla, caerían en P30 y el backend devolvería 404.

**¿Por qué `/`?**
La página principal. Sin esta regla, el path `/` coincidiría con `/*` (P30) y llegaría al backend, que no tiene un handler para `/` y respondería con un error.

### Prioridad 30 — Short codes (catch-all) → Backend

```hcl
condition {
  path_pattern {
    values = ["/*"]
  }
}
```

**¿Por qué catch-all?**
Los short codes no tienen un prefijo reconocible. Son simplemente `/<código>` (4-10 caracteres alfanuméricos). La única forma de capturarlos es con un wildcard `/*` que recoja todo lo que no haya sido interceptado por las reglas anteriores.

**¿Qué pasa si alguien pide `/xyz` y no existe un short code con ese código?**
El backend devuelve 404. La SPA no se ve afectada porque las rutas legítimas de la SPA ya están protegidas por la regla P20.

### Default — Frontend

Si ninguna regla coincide (lo cual en la práctica no debería pasar con P30 ya que `/*` coincide con todo), el tráfico va al frontend como fallback.

## Alternativa descartada: proxy reverso en Nginx

En una versión anterior del proyecto, Nginx actuaba como proxy reverso:

- Servía la SPA para las rutas del frontend.
- Reenvíaba `/{shortCode}` al backend internamente usando Cloud Map DNS (`backend.local:8080`).

**¿Por qué se descartó?**

1. **Complejidad de configuración:** La regex de nginx para short codes (`^/[a-zA-Z0-9]{4,10}$`) causaba errores con `envsubst` (que interpretaba `{4,10}` como una variable de shell) y con el parser de nginx (que interpretaba `{` como inicio de bloque).
2. **Colisión de rutas:** `/login` y `/register` coincidían con la regex de short codes por ser palabras alfanuméricas de 5 y 8 caracteres.
3. **Problemas de conectividad:** La resolución DNS de Cloud Map dentro del contenedor frontend era poco fiable.
4. **Principio de simplicidad:** El ALB ya tiene un mecanismo robusto de routing por path — duplicar esa lógica en nginx era innecesario.

La solución actual (ALB routing) es más simple, más robusta y no requiere configuración especial en nginx.
