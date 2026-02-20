package adma.sa2_sa3.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Represents an application user.
 * <p>
 * Passwords are NEVER stored in plaintext; only the bcrypt-hashed value
 * is persisted. The {@code email} column carries a unique index so that
 * duplicate registrations are rejected at the database level.
 */
@Entity
@Table(
    name = "users",
    indexes = {
        @Index(name = "idx_users_email", columnList = "email", unique = true)
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Unique login identifier – used as the JWT subject. */
    @Column(nullable = false, unique = true, length = 255)
    private String email;

    /** BCrypt-hashed password. Never exposed in DTOs or logs. */
    @Column(nullable = false)
    private String password;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
