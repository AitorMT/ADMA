package adma.sa2_sa3.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Smoke test – verifies that the Spring application context loads correctly.
 * Uses an in-memory H2 database so no external RDS connection is required
 * during CI/local test runs.
 */
@SpringBootTest
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
    "app.jwt.secret=test-secret-key-for-testing-purposes-only-32chars",
    "app.jwt.expiration-ms=3600000",
    "app.cors.allowed-origins=http://localhost:3000"
})
class BackendApplicationTests {

    @Test
    void contextLoads() {
        // Verifies that all beans wire up correctly
    }
}
