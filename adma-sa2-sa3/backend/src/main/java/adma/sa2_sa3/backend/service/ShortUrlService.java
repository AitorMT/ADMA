package adma.sa2_sa3.backend.service;

import adma.sa2_sa3.backend.dto.CreateShortUrlRequest;
import adma.sa2_sa3.backend.dto.ShortUrlResponse;

import java.util.List;

/**
 * Contract for URL shortening operations.
 */
public interface ShortUrlService {

    /**
     * Creates a new short URL owned by the given authenticated user (permanent, no expiry).
     */
    ShortUrlResponse createShortUrl(CreateShortUrlRequest request, String ownerEmail);

    /**
     * Creates a new anonymous short URL (temporary, 8-hour TTL, userId = null).
     */
    ShortUrlResponse createAnonymousShortUrl(CreateShortUrlRequest request);

    /**
     * Resolves a short code for redirect.
     * Throws {@link adma.sa2_sa3.backend.exception.ResourceNotFoundException} (404) if not found.
     * Throws {@link adma.sa2_sa3.backend.exception.LinkExpiredException} (410) if expired.
     * Also records redirect latency (ms) supplied by the caller.
     */
    String resolveShortCode(String shortCode, long redirectLatencyMs);

    /**
     * Returns all ACTIVE short URLs belonging to the authenticated user, newest-first.
     */
    List<ShortUrlResponse> listUrlsForUser(String ownerEmail);

    /**
     * Soft-deletes a short URL owned by the given user.
     * Throws {@link adma.sa2_sa3.backend.exception.ResourceNotFoundException} if not found.
     * Throws {@link adma.sa2_sa3.backend.exception.UnauthorizedException} if the link belongs to another user.
     */
    void deleteShortUrl(Long id, String ownerEmail);

    /**
     * Bulk-syncs anonymous localStorage URLs to an authenticated user.
     * Deduplication: skip if already owned → claim unowned → create new.
     */
    List<ShortUrlResponse> syncAnonymousUrls(List<String> originalUrls, String ownerEmail);
}

