package adma.sa2_sa3.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

/**
 * Uniform error envelope returned by {@link adma.sa2_sa3.backend.exception.GlobalExceptionHandler}.
 * <p>
 * Keeps every error response consistent so the React frontend can rely on a
 * single shape regardless of which endpoint produced the error.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ErrorResponse {

    private int    status;
    private String error;
    private String message;
    private Instant timestamp;

    /**
     * Optional field-level validation errors keyed by field name.
     * Populated only for {@code 400 Bad Request} responses from Bean Validation.
     */
    private Map<String, String> fieldErrors;
}
