package adma.sa2_sa3.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Thrown when a short code is found in the database but its expiry time has passed.
 * Maps to HTTP 410 Gone – semantically distinct from 404 (never existed).
 */
@ResponseStatus(HttpStatus.GONE)
public class LinkExpiredException extends RuntimeException {

    public LinkExpiredException(String shortCode) {
        super("Short link has expired: " + shortCode);
    }
}
