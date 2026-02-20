package adma.sa2_sa3.backend.repository;

import adma.sa2_sa3.backend.domain.ShortUrl;
import adma.sa2_sa3.backend.domain.ShortUrl.LinkStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Repository for {@link ShortUrl} persistence operations.
 */
public interface ShortUrlRepository extends JpaRepository<ShortUrl, Long> {

    // ── Core redirect look-up ─────────────────────────────────────────────────

    /** Core redirect look-up – hits the unique index on {@code shortCode}. */
    Optional<ShortUrl> findByShortCode(String shortCode);

    /** Check code availability before persisting (collision detection). */
    boolean existsByShortCode(String shortCode);

    // ── User history ──────────────────────────────────────────────────────────

    /** Return all active short URLs belonging to a given user, newest-first. */
    List<ShortUrl> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, LinkStatus status);

    /** Check whether a user already owns a short URL for the given original URL. */
    boolean existsByUserIdAndOriginalUrl(Long userId, String originalUrl);

    /** Find an unowned (anonymous) active entry by original URL, if any. */
    Optional<ShortUrl> findFirstByOriginalUrlAndUserIdIsNullAndStatus(
        String originalUrl, LinkStatus status);

    // ── Expiry cleanup ────────────────────────────────────────────────────────

    /**
     * Bulk-marks all anonymous links past their expiry time as EXPIRED.
     * Run by the scheduled cleanup job before hard-deletion.
     */
    @Modifying
    @Query("""
        UPDATE ShortUrl s
        SET s.status = adma.sa2_sa3.backend.domain.ShortUrl.LinkStatus.EXPIRED
        WHERE s.expiresAt IS NOT NULL
          AND s.expiresAt < :now
          AND s.status = adma.sa2_sa3.backend.domain.ShortUrl.LinkStatus.ACTIVE
        """)
    int markExpired(Instant now);

    /**
     * Hard-deletes all entries with status EXPIRED.
     * Called immediately after {@link #markExpired} inside the same transaction.
     */
    @Modifying
    @Query("""
        DELETE FROM ShortUrl s
        WHERE s.status = adma.sa2_sa3.backend.domain.ShortUrl.LinkStatus.EXPIRED
        """)
    int deleteExpired();

    // ── Public aggregate stats ────────────────────────────────────────────────

    /** Total number of short URLs ever created (all statuses). */
    @Query("SELECT COUNT(s) FROM ShortUrl s")
    long countTotal();

    /** Sum of all redirect counts across every short URL. */
    @Query("SELECT COALESCE(SUM(s.redirectCount), 0) FROM ShortUrl s")
    long sumRedirects();

    /**
     * Global average redirect latency in milliseconds.
     * Only includes rows where avgRedirectMs has been recorded (at least one redirect).
     */
    @Query("SELECT COALESCE(AVG(s.avgRedirectMs), 0) FROM ShortUrl s WHERE s.avgRedirectMs IS NOT NULL")
    double avgLatencyMs();
}

