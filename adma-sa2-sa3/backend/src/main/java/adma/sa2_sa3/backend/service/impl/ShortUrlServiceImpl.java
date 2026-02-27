package adma.sa2_sa3.backend.service.impl;

import adma.sa2_sa3.backend.config.AppConfig;
import adma.sa2_sa3.backend.domain.ShortUrl;
import adma.sa2_sa3.backend.domain.ShortUrl.LinkStatus;
import adma.sa2_sa3.backend.domain.ShortUrl.LinkType;
import adma.sa2_sa3.backend.domain.User;
import adma.sa2_sa3.backend.dto.CreateShortUrlRequest;
import adma.sa2_sa3.backend.dto.ShortUrlResponse;
import adma.sa2_sa3.backend.exception.LinkExpiredException;
import adma.sa2_sa3.backend.exception.ResourceNotFoundException;
import adma.sa2_sa3.backend.exception.UnauthorizedException;
import adma.sa2_sa3.backend.repository.ShortUrlRepository;
import adma.sa2_sa3.backend.repository.UserRepository;
import adma.sa2_sa3.backend.service.ShortUrlService;
import adma.sa2_sa3.backend.util.ShortCodeGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

/**
 * Default implementation of {@link ShortUrlService}.
 * <p>
 * Business rules enforced here:
 * <ul>
 *   <li>Anonymous links expire in exactly {@link #ANON_TTL_HOURS} hours.</li>
 *   <li>Registered links are permanent (no expiry).</li>
 *   <li>Redirect rejects expired links with HTTP 410 Gone.</li>
 *   <li>Redirect latency is recorded via Welford's online average.</li>
 *   <li>Only the owner can delete their link.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShortUrlServiceImpl implements ShortUrlService {

    /** Safety ceiling for collision-retry loop. */
    private static final int MAX_COLLISION_RETRIES = 5;

    /** TTL for anonymous links — exactly 8 hours, per business rules. */
    static final int ANON_TTL_HOURS = 8;

    private final ShortUrlRepository shortUrlRepository;
    private final UserRepository     userRepository;
    private final ShortCodeGenerator shortCodeGenerator;
    private final AppConfig          appConfig;

    // ── Create: authenticated (permanent) ────────────────────────────────────

    @Override
    @Transactional
    public ShortUrlResponse createShortUrl(CreateShortUrlRequest request, String ownerEmail) {
        User owner = findUserByEmail(ownerEmail);

        ShortUrl shortUrl = ShortUrl.builder()
            .originalUrl(request.getOriginalUrl())
            .shortCode(generateUniqueCode())
            .userId(owner.getId())
            .linkType(LinkType.PERMANENT)
            .status(LinkStatus.ACTIVE)
            .expiresAt(null)           // permanent — never expires
            .build();

        shortUrlRepository.save(shortUrl);
        log.info("Permanent short URL created: {} -> {} (user={})",
            shortUrl.getShortCode(), request.getOriginalUrl(), ownerEmail);

        return toResponse(shortUrl);
    }

    // ── Create: anonymous (8-hour TTL) ────────────────────────────────────────

    @Override
    @Transactional
    public ShortUrlResponse createAnonymousShortUrl(CreateShortUrlRequest request) {
        Instant now      = Instant.now();
        Instant expiresAt = now.plus(ANON_TTL_HOURS, ChronoUnit.HOURS);

        ShortUrl shortUrl = ShortUrl.builder()
            .originalUrl(request.getOriginalUrl())
            .shortCode(generateUniqueCode())
            .userId(null)
            .linkType(LinkType.TEMPORARY)
            .status(LinkStatus.ACTIVE)
            .expiresAt(expiresAt)
            .build();

        shortUrlRepository.save(shortUrl);
        log.info("Anonymous short URL created: {} -> {} (expires={})",
            shortUrl.getShortCode(), request.getOriginalUrl(), expiresAt);

        return toResponse(shortUrl);
    }

    // ── Resolve (redirect hot path) ───────────────────────────────────────────

    /**
     * Resolves a short code to the original URL and updates redirect analytics.
     * Throws 404 if not found, 410 if expired.
     *
     * @param redirectLatencyMs real elapsed time from request receipt to this call (ms)
     */
    @Override
    @Transactional
    public String resolveShortCode(String shortCode, long redirectLatencyMs) {
        ShortUrl shortUrl = shortUrlRepository.findByShortCode(shortCode)
            .orElseThrow(() -> new ResourceNotFoundException("Short code not found: " + shortCode));

        // Enforce expiry — check both persisted status and real-time clock
        if (shortUrl.isExpiredNow()) {
            // If it was still ACTIVE in the DB but expired by clock, persist the state
            if (shortUrl.getStatus() == LinkStatus.ACTIVE) {
                shortUrl.setStatus(LinkStatus.EXPIRED);
                shortUrlRepository.save(shortUrl);
            }
            throw new LinkExpiredException(shortCode);
        }

        // ── Update analytics ──────────────────────────────────────────────────
        long newCount = shortUrl.getRedirectCount() + 1;
        shortUrl.setRedirectCount(newCount);

        // Welford's online mean: μₙ = μₙ₋₁ + (xₙ − μₙ₋₁) / n
        double prev = shortUrl.getAvgRedirectMs() == null ? 0.0 : shortUrl.getAvgRedirectMs();
        shortUrl.setAvgRedirectMs(prev + ((double) redirectLatencyMs - prev) / newCount);

        shortUrlRepository.save(shortUrl);
        log.debug("Redirect: {} -> {} (latency={}ms, count={})",
            shortCode, shortUrl.getOriginalUrl(), redirectLatencyMs, newCount);

        return shortUrl.getOriginalUrl();
    }

    // ── List user URLs ────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<ShortUrlResponse> listUrlsForUser(String ownerEmail) {
        User owner = findUserByEmail(ownerEmail);
        return shortUrlRepository
            .findByUserIdAndStatusOrderByCreatedAtDesc(owner.getId(), LinkStatus.ACTIVE)
            .stream()
            .map(this::toResponse)
            .toList();
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public void deleteShortUrl(Long id, String ownerEmail) {
        User owner = findUserByEmail(ownerEmail);

        ShortUrl shortUrl = shortUrlRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Short URL not found: " + id));

        if (!owner.getId().equals(shortUrl.getUserId())) {
            throw new UnauthorizedException("You do not own this short URL");
        }

        shortUrl.setStatus(LinkStatus.DELETED);
        shortUrlRepository.save(shortUrl);
        log.info("Short URL {} deleted by user {}", shortUrl.getShortCode(), ownerEmail);
    }

    // ── Sync (anonymous → authenticated) ─────────────────────────────────────

    @Override
    @Transactional
    public List<ShortUrlResponse> syncAnonymousUrls(List<String> originalUrls, String ownerEmail) {
        User owner = findUserByEmail(ownerEmail);

        for (String originalUrl : originalUrls) {
            // 1. Skip if user already owns this URL
            if (shortUrlRepository.existsByUserIdAndOriginalUrl(owner.getId(), originalUrl)) {
                log.debug("Sync skip (already owned): {} for {}", originalUrl, ownerEmail);
                continue;
            }

            // 2. Claim an existing anonymous active entry if available
            Optional<ShortUrl> anonEntry =
                shortUrlRepository.findFirstByOriginalUrlAndUserIdIsNullAndStatus(
                    originalUrl, LinkStatus.ACTIVE);

            if (anonEntry.isPresent()) {
                ShortUrl entry = anonEntry.get();
                entry.setUserId(owner.getId());
                entry.setLinkType(LinkType.PERMANENT);
                entry.setExpiresAt(null);            // claiming makes it permanent
                shortUrlRepository.save(entry);
                log.info("Claimed anonymous URL {} for {}", entry.getShortCode(), ownerEmail);
            } else {
                // 3. Create a fresh owned entry
                ShortUrl shortUrl = ShortUrl.builder()
                    .originalUrl(originalUrl)
                    .shortCode(generateUniqueCode())
                    .userId(owner.getId())
                    .linkType(LinkType.PERMANENT)
                    .status(LinkStatus.ACTIVE)
                    .expiresAt(null)
                    .build();
                shortUrlRepository.save(shortUrl);
                log.info("Synced new short URL {} for {}", shortUrl.getShortCode(), ownerEmail);
            }
        }

        return shortUrlRepository
            .findByUserIdAndStatusOrderByCreatedAtDesc(owner.getId(), LinkStatus.ACTIVE)
            .stream()
            .map(this::toResponse)
            .toList();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + email));
    }

    private String generateUniqueCode() {
        for (int attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
            String code = shortCodeGenerator.generate();
            if (!shortUrlRepository.existsByShortCode(code)) {
                return code;
            }
            log.debug("Short code collision on attempt {}/{}", attempt + 1, MAX_COLLISION_RETRIES);
        }
        throw new IllegalStateException(
            "Failed to generate a unique short code after " + MAX_COLLISION_RETRIES + " attempts");
    }

    private ShortUrlResponse toResponse(ShortUrl shortUrl) {
        String baseUrl = appConfig.resolveBaseUrl();
        return ShortUrlResponse.builder()
            .id(shortUrl.getId())
            .originalUrl(shortUrl.getOriginalUrl())
            .shortCode(shortUrl.getShortCode())
            .shortUrl(baseUrl + "/" + shortUrl.getShortCode())
            .createdAt(shortUrl.getCreatedAt())
            .expiresAt(shortUrl.getExpiresAt())
            .linkType(shortUrl.getLinkType())
            .status(shortUrl.getStatus())
            .redirectCount(shortUrl.getRedirectCount())
            .avgRedirectMs(shortUrl.getAvgRedirectMs())
            .destinationStatus(shortUrl.getDestinationStatus())
            .lastCheckedAt(shortUrl.getLastCheckedAt())
            .build();
    }
}
