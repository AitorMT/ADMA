# Frontend

## Tecnologías

| Tecnología   | Propósito                                                   |
| ------------ | ----------------------------------------------------------- |
| React 18     | Librería de UI basada en componentes                        |
| TypeScript   | Tipado estático sobre JavaScript                            |
| Vite         | Bundler ultrarrápido para desarrollo y build                |
| Tailwind CSS | Framework CSS utility-first                                 |
| shadcn/ui    | Componentes UI accesibles y personalizables                 |
| React Router | Navegación SPA (client-side routing)                        |
| Nginx        | Servidor web que sirve los archivos estáticos en producción |

## Estructura de carpetas

```
frontend/
├── src/
│   ├── components/     ← Componentes reutilizables (AuthLayout, UrlShortener, etc.)
│   │   └── ui/         ← Componentes shadcn/ui (Button, Input, Card, etc.)
│   ├── context/        ← AuthContext (gestión de sesión JWT)
│   ├── hooks/          ← Custom hooks (use-stats, use-toast, use-mobile)
│   ├── lib/            ← Funciones utilitarias
│   │   ├── api.ts      ← Cliente HTTP para llamar al backend
│   │   ├── localUrlStore.ts ← Persistencia local de URLs (usuarios anónimos)
│   │   └── utils.ts    ← Utilidades generales
│   ├── pages/          ← Páginas de la aplicación
│   │   ├── Index.tsx   ← Página principal (acortador)
│   │   ├── Login.tsx   ← Formulario de login
│   │   ├── Register.tsx ← Formulario de registro
│   │   ├── Redirect.tsx ← Página de redirección (/r/:code)
│   │   └── NotFound.tsx ← Página 404
│   └── App.tsx         ← Rutas principales
├── public/             ← Assets estáticos (favicon, robots.txt, etc.)
├── nginx.conf          ← Configuración de Nginx para producción
├── Dockerfile          ← Build multi-stage (Node → Nginx)
└── package.json
```

## Cómo funciona el build

### Dockerfile (multi-stage)

```
Stage 1 (build):  node:20-alpine
  └── bun install + bun run build → genera /app/dist/

Stage 2 (runtime):  nginx:stable-alpine
  └── Copia /app/dist/ → /usr/share/nginx/html/
  └── Copia nginx.conf → /etc/nginx/conf.d/default.conf
```

**¿Por qué multi-stage?** Para que la imagen final solo tenga Nginx + los archivos estáticos (~30MB), sin Node.js ni dependencias de desarrollo (~500MB).

### `VITE_API_BASE_URL` — ¿Hay que pasarlo?

**No.** El valor por defecto es `""` (cadena vacía), lo que hace que todas las llamadas a la API usen rutas relativas:

```typescript
// api.ts
fetch("/api/urls/public", { ... })  // → se resuelve contra el mismo origen (ALB)
```

Como el frontend y el backend están detrás del mismo ALB, las rutas relativas funcionan automáticamente. Solo habría que cambiarlo si la API estuviera en un dominio diferente.

### Nginx en producción

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;

  # SPA: cualquier ruta sirve index.html para que React Router la gestione
  location / {
    try_files $uri /index.html;
  }

  # Assets estáticos con caché agresiva (1 año, inmutable)
  location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

**¿Por qué `try_files $uri /index.html`?**
Porque es una SPA (Single Page Application). Cuando el usuario navega a `/login`, no existe un archivo `/login` en el servidor — es React Router quien interpreta esa ruta. `try_files` primero busca si existe un archivo real con ese nombre; si no existe, sirve `index.html` y deja que React se encargue.

**¿Por qué Nginx NO hace proxy al backend?**
Porque el ALB se encarga de todo el routing (ver [Routing del ALB](Routing-ALB.md)). Esto simplifica enormemente la configuración de Nginx y evita problemas de resolución DNS dentro de la VPC.

## Páginas de la aplicación

| Ruta        | Página                               | Autenticación |
| ----------- | ------------------------------------ | ------------- |
| `/`         | Acortador de URLs (página principal) | No requerida  |
| `/login`    | Formulario de login                  | No requerida  |
| `/register` | Formulario de registro               | No requerida  |
| `/r/:code`  | Redirección con contador visual      | No requerida  |
| `*`         | Página 404                           | No requerida  |
