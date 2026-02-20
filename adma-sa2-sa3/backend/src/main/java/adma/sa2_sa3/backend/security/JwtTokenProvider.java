package adma.sa2_sa3.backend.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Encapsulates all JWT operations: generation, validation, and claim extraction.
 * <p>
 * The secret key and expiration are injected from {@code application.yml} (which
 * reads from environment variables), so no sensitive value is ever hardcoded.
 */
@Slf4j
@Component
public class JwtTokenProvider {

    private final SecretKey secretKey;
    private final long      expirationMs;

    /**
     * Constructor-based injection (DIP – Dependency Inversion Principle).
     *
     * @param secret       Base64-encoded or plain secret (min 32 chars for HS256)
     * @param expirationMs Token lifetime in milliseconds
     */
    public JwtTokenProvider(
        @Value("${app.jwt.secret}") String secret,
        @Value("${app.jwt.expiration-ms}") long expirationMs
    ) {
        // Ensure the raw secret bytes always meet JJWT's minimum key-length for HS256.
        // We use the raw UTF-8 bytes directly; no Base64 decoding is attempted here
        // because Base64 decoding failures were a common source of startup errors when
        // operators supplied plain-text secrets via environment variables.
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        this.secretKey    = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMs = expirationMs;
    }

    /**
     * Generates a signed JWT with the user's email as the subject.
     *
     * @param email the authenticated user's email
     * @return signed JWT string
     */
    public String generateToken(String email) {
        Date now    = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
            .subject(email)
            .issuedAt(now)
            .expiration(expiry)
            .signWith(secretKey)
            .compact();
    }

    /**
     * Extracts the email (subject) from a validated JWT.
     *
     * @param token raw JWT string (without "Bearer " prefix)
     * @return email stored in the subject claim
     */
    public String getEmailFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    /**
     * Validates the token signature and expiration.
     *
     * @param token raw JWT string
     * @return {@code true} if valid, {@code false} otherwise
     */
    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.warn("JWT token is expired: {}", e.getMessage());
        } catch (UnsupportedJwtException e) {
            log.warn("JWT token is unsupported: {}", e.getMessage());
        } catch (MalformedJwtException e) {
            log.warn("JWT token is malformed: {}", e.getMessage());
        } catch (SecurityException e) {
            log.warn("JWT signature validation failed: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            log.warn("JWT claims string is empty: {}", e.getMessage());
        }
        return false;
    }

    // ── Internal helpers ────────────────────────────────────────────────────

    private Claims parseClaims(String token) {
        return Jwts.parser()
            .verifyWith(secretKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}
