package adma.sa2_sa3.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Represents a shortened URL entry.
 * <p>
 * Design decisions:
 * <ul>
 *   <li>{@code shortCode} has a unique index – it is the hot read path for redirects.</li>
 *   <li>{@code userId} is nullable – anonymous entries have no owner.</li>
 *   <li>{@code expiresAt} is null for registered (permanent) links; non-null for anonymous ones (8 h TTL).</li>
 *   <li>{@code status} tracks the lifecycle: ACTIVE → EXPIRED | DELETED.</li>
 *   <li>{@code avgRedirectMs} accumulates a running average of real redirect latencies.</li>
 *   <li>{@code destinationStatus} caches the last HTTP status of the destination URL.</li>
 * </ul>
 */
@Entity
@Table(
    name = "short_urls",
    indexes = {
        @Index(name = "idx_short_urls_short_code", columnList = "shortCode", unique = true),
        @Index(name = "idx_short_urls_user_id",    columnList = "userId"),
        @Index(name = "idx_short_urls_expires_at", columnList = "expiresAt"),
        @Index(name = "idx_short_urls_status",     columnList = "status")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShortUrl {

    // ── Link types ────────────────────────────────────────────────────────────

    public enum LinkType { TEMPORARY, PERMANENT }

    public enum LinkStatus { ACTIVE, EXPIRED, DELETED }

    // ── Primary key ───────────────────────────────────────────────────────────

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Core fields ───────────────────────────────────────────────────────────

    /** The original (long) URL supplied by the user. */
    @Column(nullable = false, length = 2048)
    private String originalUrl;

    /**
     * Short alphanumeric code used in the redirect path, e.g. {@code /aB3xYz}.
     * Generated with collision-safe logic in {@code ShortCodeGenerator}.
     */
    @Column(nullable = false, unique = true, length = 10)
    private String shortCode;

    /** Timestamp recorded at creation (UTC). */
    @Column(nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    // ── Ownership ─────────────────────────────────────────────────────────────

    /**
     * Owner of this short URL – references {@link User#getId()}.
     * Nullable: anonymous short URLs have no owner.
     */
    @Column(nullable = true)
    private Long userId;

    // ── Expiry ────────────────────────────────────────────────────────────────

    /**
     * Absolute expiry timestamp (UTC).
     * <ul>
     *   <li>Anonymous links: {@code createdAt + 8 hours}</li>
     *   <li>Registered links: {@code null} (never expires)</li>
     * </ul>
     */
    @Column(nullable = true)
    private Instant expiresAt;

    // ── Classification ────────────────────────────────────────────────────────

    /** Whether this is a temporary (anonymous) or permanent (registered) link. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private LinkType linkType = LinkType.TEMPORARY;

    /** Current lifecycle status of this link. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private LinkStatus status = LinkStatus.ACTIVE;

    // ── Analytics ─────────────────────────────────────────────────────────────

    /** Total number of redirect requests served. */
    @Column(nullable = false)
    @Builder.Default
    private Long redirectCount = 0L;

    /**
     * Running arithmetic mean of redirect latencies in milliseconds.
     * Updated on every redirect via Welford's incremental average formula.
     */
    @Column(nullable = true)
    private Double avgRedirectMs;

    /**
     * Last HTTP status code observed when checking the destination URL.
     * {@code null} until the first availability check is performed.
     */
    @Column(nullable = true)
    private Integer destinationStatus;

    /** When the destination URL was last checked for availability. */
    @Column(nullable = true)
    private Instant lastCheckedAt;

    // ── Computed helpers ──────────────────────────────────────────────────────

    /**
     * Returns true if this link is currently expired.
     * Considers both the {@code expiresAt} timestamp and the persisted {@code status}.
     */
    public boolean isExpiredNow() {
        if (status == LinkStatus.EXPIRED || status == LinkStatus.DELETED) return true;
        return expiresAt != null && Instant.now().isAfter(expiresAt);
    }
}
