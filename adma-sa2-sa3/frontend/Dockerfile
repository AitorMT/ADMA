# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – Build
# Vite embeds VITE_* env vars at build time, so the backend URL must be known
# when building the static bundle. Pass it via --build-arg.
#
# Example:
#   docker build \
#     --build-arg VITE_API_BASE_URL=https://api.yourdomain.com \
#     -t your-ecr-repo/frontend:latest .
#
# For AWS ECS Fargate, set VITE_API_BASE_URL in your CodeBuild buildspec or
# CI/CD pipeline as a build argument — not as a runtime env var, because Vite
# bakes the value into the static JS bundle at build time.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Declare the build-time argument (no default = must be supplied in production)
# Falls back to localhost for convenience during local docker builds.
ARG VITE_API_BASE_URL=http://localhost:8080

# Make the ARG available to the Vite build process as an env var
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm install -g bun
RUN bun install

COPY . .

# Vite reads VITE_API_BASE_URL from the environment during this step
RUN bun run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – Runtime (Nginx)
# Serves the pre-built static files. No Node.js or build tools in production.
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:stable-alpine AS production

COPY --from=build /app/dist /usr/share/nginx/html
# Runtime backend upstream used by nginx reverse proxy.
# In ECS, this is overridden via task-definition environment variables.
ENV BACKEND_UPSTREAM=backend:8080

# Use nginx template + envsubst at container startup.
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
