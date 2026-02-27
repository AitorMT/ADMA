package adma.sa2_sa3.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Entry point for the URL Shortener backend.
 * <p>
 * All configuration (database, JWT, CORS) is externalised via environment
 * variables – see {@code application.yml} and {@code .env.example}.
 * <p>
 * {@code @EnableScheduling} activates the {@link adma.sa2_sa3.backend.service.ExpiredUrlCleanupService}
 * which purges expired anonymous links every 15 minutes.
 */
@SpringBootApplication
@EnableScheduling
public class BackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}
}
