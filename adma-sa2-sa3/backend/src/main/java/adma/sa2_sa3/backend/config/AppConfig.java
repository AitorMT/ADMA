package adma.sa2_sa3.backend.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * Application-level configuration beans.
 *
 * <p>Also configures <strong>ShedLock</strong> — a distributed lock that ensures
 * {@code @Scheduled} jobs execute on exactly one JVM instance at a time, even
 * when multiple backend replicas are running on ECS Fargate. The lock state is
 * stored in the {@code shedlock} table in the same PostgreSQL database, so no
 * extra infrastructure (Redis, ZooKeeper, etc.) is required.
 *
 * <p>The {@code shedlock} table must exist before the application starts.
 * See {@code src/main/resources/db/shedlock.sql} for the DDL.
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT14M")
public class AppConfig {

    @Value("${app.base-url:}")
    private String configuredBaseUrl;

    /**
     * Returns the base URL to prepend to short codes.
     * If {@code app.base-url} is not set, falls back to the dynamic request URL.
     */
    public String resolveBaseUrl() {
        if (configuredBaseUrl != null && !configuredBaseUrl.isBlank()) {
            return configuredBaseUrl;
        }
        try {
            return ServletUriComponentsBuilder
                .fromCurrentContextPath()
                .build()
                .toUriString();
        } catch (IllegalStateException e) {
            return "http://localhost:8080";
        }
    }

    /**
     * ShedLock lock provider backed by the application's PostgreSQL database.
     *
     * <p>Uses JdbcTemplate (already on the classpath via Spring Data JPA) to
     * read/write the {@code shedlock} table. No extra data source needed.
     *
     * <p>{@code usingDbTime()} makes the lock use the database clock, which is
     * authoritative across all ECS tasks regardless of host clock drift.
     */
    @Bean
    public LockProvider lockProvider(JdbcTemplate jdbcTemplate) {
        return new JdbcTemplateLockProvider(
            new JdbcTemplateLockProvider.Configuration.Builder()
                .withJdbcTemplate(jdbcTemplate)
                .usingDbTime()
                .build()
        );
    }
}

