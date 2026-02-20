# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – Build
# Uses the official Gradle image to compile and package the Spring Boot fat-JAR.
# ─────────────────────────────────────────────────────────────────────────────
FROM gradle:8.5-jdk21 AS builder

WORKDIR /app

# Copy dependency descriptors first to benefit from Docker layer caching.
# The actual source is only copied after Gradle has resolved all dependencies.
COPY build.gradle settings.gradle ./
COPY gradle ./gradle

# Resolve dependencies (cached layer – only re-runs when build.gradle changes)
RUN gradle dependencies --no-daemon || true

# Copy source and build the fat-JAR
COPY src ./src
RUN gradle bootJar --no-daemon -x test

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – Runtime
# Minimal JRE image; the build artefacts from Stage 1 are the only things copied.
# ─────────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine AS runtime

# Security: run the JVM as a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

WORKDIR /app

# Copy only the fat-JAR from the build stage
COPY --from=builder /app/build/libs/*.jar app.jar

# ── Runtime configuration ─────────────────────────────────────────────────────
# All sensitive values MUST be injected as environment variables at runtime.
# Do NOT pass secrets via Docker build args or image layers.
#
# Required env vars:
#   DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD
#   JWT_SECRET, JWT_EXPIRATION_MS
#   SERVER_PORT (optional, defaults to 8080)
#   CORS_ALLOWED_ORIGINS (optional, defaults to localhost origins)
# ─────────────────────────────────────────────────────────────────────────────

EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
