package adma.sa2_sa3.backend.exception;

import adma.sa2_sa3.backend.dto.ErrorResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import lombok.extern.slf4j.Slf4j;

import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Centralized exception handler that converts every exception type into a
 * consistent {@link ErrorResponse} envelope.
 * <p>
 * DRY: all error-response construction is handled here; controllers never
 * build error bodies manually.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // ── Bean Validation (400) ────────────────────────────────────────────────

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(
                FieldError::getField,
                fe -> fe.getDefaultMessage() == null ? "Invalid value" : fe.getDefaultMessage(),
                (first, second) -> first   // keep first message if field has multiple violations
            ));

        return ResponseEntity.badRequest().body(
            buildError(HttpStatus.BAD_REQUEST, "Validation failed", "One or more fields are invalid", fieldErrors)
        );
    }

    // ── Domain exceptions ────────────────────────────────────────────────────

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(buildError(HttpStatus.NOT_FOUND, "Not Found", ex.getMessage(), null));
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(ConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(buildError(HttpStatus.CONFLICT, "Conflict", ex.getMessage(), null));
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ErrorResponse> handleUnauthorized(UnauthorizedException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(buildError(HttpStatus.UNAUTHORIZED, "Unauthorized", ex.getMessage(), null));
    }

    @ExceptionHandler(LinkExpiredException.class)
    public ResponseEntity<ErrorResponse> handleExpired(LinkExpiredException ex) {
        return ResponseEntity.status(HttpStatus.GONE)
            .body(buildError(HttpStatus.GONE, "Gone", ex.getMessage(), null));
    }

    // ── Spring Security exceptions ───────────────────────────────────────────

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthenticationException(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(buildError(HttpStatus.UNAUTHORIZED, "Unauthorized", ex.getMessage(), null));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(buildError(HttpStatus.FORBIDDEN, "Forbidden", ex.getMessage(), null));
    }

    // ── Catch-all (500) ─────────────────────────────────────────────────────

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        log.error("Unhandled exception: {}", ex.getMessage(), ex);
        // Do NOT leak exception details to the client in production.
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(buildError(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error",
                "An unexpected error occurred", null));
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private ErrorResponse buildError(HttpStatus status, String error, String message,
                                     Map<String, String> fieldErrors) {
        return ErrorResponse.builder()
            .status(status.value())
            .error(error)
            .message(message)
            .timestamp(Instant.now())
            .fieldErrors(fieldErrors)
            .build();
    }
}
