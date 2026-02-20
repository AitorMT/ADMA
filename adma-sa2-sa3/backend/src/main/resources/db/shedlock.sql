-- ShedLock distributed lock table.
-- This table is used by ShedLock to ensure that scheduled tasks run on exactly
-- one instance at a time, even when multiple backend replicas are running
-- (e.g. on AWS ECS Fargate with desiredCount > 1).
--
-- Hibernate ddl-auto does NOT manage this table — it must be created once
-- before the application starts. In production, run this against RDS manually
-- or include it in your Flyway/Liquibase migration scripts.
CREATE TABLE IF NOT EXISTS shedlock (
    name       VARCHAR(64)  NOT NULL,
    lock_until TIMESTAMP    NOT NULL,
    locked_at  TIMESTAMP    NOT NULL,
    locked_by  VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
);
