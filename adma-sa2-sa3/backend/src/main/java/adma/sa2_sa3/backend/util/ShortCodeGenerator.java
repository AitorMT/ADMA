package adma.sa2_sa3.backend.util;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;

/**
 * Generates collision-safe, URL-safe alphanumeric short codes.
 * <p>
 * Uses {@link SecureRandom} (cryptographically strong) rather than
 * {@link java.util.Random} to avoid predictable code sequences.
 * <p>
 * The alphabet deliberately excludes visually ambiguous characters
 * ({@code 0 O l I 1}) to improve human readability.
 */
@Component
public class ShortCodeGenerator {

    private static final String ALPHABET =
        "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

    /** Default length for generated short codes (7 chars → ~30 billion combinations). */
    public static final int DEFAULT_LENGTH = 7;

    private final SecureRandom random = new SecureRandom();

    /**
     * Generates a random short code of {@link #DEFAULT_LENGTH} characters.
     *
     * @return alphanumeric short code string
     */
    public String generate() {
        return generate(DEFAULT_LENGTH);
    }

    /**
     * Generates a random short code of the specified length.
     *
     * @param length desired code length (min 4)
     * @return alphanumeric short code string
     */
    public String generate(int length) {
        if (length < 4) {
            throw new IllegalArgumentException("Short code length must be at least 4");
        }
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
